# Workstation bring-up

## Relay results

The GPU probe, tests, simulator, model fetch, and GPU smoke gates passed. The pinned checkpoint and both face models passed checksum verification and loaded offline. The seven-world run repeated the smoke cases with the corrected adapter and produced 14 renders at 896 x 1200. All 29 tests passed again after the final engine changes. The frontend type check passed.

## Loading strategy

CPU offload rendered all three benchmark sizes. Keep it as the default and use the standard plate size for interactive work. The standard plate exceeded the packet's latency target, and larger plates took longer. The initial full-residency run spilled into shared memory. The recheck returned an allocation error before moving the weights because the model exceeded available device memory.

## Picture check

- Neon Noir retains the hair and beard silhouettes under neon rim light. The deep shadows hide some facial detail, and the background contains sign-like marks.
- Chiaroscuro uses warm window light and period dress. Both faces stay recognizable.
- Studio Clay carries over the hair shape and expressions with sculpted texture.
- Cinema 3D preserves framing and expressions with soft background blur.
- Brick Miniature turns the bodies into molded figures and keeps the key facial features.
- Inked Cel uses clean outlines and flat color, with recognizable expressions and hair.
- The Order keeps the faces recognizable against detailed armor and torchlight.

## Live studio

A synthetic sitting completed the browser upload, development, and reveal flow on the GPU. The Behind it panel showed a measured trace from capture through delivery. A real-photo assessment remains available for the user to perform locally. The optional FLUX comparison requires license access before evaluation.

## Changes made

- `likeness/engines/diffusers_engine.py` renders on Qwen's required grid, then crops to the requested plate size. It checks the weight footprint before moving the whole pipeline to the GPU.
- `likeness/faces.py` preloads CUDA libraries before creating the face sessions on Windows.
- `pyproject.toml` adds TorchVision for the Qwen processor and resolves it from the matching PyTorch index.
- `uv.lock` records the TorchVision resolution.
- `relay/0001-workstation-bringup/REPORT.md` records the bring-up and verification results.
