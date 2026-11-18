# Packet 0001 · Workstation bring-up

> **For Codex, on the Windows laptop** (RTX 5090 Laptop GPU, 24 GB VRAM, 96 GB RAM), in PowerShell, at the root of this repository.
>
> **This packet needs full access:** the network (about 33 GB of model downloads) and the GPU. Codex's default sandbox blocks both. If you are sandboxed, stop and ask the user to start you again with full access.

## Why you are here

Likeness is a personal portrait studio: a phone-shaped web app (`web/`) and a small server for the machine that owns the GPU (`likeness/`). All of it was written and tested on a small Linux machine with no GPU, against a simulator. The one part that has never run is the one that matters most: `likeness/engines/diffusers_engine.py`, the adapter that loads Qwen-Image 2.1 Turbo and turns a photograph into a portrait.

You are the hands on the only machine that can run it. Install the GPU environment, download the models, prove the engine with real renders and real timings, and send the evidence back through git. The author (Claude, on the Linux machine) cannot see this laptop: what you do not write down, he never learns.

## Done means

1. `uv run likeness relay run 0001` ends with `All gates passed`.
2. `relay/0001-workstation-bringup/REPORT.md` is filled in.
3. One commit, `relay(0001): workstation bring-up`, is pushed to `main`.
4. The user has seen the studio running on the laptop (Step 5).

## Rules for this packet

- `AGENTS.md` applies. In short: fix only what blocks a stage, in the smallest way, and list every change in the report.
- Commit nothing from `private/`, no model weights, no tokens, no photographs of real people. The test sitters in `tests/fixtures/sitters/` are drawings; they are the only faces that may appear in committed pictures.
- Ask the user before anything that needs administrator rights or changes Windows itself (drivers, firewall, NVIDIA Control Panel, power settings).
- Do not edit `web/` or `docs/`.

## Step 0 · Check the ground (two minutes)

```powershell
git status --short     # expect no output; if there are changes, stop and ask the user
git pull --ff-only
nvidia-smi             # expect the RTX 5090 Laptop GPU; note the driver version
uv --version           # expect a version number
```

If `uv` is missing, install it, then open a new terminal:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Disk.** The models need about 35 GB (55 GB with the optional second model) in the Hugging Face cache, which is `%USERPROFILE%\.cache\huggingface` unless `HF_HOME` says otherwise. To keep them on another drive, set this once and open a new terminal:

```powershell
setx HF_HOME "D:\hf-cache"
```

**Power.** The laptop should be plugged in and should stay awake during the download. Ask the user to see to it.

## Step 1 · Install the GPU environment (5 to 15 minutes)

```powershell
uv sync --group gpu
uv run python -c "import torch, diffusers; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0), diffusers.__version__, hasattr(diffusers, 'QwenImage21Pipeline'))"
```

Expect one line like `2.15.0+cu132 True NVIDIA GeForce RTX 5090 Laptop GPU 0.43.0 True`. If either `True` is `False`, or the command raises, go to "When something fails" before anything else.

uv installs Python 3.12 by itself if the laptop has none. `uv sync --group gpu` is the only installer for this repository: do not `pip install` into it.

## Step 2 · Run the packet (first run: one to three hours, nearly all of it download)

```powershell
uv run likeness relay run 0001
```

The runner executes the stages in `task.toml` in order, writes each stage's output to `out\<stage>.log`, and stops at the first failed gate. It is safe to run again: downloads resume, and finished work is quick to repeat. To repeat chosen stages only: `uv run likeness relay run 0001 --only smoke --only matrix`.

| Stage | What it does | Gate | Expect |
|---|---|---|---|
| `probe` | Describes the machine; fails unless PyTorch can use the GPU | yes | seconds |
| `tests` | The studio's own tests (no GPU) | yes | a minute or two, all passing, a few skipped |
| `simulator` | The whole pipeline with the stand-in engine: proves Python, paths and files on Windows | yes | seconds |
| `fetch` | Downloads Qwen-Image 2.1 Turbo (32.5 GB, not gated) and the face models (0.3 GB) | yes | as long as the line takes |
| `smoke` | Two drawn sitters in three worlds, on the GPU, with a contact sheet | yes | a minute or two to load, then seconds per plate |
| `worlds` | Both sitters in all seven worlds | no | a few minutes |
| `matrix` | Two loading strategies at three sizes. Running out of memory is a result here, not a failure | no | 10 to 30 minutes |
| `fetch-klein`, `smoke-klein` | The second model, FLUX 3 Image Klein. It is gated: both stages fail until the user has accepted its licence, and that is fine | no | see Step 4 |

When it ends, `out\RUN.md` holds the stage table and the tail of every log.

## Step 3 · Look at the pictures

Open `relay\0001-workstation-bringup\out\smoke\sheet-qwen21_turbo.jpg` and `out\worlds\sheet-qwen21_turbo.jpg`. Each row starts with a drawn sitter and continues with that sitter in each world.

Judge them as a person would, and write what you see in the report:

- Is each plate plainly the same sitter (hair, skin, glasses, beard, expression), repainted in the world's medium?
- Are the worlds distinct from one another, and is each what its recipe in `likeness/worlds/*.toml` asks for?
- Anything broken: a second face, lettering, a cropped head, the photograph returned unchanged, a blank or noisy picture.

The sitters are drawings, and to the face model all six look like relatives (their similarity to one another is 0.3 to 0.7, where two real strangers score near 0). So the similarity numbers on these sheets only show that the measurement runs. Whether a real face is kept is judged in Step 5, by the user, on their own photograph.

## Step 4 · The second model (optional; needs the user once)

FLUX 3 Image Klein is gated. If the user wants it compared:

1. The user opens https://huggingface.co/black-forest-labs/flux-3-image-klein, signs in and accepts the licence.
2. `uv run hf auth login` (the user pastes a read token; it is kept in the Hugging Face cache, never in this repository).
3. `uv run likeness relay run 0001 --only fetch-klein --only smoke-klein`

If the user does not want it now, skip this step and say so in the report.

## Step 5 · Show the user the studio

```powershell
uv run likeness serve
```

Open http://127.0.0.1:8787/ in Chrome or Edge **on the laptop**. The pill at the top must read `LIVE · WORKSTATION`. Ask the user to take a sitting with the laptop's webcam (or to choose a photograph) and to develop it in two or three worlds, then to open "Behind it" on a plate: the pipeline trace there is measured on this machine.

Ask the user two things and put the answers in the report: does it look like you, and how long did a plate take? Nothing from this step is committed: the photographs and plates stay in `private\`.

To measure a real photograph without committing it, the user can also give you a path:

```powershell
uv run likeness smoke --engine qwen21_turbo --photo "C:\path\to\a-portrait.jpg" --worlds clay,noir,oil,cinema --out relay/0001-workstation-bringup/out/own
```

The contact sheet goes to `private\smoke\` and stays there; `out\own\` receives numbers only (seconds and face similarity per world).

The phone comes last and is not part of this packet. Do not open the firewall on your own initiative; the README has the steps for the user ("The phone, last").

## Step 6 · Report and push

Fill in `relay\0001-workstation-bringup\REPORT.md` (the runner created it). It should let someone who was not there decide what to do next:

- **Summary.** Which stages passed, where it stopped if it did, and the one or two things that matter most.
- **The machine.** GPU, driver, PyTorch and diffusers versions (from `out\probe.json`).
- **Speed and memory.** Median seconds per plate and peak VRAM from `out\smoke\smoke-qwen21_turbo.json`; the `matrix` table in a few lines, with the strategy and size you would make the default and why. The target is a plate in about 15 seconds.
- **The pictures.** Your verdict from Step 3, one line per world.
- **The user's verdict** from Step 5.
- **Changes made.** Every file you edited and why. "None" if none.
- **Questions for Claude.** Anything that needs a decision.

Then:

```powershell
git add relay/0001-workstation-bringup likeness models tests pyproject.toml uv.lock
git status --short        # check: nothing under private/, no .safetensors, no photographs of real people
git commit -m "relay(0001): workstation bring-up"
git pull --rebase
git push
```

Tell the user it is pushed and that Claude can continue from the report.

## When something fails

Read the stage's log first: `relay\0001-workstation-bringup\out\<stage>.log`.

| Symptom | Likely cause | What to do |
|---|---|---|
| `uv sync --group gpu` finds no matching `torch` | The CUDA 13.2 wheel index is unreachable or has moved | See which CUDA builds of PyTorch 2.15 exist for Windows at https://download.pytorch.org/whl/torch/ ; change the index in `pyproject.toml` (`pytorch-cu132`), run `uv lock` and `uv sync --group gpu`, and report it. |
| `torch.cuda.is_available()` is `False` | The NVIDIA driver is older than this CUDA build needs, or a CPU-only wheel was installed | `uv run likeness probe` shows the versions. For the driver, ask the user to update it; do not install drivers yourself. |
| `diffusers` has no `QwenImage21Pipeline` | The installed diffusers predates its support for this model | `uv lock --upgrade-package diffusers`, then `uv sync --group gpu`. If the newest release still lacks it: `uv add --group gpu "diffusers @ git+https://github.com/huggingface/diffusers"`, and report the commit it resolved to. |
| `fetch` stops halfway | The connection | Run the packet again; the download resumes. |
| `fetch-klein` says the model is gated | The licence is not accepted yet | Step 4. Not a failure. |
| `smoke` fails inside `likeness/engines/diffusers_engine.py` (an unexpected keyword, a missing attribute, a different return type) | The adapter was written from the model card without a GPU, and something differs | Read the model card (https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo) and repair the adapter. This is the file you are expected to fix. Keep the change small and say what the card told you. |
| A plate takes minutes, and Task Manager shows "Shared GPU memory" filling | Windows is spilling VRAM into system RAM instead of reporting it full | Keep the default strategy (`offload`) and close other programs that use the GPU. If it persists, tell the user about "CUDA - Sysmem Fallback Policy: Prefer No Sysmem Fallback" in the NVIDIA Control Panel; it is their setting to change. Report the timings either way. |
| `CUDA out of memory` in `smoke` | Another program holds VRAM | `nvidia-smi` shows who. Free it and run `--only smoke` again; report peak VRAM. |
| A test in `tests` fails | Something in the studio behaves differently on Windows | Fix it if the cause is plain (paths, file locks, encodings). Otherwise put the failure in the report in full and continue with `--only`. |
| Hugging Face warns about symlinks | The cache cannot make symlinks without Developer Mode | Harmless. `$env:HF_HUB_DISABLE_SYMLINKS_WARNING = "1"` quietens it. |

If a gate still fails after an honest attempt, stop there. Fill in the report with the log tail and what you tried, commit it and push. A clear report of a failure is a good result for this packet.

## What you may change

- `likeness/engines/**` and `models/manifest.toml`: freely, to make the real engine work.
- Elsewhere in `likeness/**` and `tests/**`, and `pyproject.toml` with `uv.lock`: the smallest fix that unblocks a stage on Windows.
- `relay/0001-workstation-bringup/**`: the report, the outputs, and `task.toml` if a stage needs different arguments (say why).
- Nothing else. If something else looks wrong, write it under "Questions for Claude".
