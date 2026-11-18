# AGENTS.md

Standing instructions for a coding agent working in this repository **on the workstation**: the Windows laptop with the RTX 5090 Laptop GPU (24 GB VRAM, 96 GB RAM). If you are Codex and the user has pointed you at a relay packet, read this first, then the packet.

## What this is

Likeness is a single-user portrait studio. `web/` is a phone-shaped (9:16) web app in plain HTML, CSS and JavaScript. `likeness/` is a small Python server that carries a photograph through an identity-locked image model and streams progress to the app. It was all written on a Linux machine with no GPU, against a simulator. This laptop is the only place the real model runs.

The two machines never connect. GitHub is the only channel: work arrives here as a numbered packet in `relay/`, and your results go back as a commit. `relay/README.md` explains the protocol.

## Start here

- **Setting the laptop up:** `relay/0001-workstation-bringup/PROMPT.md`
- **Training a LoRA of the user's face** (later, only when asked): `relay/0002-likeness-lora/PROMPT.md`

GPU packets need the network and the GPU. If you are running sandboxed, say so and ask the user to start you with full access.

## Commands

PowerShell, from the repository root. `uv` is the only installer and the only way to run Python here.

| Command | What it does |
|---|---|
| `uv sync --group gpu` | Install or refresh the GPU environment (PyTorch for CUDA 13.2, diffusers, ONNX Runtime) |
| `uv run likeness relay run <id>` | Run a packet's stages; `--only <stage>` repeats chosen ones |
| `uv run likeness relay pending` | Packets not yet run to the end |
| `uv run likeness probe` | Describe this machine: GPU, driver, PyTorch, disk |
| `uv run likeness serve` | Start the studio at http://127.0.0.1:8787/ |
| `uv run likeness smoke --engine qwen21_turbo` | Render the drawn test sitters and write a contact sheet |
| `uv run pytest` | The studio's tests (no GPU needed) |

## Boundaries

- **Yours to fix:** `likeness/engines/**` (the adapters for the real models: written blind, expected to need repair), `models/manifest.toml`, `train/**`, and the folder of the packet you are running.
- **Smallest fix only:** elsewhere in `likeness/**`, `tests/**`, `pyproject.toml` and `uv.lock`, when a stage cannot pass on Windows otherwise.
- **Not yours:** `web/**` (the app), `docs/**`, `tools/**`, and the recipes' wording in `likeness/worlds/*.toml`. If one of these looks wrong, describe it under "Questions for Claude" in the report.
- Every file you change is listed in the packet's `REPORT.md` with a sentence of why. No silent edits, no new dependencies without a line in the report, no refactoring.
- Ask the user before anything that needs administrator rights or changes Windows itself: drivers, the firewall, NVIDIA Control Panel, power settings.

## Privacy

- `private/` and `workstation/` are git-ignored and stay that way. They hold the user's photographs, renders, LoRAs, face models, pairing key and third-party checkouts.
- Never commit a photograph or a render of a real person, model weights (`*.safetensors`, `*.ckpt`), or a token. Reports carry numbers; the only faces in committed pictures are the drawn sitters from `tests/fixtures/sitters/`.
- Hugging Face tokens go through `uv run hf auth login` and live in the Hugging Face cache. Never write one into a file here.
- Run `git status --short` before every commit and read it.

## Git

- Work on `main`. One commit per packet run: `relay(<id>): <what happened>`.
- `git pull --rebase` before `git push`. Never force-push, never rewrite history.
- If the working tree is not clean when you start, stop and ask the user.

## When you are unsure

A clear report of a failure is a good result. Stop at the failed gate, write down the log tail and what you tried, commit it and push. Guessing past a gate wastes the next hour and hides the cause.
