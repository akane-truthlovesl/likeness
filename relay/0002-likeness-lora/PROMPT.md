# Packet 0002 · A LoRA of the sitter's own face

> **For Codex, on the Windows laptop**, in PowerShell, at the root of this repository.
>
> **This packet needs full access** (network, GPU, a few hours) **and the user**: it trains on their photographs, which never leave this machine. Start it only when the user asks for it, and only after packet 0001 has passed.

## Why

An identity-locked render already carries the user's photograph through the model. A small LoRA trained on fifteen to twenty-five photographs of the same person is the next rung: the model then knows the face itself, from several angles, and can hold it under heavier stylisation. Whether it actually helps is not assumed. It is measured on photographs the LoRA never saw, and the LoRA is adopted only if the numbers say so.

Everything about the user stays in `private\`: the photographs, the crops, the LoRA, the comparison sheet. What goes back through git is counts and scores.

## Done means

1. `uv run likeness relay run 0002` ends with `All gates passed`.
2. `relay/0002-likeness-lora/out/check/lora-check.json` says whether the LoRA helps, and `adopted` is `true` or the report says why not.
3. `REPORT.md` is filled in and one commit, `relay(0002): likeness LoRA`, is pushed.

## Step 0 · What must already be true

```powershell
git status --short; git pull --ff-only
uv run likeness relay pending          # 0001 must not be listed
Test-Path private\models\faces\w600k_r50.onnx    # True: the face models from packet 0001
```

About 40 GB of free disk is needed: ai-toolkit downloads its own copy of the model, in a different format from the one packet 0001 fetched.

## Step 1 · The photographs (the user does this)

Ask the user to copy 15 to 25 photographs of themselves into `private\enrol\in\` (create the folder if it is not there). What makes a good set:

- One person per photograph, the face sharp and at least a few hundred pixels wide. Phone photographs are fine.
- Variety: different days, light, angles and expressions; with and without glasses if they wear them only sometimes.
- JPEG, PNG or WebP. iPhone HEIC files must be exported as JPEG first.
- No sunglasses, no heavy filters, no group shots.

Then build the training set and the training config:

```powershell
uv run likeness relay run 0002 --only enrol --only config
```

`enrol` prints counts only. It rejects photographs with no face, several faces, a face that is too small, or a face that resembles none of the others, and it holds two to four back for the test in Step 4. The reasons, with file names, are in `private\enrol\enrol.json` for the user to read. If it says there are not enough usable photographs, ask the user for more and run it again. The crops are in `private\enrol\dataset\`; the user may look through them and delete any they dislike (delete the `.jpg` and its `.txt` together).

## Step 2 · Install ai-toolkit (once, 10 to 20 minutes)

Training uses [ostris/ai-toolkit](https://github.com/ostris/ai-toolkit), pinned to the commit this packet was written against, in its own environment (it wants a different PyTorch from the studio's). `workstation\` is git-ignored.

```powershell
git clone https://github.com/ostris/ai-toolkit.git workstation\ai-toolkit
cd workstation\ai-toolkit
git checkout 7a5fe1a8ca72276e1376ce6577f853b480c45576
uv venv venv --python 3.12 --seed
.\venv\Scripts\activate
pip install --no-cache-dir torch==2.13.0 torchvision==0.28.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cu130
pip install -r requirements.txt
python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
deactivate
cd ..\..
```

These are the toolkit's own "Manual installation" steps for Windows from its README at that commit, with `uv venv` making the environment. If they fail, the README there also describes its installer (`run_windows.bat`) and names a community easy-install script; either is fine, as long as `task.toml`'s `train` stage ends up pointing at the Python that has the toolkit's requirements (edit the path in `relay/0002-likeness-lora/task.toml` and say so in the report).

## Step 3 · Train and judge (one run; expect one to three hours)

```powershell
uv run likeness relay run 0002
```

It repeats `enrol` and `config` (quick, and the result is the same), then:

- **`train`** runs `python run.py private\enrol\likeness-lora.yaml` inside `workstation\ai-toolkit`. The first run downloads the model in the toolkit's format and its training adapter. 1,500 steps, rank 16, on Qwen-Image 2.1 Turbo with pre-quantised weights and `low_vram`, which is how the toolkit fits this model into 24 GB. Samples appear every 250 steps in `private\lora\runs\likeness_v1\samples\`; the result is `private\lora\runs\likeness_v1\likeness_v1.safetensors`.
- **`check`** renders each held-out photograph in four worlds twice, without and with the LoRA, on the same seed, and compares face similarity. The rule: adopt when the mean gain is at least 0.03 and no world loses more than 0.05. If it passes, the LoRA is copied to `private\lora\likeness.safetensors` and the studio uses it for every identity-locked render from the next start. The side-by-side sheet is `private\lora\check\sheet.jpg`, for the user's eyes.

The config is `train/likeness-lora.qwen21-turbo.yaml` with this machine's paths filled in. Its header says where each key was taken from. **It has never run.** If the toolkit rejects a key or a value, the toolkit is right: read its message, look at how its own code names things at the pinned commit (`extensions_built_in\diffusion_models\qwen_image_2\qwen_image_2.py` and `extensions_built_in\diffusion_models\ui.tsx`, entry `qwen_image_2:turbo`), fix the template in `train/`, run `--only config --only train` again, and report the change. The two places most likely to need it are `model.arch` (the trainer may want plain `qwen_image_2`, with `model_kwargs.turbo` doing the rest) and `process[0].type`.

## Step 4 · If the LoRA does not pass

A failed check is information. In order:

1. **Look at the sheet with the user.** If the "with" plates look more like them but lose the world's style (everything turns into a photograph), the LoRA is over-trained: try an earlier checkpoint. They are kept beside the final file:

   ```powershell
   uv run likeness lora-check --engine qwen21_turbo --lora private\lora\runs\likeness_v1\likeness_v1_000001000.safetensors --out relay/0002-likeness-lora/out/check-1000 --adopt
   ```

2. **If it fails to load** (the engine raises on `load_lora_weights`, usually over key names), do not rename keys by hand. Put the error and the first ten key names in the report:

   ```powershell
   uv run python -c "from safetensors import safe_open; f = safe_open(r'private\lora\runs\likeness_v1\likeness_v1.safetensors', 'pt'); print(list(f.keys())[:10])"
   ```

3. **If the numbers barely move**, say so and stop. The photograph alone may already be enough for this face, and that is a fine outcome: the studio stays as it is.

## Step 5 · Show the user

```powershell
uv run likeness serve
```

With an adopted LoRA, "Behind it" on a new plate shows `with the sitter's own LoRA` in the Style recipe stage. Ask the user whether the new plates look more like them, and put the answer in the report. To stop using the LoRA, delete `private\lora\likeness.safetensors` and restart.

## Step 6 · Report and push

Fill in `relay\0002-likeness-lora\REPORT.md`: the counts from `out\enrol.json`, how long training took and its peak VRAM if the toolkit printed it, the table from `out\check\lora-check.json` (per world: without, with, delta), whether it was adopted, the user's verdict, every change you made, and your questions.

```powershell
git add relay/0002-likeness-lora train likeness
git status --short        # check: nothing under private/ or workstation/, no .safetensors, no pictures
git commit -m "relay(0002): likeness LoRA"
git pull --rebase
git push
```

## What you may change

- `train/**`, and `relay/0002-likeness-lora/**` (the report, the outputs, `task.toml`).
- `likeness/engines/**` if loading the LoRA needs it; elsewhere in `likeness/**` only the smallest fix that unblocks a stage.
- Nothing in `web/` or `docs/`. Nothing from `private/` or `workstation/` is ever committed.
