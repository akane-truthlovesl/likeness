# Likeness

**Seven studios. One face.** A personal portrait atelier: sit once in front of your phone, and be painted in neon, in oil, in clay, in 3D, in brick, in ink and in steel, without ceasing to look like yourself.

Likeness is two things in one repository:

- **The app** (`web/`): a phone-shaped (9:16) web app in plain HTML, CSS and JavaScript modules. No framework, no build step.
- **The studio** (`likeness/`): a small Python server for the workstation that owns the GPU. It carries a photograph through an identity-locked render and streams the progress back.

It is a single-user hobby project: one phone, one laptop, nobody else.

## Three editions, always labelled

The app always says which studio is speaking, in a pill at the top of every screen and in a stamp on every plate.

| Edition | What draws the portrait | How to run it |
|---|---|---|
| **Showcase** | The *atelier*: a procedural portrait engine in the browser. A sitting is read on the device (MediaPipe) and drawn from that reading as a **study**. Nothing leaves the phone. | Serve `web/` as static files. |
| **Live · Simulator** | The real server, pipeline, jobs and events, with a filter-based stand-in for the model. Proves the plumbing without a GPU. | `uv run likeness serve --engine mock` |
| **Live · Workstation** | An identity-locked edit model on your own GPU (Qwen-Image 2.1 Turbo; FLUX 3 Image Klein as the challenger). Plates are **renders** of your photograph. | `uv run likeness serve` on the laptop, after packet 0001. |

The showcase edition is complete on its own: six fictional house sitters, seven worlds, the whole ritual from sitting to keepsake print, and a Lab that shows why identity-locked conditioning keeps a likeness where a plain prompt drifts. Whatever is simulated says so on screen.

## Run it

**Showcase** (any machine with Node 20 or newer):

```
npm install
npm run serve          # http://127.0.0.1:4173
```

**Live with the simulator** (any machine with [uv](https://docs.astral.sh/uv/)):

```
uv sync
uv run likeness serve --engine mock      # http://127.0.0.1:8787, and a pairing code for the phone
```

Open either in a desktop browser and you get the 9:16 stage, letterboxed; on a phone it fills the screen.

## On the laptop: handing over to Codex

The Windows laptop with the RTX 5090 is the only machine that can run the real model, and nothing here has run on it yet. Setting it up is a packet of work written for Codex:

```powershell
git clone https://github.com/akane-truthlovesl/likeness.git
cd likeness
```

Open Codex in that folder **with full access** (it needs the network for about 33 GB of models, and the GPU) and say:

> Read AGENTS.md, then carry out relay/0001-workstation-bringup/PROMPT.md.

It installs the GPU environment, downloads the models, renders test plates, measures speed and memory, shows you the studio running, and pushes a report back. After that the studio is one command:

```powershell
uv run likeness serve
```

Later, if you want the model to know your face from more than one photograph, a second packet trains a small LoRA on fifteen to twenty-five photographs of you, entirely on the laptop, and adopts it only if it measurably helps: `relay/0002-likeness-lora/PROMPT.md`.

## The phone, last

The studio is made to be reached from the phone directly, over your own Wi-Fi. It is deliberately the final step: do it once packet 0001 is green.

1. Laptop and phone on the same Wi-Fi, with the network set to *Private* in Windows.
2. Let the port through the firewall, once, in PowerShell as Administrator:
   `New-NetFirewallRule -DisplayName "Likeness studio" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8787 -Profile Private`
3. `uv run likeness serve` prints the phone's address with a pairing code, and a QR code. Scan it once. The phone stays paired; any other device on the network is turned away.
4. Add it to the Home Screen to use it full-screen.

Over plain `http://` a phone browser will not open a live camera (browsers allow that only on secure pages), so the sitting screen's **Photograph** button opens the phone's own camera instead, and everything else works the same. The live viewfinder with its framing cues works on the laptop itself, where `localhost` counts as secure. Bringing it to the phone needs HTTPS (Tailscale Serve or a local certificate would do); that is the one piece left for a later packet.

## How a portrait is made

```
capture → normalise → face gate → identity pack → style recipe → render → refine → verify → deliver
```

Every stage is timed and leaves a note; the app's Lab shows the trace for each plate. A **recipe** (`likeness/worlds/*.toml`) describes one world twice: *locked*, where the model is handed the photograph and told what must not change, and *naive*, where it is handed only a description. The two exist side by side so the difference can be seen and measured (face similarity with SCRFD and ArcFace on the workstation).

## Map

```
web/                    the app
  js/atelier/           the on-device portrait engine: geometry, figure painter, seven worlds
  js/studio/            showcase and live studios behind one interface; the on-device reading
  js/screens/           catalogue, sitting, developing, reveal, lab, drawer
  js/core/              router, motion, raster, storage, keepsake print
  vendor/               MediaPipe Tasks Vision and its models (vendor/README.md)
likeness/               the studio (FastAPI): pipeline, jobs, recipes, face tools, relay runner
  engines/              mock (the simulator) and the diffusers adapters for the two models
  worlds/               one recipe per world
  enrol.py, identity.py the training set builder, and the LoRA of the sitter's own face
models/manifest.toml    what the workstation downloads: pinned revisions, sizes, licences
train/                  the ai-toolkit config for the likeness LoRA
relay/                  numbered work packets for Codex on the workstation (relay/README.md)
AGENTS.md               standing rules for the agent on the workstation
tests/                  pytest (the studio) and Playwright (the app, in Chrome, with a fake camera)
tools/                  static server, contact-sheet and fixture tool
docs/                   the architecture blueprint and the implementation plan
private/, workstation/  git-ignored: photographs, renders, LoRAs, pairing key, face models, third-party checkouts
```

## Develop

```
npm run check           # type-check the app (TypeScript over JSDoc, no emit)
npm test                # Playwright: every flow at a 9:16 phone viewport, showcase and live simulator
uv run pytest           # the studio: recipes, pipeline, API, relay runner, face tools
npm run sheet           # a contact sheet of sitters × worlds, to judge the atelier by eye
npm run fixtures        # redraw the synthetic test photographs in tests/fixtures/sitters
```

`npm test` starts its own servers (the static one, and the simulator through uv when uv is installed), uses the installed Google Chrome with a fake camera, and fails on any console error, uncaught exception, failed request or unexpected warning. Set `LIKENESS_SHOTS=1` to keep a screenshot of every screen in `test-results/`. The face tests in pytest run when the face models are present (`uv sync --group faces`, then `uv run likeness fetch faces`) and are skipped otherwise.

## The relay

The two machines never talk to each other; GitHub is the only channel. Work for the GPU travels as a numbered packet in `relay/`: a `PROMPT.md` for Codex, a `task.toml` for the runner, and after a run an `out/` folder and a `REPORT.md` that come back by git. `relay/README.md` has the protocol.

## Privacy

Photographs and renders of real people live only in `private/` on the machine that made them, which git ignores. The showcase edition reads faces on the device and sends nothing anywhere. Everything committed here (the house sitters, the test fixtures) is drawn, not photographed.

## Credits

Type: Fraunces and IBM Plex Mono (SIL Open Font License). Face reading in the browser: MediaPipe Tasks Vision (Apache 2.0). On the workstation: Qwen-Image 2.1 Turbo, FLUX 3 Image Klein and the InsightFace buffalo_l models, each under its own licence as listed in `models/manifest.toml`; all are used here for personal, non-commercial purposes. Training: ostris/ai-toolkit.
