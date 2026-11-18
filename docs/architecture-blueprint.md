# AI Artistic Avatar Generator: architecture blueprint

## Bottom line

- **Own the pipeline, rent the renderer.** The top spot on public image-editing leaderboards changed several times in 2026. The durable design is a pipeline you own (identity analysis, style recipe, render, verify) with the renderer as a swappable stage. That is what makes this more than a thin wrapper, whether the renderer is an API or your own GPU.
- **Likeness means something different per style.** Oil and cyberpunk need the real face geometry. Anime and brick-figure styles need recognisable attributes such as hair, glasses and expression. No single identity mechanism serves both, so each style gets its own recipe.
- **15 seconds is reachable on most pathways** if identity analysis runs while the user picks a style, compute is warm, and you use fast tiers or few-step models. Top-quality tiers of commercial APIs (20–120 s reported) do not fit.
- **Recommended route:** start with managed renderers behind your own orchestrator (two commercial APIs plus one managed open-model endpoint) and build a comparison bench from the start. Move to your own GPU only where the bench shows a gain.
- Section 6 lists the decisions I need from you, each with a default.

How far to trust the numbers: GPU prices and Colab terms were read from vendor pages today. API prices and 2026 model names come from third-party reports. Latency ranges are my estimates unless marked as reported, and a bake-off has to confirm them.

## 1. First principles

### 1.1 Likeness travels through a channel

Every method passes identity to the generator through one of four channels, widest to narrowest:

1. **Pixels and structure** (image-to-image, ControlNet). Carries everything and permits the least change.
2. **Reference tokens** (in-context editing models). Carries everything visible; the model decides what to keep.
3. **Face embedding** (InstantID, PuLID, IP-Adapter FaceID). A 512-number code from a face-recognition network, computed from a tight 112-pixel crop. It carries who the person is and, by design, drops expression, pose, hair and glasses.
4. **Words** (an attribute sheet written by a vision-language model, VLM). Carries only what is named.

Wide channels preserve likeness and resist stylisation. Narrow channels free the style and lose the person. The rule is to use the narrowest channel that still carries what makes this person recognisable in this style, and to mix channels by image region and by denoising step.

### 1.2 What each of your styles needs

| Style | What changes | What must carry likeness | Suited mechanism |
|---|---|---|---|
| Classic oil | Texture, palette | Exact geometry and expression | In-context edit or structure-guided diffusion |
| Cyberpunk, fantasy knight | Scene, wardrobe, lighting; face stays near-real | Face geometry under new lighting | Embedding adapter or in-context edit, then face detailer |
| 3D animation, claymation | Proportions, materials | Simplified geometry, hair, glasses, expression | In-context edit with style LoRA; adapter at reduced weight |
| Anime | Face replaced by genre convention | Hair, eye colour, accessories, expression | In-context edit plus attribute sheet |
| Brick figure (Lego-like) | Face becomes a printed decal | Discrete attributes only | Attribute mapping plus in-context reference |

### 1.3 Mechanisms and how they fail

| Mechanism | Carries | How it fails | Knobs |
|---|---|---|---|
| Structure inheritance (image-to-image, ControlNet) | Pose, geometry, lighting | "Filter look" at low strength, a stranger at high; cannot change proportions | Denoise strength, control weights |
| Embedding adapters | Pose-invariant face code | Pulls output toward photorealism; drops expression, hair, glasses; pasted-face rigidity at high weight | Adapter weight, step schedule, face mask |
| In-context editing (GPT Image, Gemini, Seedream, FLUX, Qwen) | Everything visible | Prettified generic face, or an under-stylised "filtered photo"; refusals | Prompt, reference set; LoRA weight on open models |
| Per-user fine-tune (LoRA) | The person across poses | Minutes of training; overfits on one photo | Photos, steps, rank |
| Face detailer (crop face, re-diffuse larger, paste back) | Likeness for small faces, in style | Seams, lighting mismatch | Denoise, mask feather |
| Face swap | A photographic face | Real face on a stylised body | Few |
| Attribute sheet (VLM) | Hair, glasses, age band, expression | Generic or biased descriptions | Schema, user correction |

The three failures you named map onto this directly:

- **Generic lookalike drift** happens when the channel is too narrow or the model's prior wins. In-context models average faces toward smoother, younger and more symmetric. Embeddings plateau at "sibling" likeness. Style LoRAs and anime checkpoints impose a house face.
- **Rigid, lifeless overlays** happen when the channel is too wide or applied too late: low-strength image-to-image, face swaps, or a high adapter weight.
- **Style collapse** happens because identity adapters were trained on photographs, so strong identity conditioning drags the whole image back toward photorealism.

One less obvious failure: face-recognition models have known accuracy gaps across skin tones and ages, so likeness can be uneven across users unless the bench measures it by group.

### 1.4 Where 15 seconds goes

| Stage | Budget | Lever |
|---|---|---|
| Capture, crop, compress on device | 0.2–0.5 s | Face-aware crop to 150–400 KB |
| Upload | 0.3–1.5 s | Start at capture, before style choice |
| Identity analysis | 0.3–3 s | Runs during style selection, off the clock |
| Queue and cold start | 0 s target | Warm worker, prewarm on page open |
| Render | 3–9 s | Few-step models, fast tiers |
| Refine and verify | 1–3 s | Skipped when over budget |
| Deliver | 0.5–1.5 s | Display-sized image first |

Four levers matter more than model choice:

- **Start at capture.** Upload and analysis finish while the user picks a style, so the clock effectively starts at the style tap.
- **Stay warm.** Keep one worker warm and wake it when the page opens.
- **Show something early.** Stream partial images, or show a fast draft that the final replaces.
- **Spend money on demos.** Race two backends, or render every style speculatively at capture so any style tap is instant, at seven times the cost.

### 1.5 What makes it more than a wrapper

```
capture → normalise → face gate → identity pack → style recipe → render → refine → verify → deliver
```

Each stage has a typed input and output, a deadline and a fallback, so any stage can be swapped or skipped.

- **Identity pack:** computed once per photo. Aligned crops, landmarks and head pose, an expression vector, face embeddings, masks, and the attribute sheet.
- **Style recipe:** a versioned, declarative config per style. It names which identity channels to use and at what strength, prompts, exemplar images, the renderer, refine steps and pass thresholds. Comparing two approaches means running two recipes.
- **Trace:** per-stage duration, cost, model version and seed for every job.
- **Bench:** runs any set of recipes over a fixed, consented, demographically varied portrait set. It reports likeness, expression match, style consistency, latency at p50 and p95, cost and failure rate.

Three measurement traps:

- Do not score likeness with the same face network that conditioned the image, because the adapter optimises that very number. Use a second recogniser.
- Face similarity is meaningless for anime and brick styles. Use an attribute checklist plus human pairwise preference.
- Calibrate pass thresholds per style.

## 2. Shared skeleton (the same for every pathway)

### On the phone

- **Capture, two routes behind one interface.** The live viewfinder (getUserMedia) allows on-screen face guidance but needs HTTPS and often fails inside in-app browsers such as Instagram, TikTok and WeChat. The file input with the capture attribute opens the native camera or gallery, works almost everywhere and gives full sensor resolution, without live guidance. Detect capability and fall back.
- **Normalise.** Decode with EXIF orientation applied, redraw to a canvas (which strips metadata, including GPS), un-mirror selfies, and stay under the iOS canvas limit of about 16.7 megapixels.
- **Face gate.** An on-device detector (a MediaPipe-class model of a few megabytes) checks for exactly one face, plus size, angle, blur, lighting and occlusion, before any upload. It is the cheapest quality lever in the system and avoids paying for doomed requests.
- **Face-aware crop and compression.** Crop to head and shoulders with a generous margin, because hair matters for likeness. Resize the long edge to 1024–1536 px. Send landmarks and expression values alongside; the server re-verifies them.
- **Progress as a state machine.** Checking, uploading with a real percentage, analysing, queued with position, rendering with preview, refining, done, or a retryable failure. Persist the job ID so a reload or screen lock resumes; mobile browsers suspend connections in the background.
- **Network awareness.** Measure upload speed on the first request, since Safari lacks the Network Information API. Size the upload accordingly and fetch a display-sized result first.
- **Save and share** through the Web Share API with files, with long-press as fallback.
- **Consent** before the first upload, naming who processes the photo.

### On the server

- **Backend-for-frontend (BFF).** The only host the phone talks to. It holds every API key, validates and re-encodes uploads, runs moderation, creates jobs and returns signed result URLs. It also enforces rate limits and bot checks, because cost abuse is the main threat to a public generation endpoint.
- **Async jobs, even at 15 s.** An idempotent create call returns a job ID. Progress flows over SSE with polling as fallback; WebSocket is only needed for the realtime pathway. Mobile connections drop, retries must not double-charge, and cold starts must not hold a request open.
- **One job schema, two worker modes.** Push: the BFF calls an API or serverless endpoint. Pull: a worker behind NAT, such as a local GPU or Colab, long-polls the queue. This is what makes compute location swappable.
- **GPU scheduling.** One job per GPU at a time for predictable latency. Queue position gives the client an ETA, and jobs overflow to a fallback renderer when the ETA exceeds the budget.
- **Cold-start control.** Weights baked into the image or on a mounted volume, memory snapshots where offered, a warm replica during demo or peak windows, and a prewarm ping on page open.
- **Data handling.** Source photos and embeddings are short-lived, since face embeddings may count as biometric data in some jurisdictions. Results expire. Traces store metrics, not images, unless the user opts in.
- **Provenance.** Label outputs as AI-generated in metadata. EU and Chinese rules are moving this way; confirm what applies before launch.

### Path to a mobile app

Everything intelligent sits behind a versioned job API. The client is a capture adapter, a state machine and a result display. Each step is then incremental:

1. **PWA:** an installable shell.
2. **Capacitor wrapper:** the same HTML, with the capture adapter swapped for the native camera, plus native share, save-to-Photos and push.
3. **Native UI** against the same API, if ever needed.

Build these in from day one: capture behind an interface, token auth instead of cookies, absolute signed URLs, a state machine independent of the DOM, and no reliance on service-worker-only features.

App-store realities:

- A bare WebView wrapper risks rejection for minimum functionality.
- Apple requires disclosure and consent before personal data goes to third-party AI (guideline 5.1.2(i) as I recall it; I did not re-check the wording).
- Paid generations fall under in-app purchase rules.

## 3. Pathways

There are two independent choices: the rendering mechanism and where compute runs. Thirteen realistic combinations fall into four families.

### Family A: commercial in-context APIs

**A1. Thin proxy to one edit API.** The BFF forwards the selfie and a style prompt. The model encodes the reference into its own context and generates while attending to it.

| Model (Nov 2026) | Reported price near 1 MP | Note |
|---|---|---|
| OpenAI GPT Image 2 / 2.5 | ~$0.006 low, $0.05 medium, $0.21 high | 2.5 led the LMArena edit board in late September; has a face-preserving input-fidelity setting and partial-image streaming |
| Gemini 3.1 Flash Image | ~$0.07 | Pro tier ~$0.13 |
| Seedream 5.0 | ~$0.045 (sources conflict) | Multi-reference |
| FLUX.2 pro / klein | ~$0.03–0.045 / ~$0.015 | klein is the speed option; FLUX 3 Image reported in October |

Your "Seedance" key is a BytePlus/Volcengine Ark key. Seedream is the image model on that platform and Seedance is the video model.

Where it breaks:

- There is no numeric control over likeness, only prompt wording.
- Faces drift toward generic and flattering, more so as stylisation increases.
- Apparent minors and public-figure lookalikes get refused.
- Latency varies widely: reports for GPT Image 2 run from about 5–20 s at low quality to 40–120 s at high.
- Silent model updates change your look.
- Output sizes are fixed to a few aspect ratios.

**A2. Orchestrated commercial hybrid.** The stages are:

1. At capture, face analysis and a VLM-written attribute sheet run in parallel.
2. The recipe fills a prompt template from the sheet and assembles a multi-image request: the photo, a tight face crop for extra identity signal, and one or two style exemplars that pin a house look.
3. Two candidates render in parallel, optionally on two providers.
4. A verifier checks for one face, safety, embedding similarity against a per-style threshold and required attributes, then picks the winner.

Why it beats A1: words carry what attention drops at high abstraction, exemplars cut run-to-run variance, verification turns silent failures into selections, and hedging cuts tail latency.

Where it breaks:

- VLM calls add 1–3 s unless run speculatively.
- Attribute sheets can be generic or biased. Describe only visible traits and let users correct them.
- VLM providers restrict identifying real people. Use embeddings for "same person" and the VLM only for attributes.
- Cost multiplies with candidates.
- Iterative critique-and-re-edit loops raise quality but break the budget. Bounded parallel candidates are the form that fits.

The same orchestrator drives any Family B renderer. That pairing is your "VLM plus identity-locked pipeline" option.

### Family B: open-weight pipelines

**Mechanic B-i: adapter stack on an SDXL- or FLUX.1-class base.**

- A detector aligns the face and a recognition network produces the embedding.
- InstantID injects the embedding through extra cross-attention plus a ControlNet keyed on five facial points.
- PuLID adds CLIP face features and is trained so that identity insertion disturbs style and layout less.
- IP-Adapter FaceID and InfiniteYou are variations on the same idea.
- Style comes from a per-style LoRA or checkpoint, structure from light depth or pose control, speed from 4–8-step distillation, and a face-detailer pass finishes.

Where it breaks:

- Adapter weight and style weight fight each other. Start identity injection after the first 15–30% of steps and mask it to the face.
- Expression flattens. Add landmark control, or expression words derived from the phone's blendshape values.
- Hair and glasses go missing. Add the attribute sheet.
- Distilled sampling weakens fine control.
- Profile shots and occlusion degrade the embedding.

Licensing: these adapters depend on InsightFace's pretrained face models, which are released for non-commercial research only, with commercial licences sold separately. FLUX [dev] weights are also non-commercial by default. Both are fine for a demo and a blocker for a store app until resolved.

**Mechanic B-ii: open in-context edit models with style LoRAs.**

- **Models:** FLUX.1 Kontext, FLUX.2 (including the small klein models), Qwen-Image-Edit and its 2026 successor Qwen-Image 2.1, HunyuanImage 3.0 Instruct and others.
- **How they work:** like the commercial models, with reference latents in the same token sequence as the image being generated. There is no face-recognition dependency, and hair and accessories carry over.
- **Speed:** klein 4B distilled is reported at about 1.2 s per megapixel on an RTX 5090, and Z-Image-Turbo at about 2.3 s on a 4090. Edits with a reference image take longer.
- **The lever:** your own style LoRAs trained on photo-to-style pairs. Tens of curated pairs per style give a consistent look nobody else has.

Where it breaks:

- There is less likeness control than with adapters. LoRA weight is the main knob, trading under-stylisation against identity wash-out.
- Small models hold faces less faithfully.
- Some edit models shift framing or colour relative to the source.
- Several 2026 releases need a licence and quality check before I would rely on them.

**Pipeline definition: headless ComfyUI or code.** ComfyUI runs a workflow file through its HTTP and WebSocket API with step previews. New research lands there first, and the workflow doubles as the recipe, so swapping a stage means swapping a subgraph. The costs: custom nodes are arbitrary code (pin versions), there is no authentication (never expose it directly), and it runs one job at a time. A code-defined pipeline is typed, testable and faster to cold-start, but slower to adopt new methods. A sensible split is ComfyUI for exploration and the bench, then frozen images or code for production.

**Hosting options:**

- **B1. Managed open-model endpoints.** Marketplaces such as fal, Replicate and Runware expose adapter pipelines and open edit models pay-per-call, with their knobs, custom LoRA upload and often custom workflow deployment. There are no GPU operations and mostly no cold starts. This is the fastest way to get real knobs.
- **B2. Serverless GPU.** Your container on Modal, RunPod, Cerebrium, Koyeb or similar, billed per second. Modal lists an L40S at $0.000542/s, so a 6 s render costs about $0.003. Cold start is the central problem: 10–25 GB of weights means roughly 20–90 s unless you use snapshots, cached volumes or a warm replica, which is about $2/h for that L40S.
- **B3. Always-on GPU.** A rented pod or VM with no cold start and a fixed cost. RunPod lists A100-class pods at $1.19–2.09/h and H100 at $1.99–2.89/h; 24 GB consumer cards cost well under $1/h on marketplaces. One box is a single point of failure, so pair it with a fallback route. This is the obvious demo-day choice.
- **B4. Colab node.** The same stack in a notebook. Connect by inbound tunnel (a random URL per start, no SLA, and it exposes ComfyUI unless fronted) or, better, as a pull worker that needs no tunnel. Colab's FAQ disallows remote-control and "primarily via a web UI" use on free runtimes without paid compute units, caps free sessions at 12 h, reclaims idle sessions and guarantees no GPU type. Pro+ adds background execution up to 24 h. It is an excellent free ablation lab and a poor demo backend.
- **B5. Local GPU with cloud burst.** Your own GPU runs the pull worker. The BFF routes to it first and overflows to B1 or B2. Marginal cost is zero for development and benchmarking. For an in-room demo, a LAN-only mode removes the internet dependency. The live camera needs HTTPS, so use a real certificate on a LAN hostname or the file-input route.

### Family C: composites

**C1. Two-stage hybrid.** Three forms:

- **Style first:** a commercial model produces the stylised image, then a self-hosted pass re-diffuses the face crop with identity conditioning and a matching style LoRA.
- **Identity first:** a self-hosted adapter produces a clean, well-lit intermediate portrait that a stylising model then transforms. This helps with poor selfies.
- **Parallel ensemble:** both families run at once and the verifier chooses.

Where it breaks:

- Style-first needs a detectable face, so it does nothing for brick or extreme anime.
- A mismatched LoRA gives a "sticker face".
- Seams and lighting mismatches appear at the mask edge.
- Stage latencies add up to the edge of the budget.

**C2. Template library plus identity insertion.**

- **Offline:** art-direct and curate templates per style at maximum quality, tagged by head pose and framing.
- **Online:** pick the template matching the user's pose and re-diffuse only the head region with identity conditioning, which takes 2–4 s.

Runtime is small and predictable, and every composition was pre-approved. Where it breaks:

- Compositions repeat across users, which is noticeable in a group.
- The user's own hair, clothing and pose are lost.
- Overlay risk is the highest of any route if blending is naive.
- Covering skin tones, ages, hair types, headwear and glasses becomes a content-operations burden.

It works well as a guaranteed-beautiful fallback tier.

### Family D: unconventional

- **D1. Parametric scaffold plus diffusion skin.** The phone's landmarker gives a face mesh, expression values and discrete attributes. These drive a stylised rig, such as a brick figure with head print, hair piece and torso, or a toon bust. The rig is rendered in WebGL, optionally followed by a diffusion pass for materials and lighting. For extreme abstraction, identity becomes deterministic attribute mapping, expression transfers exactly, preview is instant and the result is animatable. The costs are a 3D asset pipeline per style and a limited vocabulary; painterly styles gain nothing.
- **D2. Realtime stylised viewfinder, then finalise.** Camera frames stream to a few-step model and the viewfinder itself is stylised. On shutter, any pathway above produces the final. Commercial options exist: Decart's realtime API runs over WebRTC and launched at 20 fps at 768×432, and fal exposes realtime sockets for klein-class models. Perceived latency is near zero and demo impact is the strongest of any route. Likeness in the stream is weak, GPU cost scales with viewing time instead of images, and mobile uplink and in-app-browser WebRTC are fragile.
- **D3. On-device feed-forward stylisers.** Small per-style networks or shaders over WebGPU or WASM run in under a second, free, private and offline. They only use the structure channel, so style is shallow and clay, brick and knight are out of reach. Their role is an instant placeholder and privacy fallback. Diffusion in a mobile browser tab is not practical yet.
- **D4. Per-user LoRA as an async premium tier.** Eight to twenty photos and a few minutes of training give the best likeness across poses and scenes. This is how the 2022-era avatar-pack apps worked. It sits outside the 15 s loop and stores a personal model, which needs explicit consent and deletion.
- **Add-on: living avatar.** Feed the stylised still to an image-to-video model as an async bonus. Seedance 2.0 is about $0.30 per output second on fal's list, so about $1.50 for 5 s. Seedance 2.0 restricts real human faces in reference inputs. A stylised avatar is more likely to pass than a selfie, but test it.

### Boundary and mobile deltas per pathway

| Pathway | Extra on the phone | Extra on the server | Carry-over to an app |
|---|---|---|---|
| A1 | None | Key proxy, job store | Complete |
| A2, B1 | Landmarks sent with upload | Orchestrator, CPU face analysis, verifier | Complete |
| B2, B3 | Same | GPU workers, queue, warm-pool control | Complete |
| B4 | Same | Pull-worker protocol | Lab only |
| B5 | HTTPS workaround for LAN mode | Router with burst policy | Complete; local node optional |
| C1 | Same | Two-stage coordination, masks | Complete |
| C2 | Pose hints to match templates | Template index, insertion worker | Complete; templates can ship in-app |
| D1 | Landmarker, WebGL rig | Optional skin pass | Strongest: rig moves to native 3D |
| D2 | WebRTC stream, adaptive bitrate | Per-session GPU, relay servers | Better native; WebView WebRTC is the weak spot |
| D3 | Model download, local inference | None | Ports to Core ML or LiteRT |
| D4 | Multi-photo capture | Training queue, per-user model store | Complete; needs push |

## 4. Trade-off matrix

Quality and speed:

| Pathway | Identity ceiling | Style range | Cold start | Warm latency |
|---|---|---|---|---|
| A1 Thin API proxy | Med–High, no knobs | Widest | None | 5–20 s fast tier |
| A2 Orchestrated APIs | High | Widest | None | 8–18 s |
| B1 Managed open endpoints | Med–High | Wide | 0–30 s, occasional | 3–10 s |
| B2 Serverless GPU | High | Wide (your LoRAs) | 20–90 s unless warm | 3–10 s |
| B3 Always-on GPU | High | Wide | None once booted | 3–10 s |
| B4 Colab node | High | Wide | Minutes, manual | 5–20 s |
| B5 Local plus burst | High | Wide | None while on | 3–10 s |
| C1 Two-stage hybrid | Highest from one photo | Widest | As its hosted stage | 10–25 s |
| C2 Templates | High face, low hair and body | Narrow, art-directed | As hosting | 2–6 s |
| D1 Parametric rig | Attribute-level | Narrow per rig | None | Instant, plus 3–8 s skin |
| D2 Realtime stream | Low in stream | Wide, shallow | 2–10 s session setup | 50–150 ms per frame |
| D3 On-device | Structure only | Narrow, shallow | One model download | Under 1 s |
| D4 Per-user LoRA | Highest overall | Widest | Minutes of training | 3–10 s after |

Economics and operations:

| Pathway | Unit cost | Live-demo reliability | Defensibility | Complexity |
|---|---|---|---|---|
| A1 | $0.01–0.07 per image | High; refusals and spikes | Low | Lowest |
| A2 | $0.05–0.20 | Highest managed | Medium | Medium |
| B1 | $0.01–0.05 | Med–High | Medium | Low–Med |
| B2 | ~$0.003–0.01, plus ~$2/h warm | Medium; High with warm replica | High | High |
| B3 | Fixed ~$0.3–3/h | Med–High; single box | High | Med–High |
| B4 | Free to ~$1/h | Low | Lab only | Medium, fragile |
| B5 | Near zero, plus burst | Medium; High in LAN mode | High | Med–High |
| C1 | $0.03–0.10 | Medium in series; High as ensemble | High | Highest |
| C2 | Under $0.01 | High | Medium (content library) | Medium, content-heavy |
| D1 | Near zero | Very high | Very high | Very high |
| D2 | GPU time per viewing second | Low–Med on mobile | Med–High | High |
| D3 | Zero | Very high | Low–Med | Medium |
| D4 | ~$0.5–3 per user (estimate) | Medium | Med–High | High |

Breakeven for self-hosting against a $0.04 API image: an always-on 24 GB GPU at about $300 a month needs roughly 7,500 images a month. A serverless L40S held warm around the clock (about $1,400 a month) needs about 35,000. Below that, self-hosting buys control and defensibility, not savings.

## 5. Strategic synthesis

- **Fastest rock-solid prototype: A2 in its lightest form.** BFF, job API, face gate, upload at capture, one fast-tier commercial renderer chosen by bake-off, and a second provider as hedge. You already hold both keys (OpenAI, and Seedream through the Ark key), and there are no GPUs to run. The weakness is likeness control, which the verifier and best-of-two partly cover.
- **Highest ceiling: B-ii on a warm GPU under the A2 orchestrator, with C1 as a parallel ensemble.** Host on B3 for demos and B2 at scale. Your own style LoRAs supply the house look, an identity-aware face detailer restores likeness, a commercial model races alongside and the verifier chooses. Add D2 if demo impact matters most. It costs weeks of LoRA training and GPU operations.
- **Best cost-to-quality: B1, moving to B3 or B2 on volume.** A few-step open edit model plus your LoRAs through a managed endpoint costs about $0.01–0.03. C2 templates serve as a cheap fallback.

These are stages of one build, because the orchestrator, job API, recipes and bench are shared. Suggested order:

1. Skeleton plus A1 with two providers.
2. Bench, then a bake-off of four or five renderers across your seven styles on 20–30 consented portraits.
3. Per-style recipes on the winners.
4. A pull worker on Colab or a local GPU to ablate open pipelines.
5. Promotion to B3 or B2 only if they win.

Demo-day hardening on any route: a warm worker, two independent render routes, a tested phone and browser, the file-input capture fallback, a tethered or LAN network plan, and best-of-two with a regenerate option.

## 6. Decisions I need from you

1. **Demo or product first?** Give the date, audience size and venue network. Default: live demo first on a product-ready architecture.
2. **Commercial licensing now or later?** May v1 use non-commercial components (InsightFace-based adapters, FLUX [dev])? Default: allowed in the lab, excluded from the shipped path.
3. **Where may face photos go?** Are OpenAI, Google and ByteDance acceptable? Any region limits? Are minors in scope? Default: third-party APIs with a consent notice, adults only, short retention.
4. **What exactly is the 15 s contract?** A hard p95 from style tap to final, or a preview within 5 s and the final within 20 s? Default: p50 under 12 s and p95 under 20 s from style tap, with a streamed preview.
5. **Likeness or style when they conflict?** Is attribute-level likeness acceptable for anime and brick styles? Default: yes for those two, geometry-level for the rest.
6. **Output spec.** Aspect and framing (1:1 avatar, 3:4 bust or 9:16 poster), 1K or 2K, one result or pick-from-two, fixed style list or free-text styles. Default: 3:4 bust near 1K, pick-from-two, the fixed seven.
7. **Budget and volume.** Acceptable cost per generation, fixed monthly spend, expected daily volume. Default: up to $0.10 per generation and no fixed GPU spend until volume justifies it.
8. **GPU operations appetite.** Do you have a local GPU, and which one? Will you run workers? Default: fully managed for v1, Colab as the lab.
9. **Input policy.** One selfie or several (several improves likeness a lot)? Live capture only, or gallery uploads too, which raises third-party-photo misuse? Default: one selfie, both sources, with a consent line.
10. **Ablation as feature or tooling?** Should side-by-side pipeline comparison be visible in the demo? Default: internal bench plus a hidden compare mode.
11. **Extensions in v1?** Animated avatar via Seedance, realtime stylised viewfinder. Default: both later.
12. **Style naming.** Brand names such as "Lego" or studio names in the UI and prompts carry trademark and refusal risk. Default: generic names ("brick figure", "3D toon").

Answer these, or say "defaults", and the next step is locking the stack and writing the implementation plan.
