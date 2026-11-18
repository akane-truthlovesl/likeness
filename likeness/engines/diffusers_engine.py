"""GPU engines: thin adapters over the two finalist edit models, as their own documentation loads and calls them.

Written on a machine with no GPU, against the model cards and the diffusers documentation as read on
2026-11-18. The first relay packet runs these for real; anything that differs on the workstation is fixed
here, in this file, and nowhere else.

  Qwen-Image 2.1 Turbo   QwenImage21Pipeline.from_pretrained(repo, dtype=bfloat16); the 8-step schedule is saved
                         with the checkpoint, editing passes the photograph as image=, and use_kv_cache=True.
  FLUX 3 Image Klein     ModularPipeline.from_pretrained(repo); load_components(dtype=bfloat16); output="images".
                         The distilled checkpoint runs 4 to 16 steps without guidance. Its prompt upsampler
                         (9B parameters) is dropped by default: recipes already write full scene captions.
"""

from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass

from PIL import Image, ImageOps

from .. import paths
from . import RenderRequest, StepCallback


@dataclass(frozen=True)
class Profile:
    label: str
    repo: str
    loader: str                 # "pipeline" | "modular"
    cls: str = ""
    default_steps: int = 8
    fixed_schedule: bool = False   # the checkpoint carries its own sampling schedule; do not pass a step count
    call: tuple = ()               # extra keyword arguments for every call
    drop_blocks: tuple = ()


PROFILES = {
    "qwen21_turbo": Profile("Qwen-Image 2.1 Turbo", "Qwen/Qwen-Image-2.1-Turbo", "pipeline", "QwenImage21Pipeline", 8, True, (("use_kv_cache", True),)),
    "qwen21": Profile("Qwen-Image 2.1", "Qwen/Qwen-Image-2.1", "pipeline", "QwenImage21Pipeline", 40),
    "flux3_klein": Profile("FLUX 3 Image Klein", "black-forest-labs/flux-3-image-klein", "modular", default_steps=16, drop_blocks=("prompt_upsampler",)),
}


def _pinned(repo: str) -> str | None:
    """The revision models/manifest.toml pins for a repository, so the engine loads exactly what  likeness fetch  downloaded."""
    try:
        models = tomllib.loads(paths.MANIFEST.read_text(encoding="utf-8"))["models"]
    except OSError:
        return None
    return next((m.get("revision") for m in models.values() if m.get("repo") == repo), None) or None


class DiffusersEngine:
    kind = "gpu"

    def __init__(self, name: str, strategy: str | None = None):
        if name not in PROFILES:
            raise KeyError(f"Unknown engine: {name}. Known: mock, {', '.join(PROFILES)}")
        self.id, self.profile = name, PROFILES[name]
        # offload: components visit the GPU in turn (fits 24 GB with room to spare).  cuda: everything resident.
        self.strategy = strategy or os.environ.get("LIKENESS_STRATEGY", "offload")
        self.default_steps = self.profile.default_steps
        self.device, self.ready, self.pipe, self._lora = "not loaded", False, None, ""

    def load(self) -> None:
        import diffusers
        import torch

        if not torch.cuda.is_available():
            raise RuntimeError("PyTorch cannot see a CUDA device. Run  uv run likeness probe  and check the driver and the cu132 wheels.")
        p = self.profile
        if p.loader == "pipeline":
            pipe = getattr(diffusers, p.cls).from_pretrained(p.repo, revision=_pinned(p.repo), dtype=torch.bfloat16)
            if self.strategy == "cuda":
                free, _ = torch.cuda.mem_get_info()
                weights = sum(parameter.nbytes for model in pipe.components.values()
                              if isinstance(model, torch.nn.Module) for parameter in model.parameters())
                if weights > free:
                    raise torch.cuda.OutOfMemoryError("Model weights exceed available GPU memory for full CUDA residency. Use offload.")
                pipe.to("cuda")
            else:
                pipe.enable_model_cpu_offload()
        else:
            blocks = diffusers.ModularPipeline.from_pretrained(p.repo).blocks
            for name in p.drop_blocks:
                blocks.sub_blocks.pop(name)
            pipe = blocks.init_pipeline(p.repo)
            pipe.load_components(dtype=torch.bfloat16)
            pipe.to("cuda")
        self.pipe = pipe
        self.device = f"{torch.cuda.get_device_name(0)} \u00b7 {torch.cuda.get_device_properties(0).total_memory / 2**30:.0f} GB"
        self.ready = True

    def _set_lora(self, path: str) -> None:
        if path == self._lora:
            return
        if self._lora:
            self.pipe.unload_lora_weights()
        if path:
            self.pipe.load_lora_weights(path)
        self._lora = path

    def render(self, request: RenderRequest, on_step: StepCallback) -> Image.Image:
        import torch

        if self.pipe is None:
            raise RuntimeError("The engine is not loaded")
        p, steps = self.profile, request.steps or self.profile.default_steps
        self._set_lora(request.lora)
        kwargs = {"prompt": request.prompt, "width": request.width, "height": request.height, "generator": torch.Generator("cpu").manual_seed(request.seed), **dict(p.call)}
        if request.photo is not None:
            kwargs["image"] = request.photo.convert("RGB")
        if p.loader == "modular":
            kwargs.update(num_inference_steps=steps, output="images")
            on_step(0, steps)
            image = self.pipe(**kwargs)[0]
            on_step(steps, steps)
            return image
        if p.fixed_schedule:
            steps = p.default_steps
        else:
            kwargs.update(num_inference_steps=steps, true_cfg_scale=request.guidance)

        # Qwen packs latents in 2x2 patches. Render at the next compatible size and crop to the requested plate.
        stride = self.pipe.vae_scale_factor * 2
        kwargs["width"] = ((request.width + stride - 1) // stride) * stride
        kwargs["height"] = ((request.height + stride - 1) // stride) * stride

        def step_end(pipe, index, timestep, state):
            on_step(index + 1, steps)
            return state

        try:
            image = self.pipe(**kwargs, callback_on_step_end=step_end).images[0]
        except TypeError:   # a pipeline without step callbacks still renders; it only reports the end
            image = self.pipe(**kwargs).images[0]
            on_step(steps, steps)
        size = (request.width, request.height)
        return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS) if image.size != size else image
