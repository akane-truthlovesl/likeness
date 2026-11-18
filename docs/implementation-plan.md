# Implementation plan: AI Artistic Avatar Generator (personal edition)

> **As built (2026-11-18).** This plan was written before the build and is kept as the record of what was agreed. The build follows its architecture; some names changed on the way. The product is *Likeness*: the package and its command are `likeness` (the plan says `avatar`), the server code lives in `likeness/` (the plan says `app/`), recipes and packets are TOML (`likeness/worlds/*.toml`, `task.toml`), and the blueprint is `architecture-blueprint.md`, beside this file. The synthetic cast is drawn by the app's own atelier, so the packets were renumbered: 0001 is the workstation bring-up and 0002 the likeness LoRA. There is no CI workflow; the checks run locally (`npm run check`, `npm test`, `uv run pytest`). `README.md` and `relay/README.md` describe the repository as it is.

Stack locked 2026-11-18. Companion to `architecture-blueprint.md`, which explains the mechanisms this plan relies on.

## 1. What your constraints settle

| Constraint | Consequence |
|---|---|
| Personal, single-user hobby project | No accounts, rate limits, moderation or app-store work. Non-commercial model licences are acceptable. |
| Laptop with RTX 5090 Laptop GPU (24 GB) and 96 GB RAM | All rendering and training run locally. An extra image costs nothing, so the design can spend compute freely. |
| This machine: 2 cores, 7 GB RAM, no GPU | Everything except model execution is built and tested here against a mock renderer. |
| The two machines never connect | GitHub is the only channel, in both directions. |
| GPU work only through a prompt file for Codex | Every laptop run is a self-contained, numbered packet in the repo. |
| Phone connects to the laptop, last | The laptop is the server. The app must work over plain HTTP first. |

Defaults I am locking for the questions left open in the blueprint (override any of them):

- Output is a 3:4 bust near 1 megapixel, in seven fixed styles.
- Target is under 15 s from style tap to first result.
- Input is one live selfie, plus an optional one-time enrolment of a few photos of you.
- Real photos never leave the laptop.
- Pipeline comparison is internal tooling plus a compare mode in the app.
- Animated avatars and a realtime viewfinder are out of scope for v1.

## 2. Operating model

Three actors:

- **Claude, on this machine.** Writes all code, configs, recipes, tests, docs and relay packets. Runs everything that needs no GPU. Reviews results and does the visual design.
- **Codex, on the laptop.** Executes relay packets: installs, downloads, runs GPU jobs and training, makes the smallest fixes to code I could not run, and reports back.
- **You.** Start Codex on a packet, accept gated model terms once, judge results from your own photos, and vote in the compare mode.

One cycle:

1. I push a packet.
2. You tell Codex: "Pull the repo, read AGENTS.md and run the oldest pending relay packet."
3. Codex pushes a report.
4. You tell me results are in. I pull, read and adjust.

Each cycle costs your time, so packets are staged (later stages run only if earlier ones pass) and batched (one packet answers several questions). I keep building here between cycles.

## 3. Locked stack

| Layer | Choice | Why |
|---|---|---|
| Mobile client | Hand-written HTML, CSS and JavaScript modules, with no framework and no build step. Type-checked by TypeScript in check-only mode over JSDoc comments. | Matches "pure HTML". The laptop serves the files as they are, and nothing needs compiling on either machine. |
| On-device vision | MediaPipe Face Landmarker, vendored into the repo | Face gate, framing guidance and expression values. Works offline on a LAN. |
| Server | Python 3.12, FastAPI, uvicorn. Progress over SSE with polling as fallback. | Same language as the model code, one process to start, runs on Windows or Linux. |
| State | SQLite plus the file system | Single user, nothing to administer. |
| Model runtime | PyTorch 2.15 with CUDA 13 wheels, diffusers 0.43, transformers 5.23, accelerate, peft, bitsandbytes | Both finalist models ship diffusers pipelines. Pipelines defined in code can be tested here against stubs. |
| Renderers | Two in-context edit models installed side by side: **Qwen-Image-2.1-Turbo** and **FLUX 3 Image Klein (distilled)**. FLUX.2 klein 9B is held back as a 4-step draft tier. | Both fit 24 GB, accept up to 10 reference images and have LoRA training support. The first benchmark picks the default per style. |
| Face analysis on the server | SCRFD detector and ArcFace embedder run directly in ONNX Runtime; MediaPipe for expression values | Avoids the insightface Python package, which is hard to install on Windows. Testable on CPU here. |
| Training | ostris/ai-toolkit, driven by configs in the repo | Its README lists both finalists, including paired edit training with control images. |
| Environments | uv for Python on both machines. Node 20 here for dev tooling only. | uv needs no system pip (this machine has none) and behaves the same on Windows and Linux. |
| Tests | pytest; Playwright driving the installed Chrome with a fake camera; GitHub Actions | Full capture-to-result tests without a GPU. CI also checks whatever Codex pushes. |
| Relay | Numbered packets in `relay/`, a Python runner, `AGENTS.md` for standing rules | One fixed sentence starts any packet. |
| Phone link (last) | Plain HTTP on the LAN first. HTTPS through Tailscale or a local certificate when the live viewfinder is wanted. | File-input capture needs no HTTPS, so this choice blocks nothing. |

Rejected:

- **Headless ComfyUI as the engine.** I cannot run or validate node graphs here, and custom-node versions drift, so one broken workflow would cost a full relay cycle. It stays usable on the laptop as a playground.
- **Commercial APIs as the renderer.** Unnecessary with a local GPU, and they would send your face off the laptop. Adapters can be added later as reference points.
- **A JavaScript framework or bundler.** It adds a build step for no benefit at this size.
- **An InstantID or PuLID adapter stack as the primary.** Older base models and community pipelines that break with library updates. Kept as an optional later comparison (milestone 8).

Facts behind the renderer choice, read today from model cards, Hugging Face file listings, Black Forest Labs' reference repo and PyPI:

- **Qwen-Image-2.1:** 7B generator (14.2 GB), text encoder 17.5 GB, not gated, loads with `QwenImage21Pipeline`. The Turbo checkpoint runs in 8 steps. The card claims identity preservation for people. Qwen Research License.
- **FLUX 3 Image Klein:** 5.6B generator (11.1 GB, with official FP8 and NVFP4 builds at 6.3 and 5.3 GB), text encoder 8.9 GB. The distilled model runs 16 steps without guidance, about 3 s per megapixel image on an H200. It has bounding-box layout control and a prompt upsampler that the reference code runs on every request. Gated behind accepting terms.
- **Not yet known:** speed and likeness on your GPU. My estimate is 4–9 s per megapixel image. Packet 0001 measures it.

## 4. Runtime architecture on the laptop

```
phone browser ──HTTP + SSE──▶ FastAPI process ──▶ pipeline stages ──▶ engine worker (GPU)
                                   │                                       │
                             SQLite + files                  models in VRAM, others parked in RAM
```

- **One command starts everything:** `uv run avatar serve`. It prints a pairing QR code (URL plus token) so only your phone can use the server.
- **One GPU job at a time** on a dedicated worker thread, so progress events keep flowing.
- **Memory strategy.** The active renderer lives in VRAM. The other finalist stays parked in system RAM, which 96 GB allows, and swaps in within seconds. Packet 0001 measures a loading matrix per model (bf16 with offload, FP8, 4-bit text encoder, NVFP4), and I pick the fastest that fits.
- **Style wall.** Because local compute is free, a capture renders the chosen style first and the other six in the background. Tiles fill in as they finish.
- **Step previews.** Where a pipeline exposes a step callback, intermediate images stream to the phone so the wait shows progress.

Pipeline, with every stage swappable, traced and given a deadline:

```
capture → normalise → face gate → identity pack → style recipe → render → refine → verify → deliver
```

API surface:

| Endpoint | Purpose |
|---|---|
| `POST /api/photos` | Upload a normalised photo with client landmarks. Starts the identity pack at once. Returns a photo ID and the gate verdict. |
| `POST /api/jobs` | Photo ID, styles and optional recipe overrides. Returns a job ID. |
| `GET /api/jobs/{id}/events` | SSE stream: queued, progress with preview, render done with metrics, done, error. |
| `GET /api/jobs/{id}` | Polling fallback, and resume after the phone was backgrounded. |
| `GET /api/styles`, `GET /api/recipes` | What the client can offer. |
| `POST /api/votes` | Blind A/B result from the compare mode. |
| `GET /api/history` | Past results. |
| `GET /api/health` | Engine state, loaded models, VRAM. |

A recipe is the unit of comparison. Example:

```yaml
id: claymation.qwen21.v1
style: claymation
engine: qwen21_turbo
references: [photo, face_crop, "exemplar:clay_01"]
prompt:
  template: >-
    Recreate the person from image 1 as a hand-sculpted claymation character
    in the style of image 3. Keep their {attributes} and their {expression}.
  describer: none        # none | native_upsampler | vlm
params: { steps: 8, size: [896, 1152], seed: auto }
refine: { face_detail: false }
verify: { min_face_similarity: 0.35 }
```

Two ladders organise every experiment. Each rung is a recipe flag, and the bench shows which rungs earn their latency.

| Rung | Identity ladder | Style ladder |
|---|---|---|
| 0 | One photo as reference | Prompt only |
| 1 | Plus a tight face crop as second reference | Plus exemplar images |
| 2 | Plus expression and attribute words | Plus a community LoRA |
| 3 | Plus a face detailer pass | Plus a house-style LoRA trained on the laptop |
| 4 | Plus enrolment references (3–5 stored photos of you) | |
| 5 | Plus a personal LoRA trained on the laptop | |

## 5. Repository layout

```
AGENTS.md              standing rules for Codex (relay protocol, privacy, allowed edits)
CLAUDE.md              standing notes for Claude Code (constraints, conventions)
pyproject.toml         one Python project; dependency groups: core, gpu, train, dev
package.json           dev tooling only: type-check and Playwright
docs/                  blueprint, this plan, decision notes
app/server/            FastAPI app: routes, SSE, pairing, static files
app/pipeline/          stages: normalise, face, identity pack, plan, render, refine, verify
app/engines/           renderer adapters and per-model profiles; mock engine
app/bench/             cast runner, metrics, contact sheets, vote tables
app/store/             SQLite and file store
web/                   the mobile app: HTML, CSS, JS modules, vendored MediaPipe
styles/                one folder per style: style.yaml, recipes, exemplars
cast/                  synthetic test identities (generated, safe to share)
relay/                 packets: NNNN-slug/{PROMPT.md, task.yaml, REPORT.md, out/}
models/manifest.yaml   what to download: repos, pinned revisions, sizes, licences
train/                 ai-toolkit configs and dataset builders
tests/                 pytest and Playwright
private/               git-ignored: real photos, enrolment, personal LoRA, tokens
```

## 6. Relay protocol

A packet holds:

- `PROMPT.md`: what Codex reads. Goal, the one command to run, stage gates, failure rules.
- `task.yaml`: stages, commands, timeouts and expected artefacts, for the runner.
- `REPORT.md` and `out/`: written on the laptop. Results, changes made, questions, metrics JSON, contact sheets as small JPEGs, log tails.

Rules for Codex, kept in `AGENTS.md`:

- Run `uv run relay run <id>`. The runner executes the stages, captures logs and stops at the first failed gate.
- On failure, diagnose, make the smallest fix and list every change under "Changes made". Edits are allowed in `app/engines/`, `models/`, `train/` and the packet folder. Anything else is reported, not changed.
- Long jobs run detached with a heartbeat file. Poll them; do not block on them.
- Never commit `private/`, model weights, tokens or any image of a real person.
- Commit as `relay(<id>): …`, rebase on pull, then push.

GPU packets need network access for downloads and unrestricted access to the GPU and model caches. Codex's default sandbox blocks network, so those packets must be started with full access. Each `PROMPT.md` says so at the top.

Two privacy tiers:

- **Synthetic cast.** About 24 generated test identities, not real people, varied in age, skin tone, hair, glasses, expression and photo quality. Everything rendered from them can be committed, so I can inspect results here.
- **Real photos.** Yours stay in `private/` on the laptop. Runs on them commit numbers only (similarity scores, timings), never images, unless you decide otherwise.

## 7. Who does what

| Work | Claude here | Codex on laptop | You |
|---|---|---|---|
| Server, pipeline, recipes, bench, relay runner | Writes and tests | | |
| Mobile web app and visual design | Writes, tests, iterates by screenshot | | Approves the look |
| Engine adapters | Writes against stubs | Verifies on real models, minimal fixes | |
| Environment, drivers, model downloads | Scripts and manifest | Executes | Accepts gated terms once |
| Benchmarks | Designs, analyses, picks defaults | Runs, commits reports | Votes in compare mode |
| Training | Dataset builders, configs, acceptance tests | Runs ai-toolkit, reports | Supplies enrolment photos locally |
| Phone connection | Scripts and instructions | Helps set up | Pairs the phone |

## 8. Milestones

### M0. Bootstrap (Claude; needs repo access)

- Repo structure, `pyproject.toml` with dependency groups, `AGENTS.md`, `CLAUDE.md`, docs, `.gitignore`, commit guard, CI workflow.
- Relay runner with tests.
- Engine interface, a generic diffusers adapter with a profile per model, and contract tests against stub pipelines.
- Model manifest with pinned revisions and sizes, plus a fetch tool.
- Packet 0001 written and pushed.

Done when CI is green and packet 0001 is in the repo.

### M1. Walking skeleton (Claude, while you run packet 0001)

- Server: photo upload, job queue, SSE, storage, pairing token, health.
- Mock engine: classical image filters per style with artificial step delays, so the whole flow is real.
- Web app skeleton at 9:16: both capture routes, face gate, upload with progress, style wall, result view, resume after reload.
- Playwright tests with a fake camera on the installed Chrome.

Done when a test here captures a frame, uploads it and receives seven streamed mock results.

### M2. Engine bring-up (packet 0001, Codex)

Stages:

1. Probe: OS, GPU, driver, VRAM, disk, Python.
2. Environment: uv sync with the GPU group; PyTorch sees CUDA.
3. Fetch: Qwen-Image-2.1-Turbo and the face models first, since they are not gated. Then FLUX 3 Image Klein once you have accepted its terms.
4. Smoke: each engine renders two bundled synthetic portraits in two styles.
5. Loading matrix: latency and peak VRAM per loading strategy and resolution.
6. Report with a contact sheet.

Done when at least one finalist renders end to end in under 15 s and the numbers are in the repo. I then fix the adapters from the report and set size, steps and loading defaults.

### M3. Cast, exemplars and baseline (packets 0002 and 0003)

- Packet 0002 generates the synthetic cast and candidate style exemplars. I curate both here from contact sheets.
- I write style packs and v1 recipes for the seven styles on both finalists.
- Packet 0003 runs the baseline bench: cast × styles × finalists at rungs 0–1 of both ladders.

Done when each style has a default engine and recipe chosen from data, and the app renders real results in the laptop's own browser. The webcam works there without HTTPS because localhost counts as secure.

### M4. Visual design and polish (Claude)

- With real cast outputs as fixtures: design language, capture guidance, reveal sequence, style wall, gallery, save and share, compare mode with blind voting, and a developer overlay showing the trace.
- Iterated here by screenshot at phone viewport sizes.

Done when you approve it in the laptop browser and all flows are covered by tests.

### M5. Climb the ladders (packets 0004 onward)

- Identity rungs 2–4 and style rung 2, a verify stage with best-of-N, and the enrolment flow in the app.
- Each rung is benchmarked. A rung stays only if it raises likeness or style consistency within the latency budget.
- Your compare-mode votes export as numbers and feed the same tables.

Done when v2 recipes are chosen per style, with evidence.

### M6. Training (Codex executes, Claude prepares)

- **House-style LoRAs,** only for styles where rungs 0–2 fall short. A slow, high-quality teacher recipe renders the cast in the style. Results are filtered automatically by likeness and style score, and I review the sheets. ai-toolkit then trains on the photo-to-style pairs.
- **Personal LoRA,** trained on your enrolment photos, entirely on the laptop. Results come back as numbers, and you judge the images.

A LoRA is adopted only if it wins in the bench and in your votes.

### M7. Laptop deployment and phone link (Claude writes; Codex and you execute)

- Start-up command, warm-up on launch, pairing QR.
- Phone over Wi-Fi or hotspot with file-input capture first. Then HTTPS for the live viewfinder, and install to the home screen.
- Latency tuning on the real path.

Done when phone capture to first result takes under 15 s and the style wall completes in about a minute.

### M8. Optional

- An adapter-stack family (FaceID or InstantID with ControlNet on SDXL) as a second mechanism in the bench.
- Animated avatar.
- Commercial API adapters as reference points.
- Capacitor wrapper.

## 9. Verification

- **Engine contract tests.** Every engine passes one shared suite: here against stub pipelines, on the laptop against the real ones.
- **Server and pipeline.** pytest with the mock engine.
- **Client.** Playwright at phone viewports with a fake camera, with screenshots reviewed.
- **CI** on every push, including Codex's.
- **Bench metrics.** Face similarity (ArcFace), expression distance (blendshape values), style similarity to exemplars (a CLIP-class embedding), latency and peak VRAM. Face similarity is not used for anime and brick styles; those rely on attribute checks and your votes.

## 10. Risks

| Risk | Mitigation |
|---|---|
| GPU code is written on a machine with no GPU | Thin adapters over standard pipelines, shared contract tests, a staged first packet, Codex allowed minimal fixes, and the ungated model with a known interface goes first |
| Laptop OS unknown | Python-only tooling with no shell scripts. Packet 0001 reports the OS. WSL2 is the fallback if a Windows wheel is missing. |
| Speed on a laptop GPU unknown | Measured first. Levers: FP8 or NVFP4 weights, rendering at 0.7 MP then upscaling, fewer-step LoRAs, the FLUX.2 klein draft tier. |
| Likeness below expectation | The identity ladder, ending in enrolment references and a personal LoRA |
| Each relay cycle costs your time | Staged and batched packets; building continues here between cycles |
| Private photos leaking into git | `private/` ignored, commit guard, CI check, rule in `AGENTS.md`, synthetic cast for everything shared |
| Disk space | About 100 GB for both finalists and about 160 GB with training bases. The probe checks before downloading. |
| Models keep changing | A model is a manifest entry plus a profile file |

## 11. What I need from you to start

1. **A private GitHub repo and a way for this machine to push.** Recommended: create an empty private repo and add a deploy key with write access. I generate the key pair here, and it is scoped to that one repo. Alternative: I install the GitHub CLI locally and you log in with a device code.
2. **Permission to commit and push** to that repo as I work, and the author name to use.
3. **Laptop OS** (Windows, WSL2 or Linux) and **phone** (iPhone or Android), if you know offhand. Neither blocks the start.
4. **Hugging Face:** accept the FLUX 3 Image Klein terms and keep a token on the laptop. Not needed for the first stages.
5. **Privacy choice:** may results rendered from your real photos be pushed to the private repo so I can inspect them? The default is no.
