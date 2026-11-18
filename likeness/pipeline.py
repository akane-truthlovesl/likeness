"""The pipeline: capture, normalise, face gate, identity pack, style recipe, render, refine, verify, deliver.

Every stage is timed and leaves a note, so a plate can always say how it was made. The first four run
when the photograph arrives; the rest run for each world it is developed in.
"""

from __future__ import annotations

import io
import random
import secrets
import time
from contextlib import contextmanager
from typing import Callable

from PIL import Image, ImageOps

from . import faces as face_tools
from . import identity, recipes
from .engines import Engine, RenderRequest
from .store import Store

STAGES = {
    "capture": ("Capture", 0), "normalise": ("Normalise", 0), "gate": ("Face gate", 0), "identity": ("Identity pack", 0),
    "recipe": ("Style recipe", 1), "render": ("Render", 2), "refine": ("Refine", 2), "verify": ("Verify", 2), "deliver": ("Deliver", 2),
}
PLATE = (960, 1280)   # the sitting as kept: 3:4, enough for any recipe
Emit = Callable[..., None]


class Trace:
    def __init__(self, emit: Emit | None = None, stages: list[dict] | None = None):
        self.emit, self.stages = emit, list(stages or [])

    @contextmanager
    def stage(self, stage_id: str, doing: str = ""):
        label, beat = STAGES[stage_id]
        if self.emit:
            self.emit("stage", id=stage_id, label=label, beat=beat, note=doing)
        entry, started = {"id": stage_id, "label": label, "ms": 0, "note": doing}, time.perf_counter()
        try:
            yield entry
        finally:
            entry["ms"] = round((time.perf_counter() - started) * 1000)
            self.stages.append(entry)


class Studio:
    def __init__(self, engine: Engine, store: Store, faces: face_tools.FaceTools | None = None):
        self.engine, self.store, self.faces = engine, store, faces

    def seat(self, data: bytes, reading: dict | None = None) -> dict:
        """Receives a photograph: the first four stages. Returns the sitting's id and the gate's verdict."""
        sitting_id, trace = secrets.token_hex(6), Trace()
        with trace.stage("capture") as st:
            image = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
            st["note"] = f"{image.width} × {image.height} received"
        with trace.stage("normalise") as st:
            image = ImageOps.fit(image.convert("RGB"), PLATE, Image.Resampling.LANCZOS, centering=(0.5, 0.42))
            image.save(self.store.photo(sitting_id), quality=93)
            st["note"] = f"upright, 3:4, {PLATE[0]} × {PLATE[1]}"
        with trace.stage("gate") as st:
            gate, face = self._gate(image)
            st["note"] = gate.get("note") or gate.get("reason", "")
        with trace.stage("identity") as st:
            if face is not None:
                self.faces.np.save(self.store.embedding(sitting_id), self.faces.embed(image, face))
                st["note"] = "face embedding and the reading kept"
            else:
                st["note"] = "the reading kept as notes" if reading else "nothing to keep but the photograph"
        self.store.add_sitting({"id": sitting_id, "reading": reading, "gate": gate, "trace": trace.stages})
        return {"id": sitting_id, "gate": gate}

    def _gate(self, image: Image.Image):
        if self.faces is None:
            return {"ok": True, "faces": None, "note": "skipped: no face model installed, the photograph is taken on trust"}, None
        found = self.faces.detect(image)
        if not found:
            return {"ok": False, "faces": 0, "reason": "No face was found in this photograph."}, None
        first = found[0]
        if first.width < image.width * 0.14:
            return {"ok": False, "faces": len(found), "reason": "The face is too small in the frame. Come closer."}, None
        if len(found) > 1 and found[1].width > first.width * 0.6:
            return {"ok": False, "faces": len(found), "reason": "More than one face. One sitter at a time."}, None
        return {"ok": True, "faces": len(found), "note": f"one face, {first.width / image.width:.0%} of the frame, confidence {first.score:.2f}"}, first

    def develop(self, sitting_id: str, world: str, variant: str = "locked", seed: int | None = None, emit: Emit | None = None, personal: dict | bool | None = True) -> dict:
        """Develops a sitting in a world. Emits stage and step events as it goes; returns the portrait's record.
        personal: True uses the sitter's adopted LoRA when there is one, None renders without, a dict tries that LoRA.
        Only the locked variant ever uses one: the naive variant is words and nothing else."""
        emit = emit or (lambda *a, **k: None)
        sitting = self.store.sitting(sitting_id)
        if sitting is None:
            raise KeyError(f"Unknown sitting: {sitting_id}")
        recipe, started = recipes.get(world), time.perf_counter()
        chosen = recipe.variant(variant)
        seed = random.randrange(100000) if seed is None else seed
        own = (identity.personal(self.store.home) if personal is True else personal or None) if variant == "locked" else None
        for st in sitting["trace"]:   # what was done when the photograph arrived, replayed for whoever is watching
            emit("stage", id=st["id"], label=st["label"], beat=0, note=st["note"])
        trace = Trace(emit, sitting["trace"])
        with trace.stage("recipe", f"{recipe.name}, {variant}" + (", with the sitter's own LoRA" if own else "")) as st:
            prompt = recipe.prompt(variant, (sitting.get("reading") or {}).get("words"), who=own["trigger"] if own else "")
            steps = chosen.steps if chosen.engine == self.engine.id else getattr(self.engine, "default_steps", chosen.steps)
        with trace.stage("render", "reference: the sitting" if chosen.reference == "photograph" else "reference: none, words only") as st:
            photo = Image.open(self.store.photo(sitting_id)) if chosen.reference == "photograph" else None
            request = RenderRequest(world, variant, prompt, chosen.width, chosen.height, steps, chosen.guidance, seed, photo, chosen.lora or (own["path"] if own else ""))
            image = self.engine.render(request, lambda i, n: emit("step", i=i, n=n))
            st["note"] = f"{steps} steps, {image.width} × {image.height}"
        with trace.stage("refine") as st:
            st["note"] = "face detail pass: off in this recipe"
        with trace.stage("verify") as st:
            similarity, measure, st["note"] = self._verify(sitting_id, image, chosen.identity_floor)
        portrait_id = secrets.token_hex(6)
        with trace.stage("deliver") as st:
            image.convert("RGB").save(self.store.plate(portrait_id), quality=94)
            st["note"] = "plate written"
        record = {
            "id": portrait_id, "sitting": sitting_id, "world": world, "recipe": variant, "engine": self.engine.id, "steps": steps, "seed": seed,
            "ms": round((time.perf_counter() - started) * 1000), "similarity": similarity, "measure": measure, "lora": bool(own), "url": f"api/files/portraits/{portrait_id}.jpg", "trace": trace.stages,
        }
        self.store.add_portrait(record)
        return record

    def _verify(self, sitting_id: str, image: Image.Image, floor: float):
        """How alike the render is to the sitting, which measure said so (face or proxy), and a sentence about it."""
        vector = self.store.embedding(sitting_id)
        if self.faces is not None and vector.exists():
            found = self.faces.detect(image)
            if not found:
                return None, "face", "no face found in the render to compare (expected in the least literal worlds)"
            score = round(self.faces.similarity(self.faces.np.load(vector), self.faces.embed(image, found[0])), 3)
            return score, "face", f"face similarity {score:.2f}" + (f", below this recipe's floor of {floor:.2f}" if floor and score < floor else "")
        score = face_tools.proxy_similarity(Image.open(self.store.photo(sitting_id)), image)
        return score, "proxy", f"proxy {score:.2f}: tone correlation with the photograph (no face model installed)"
