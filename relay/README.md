# The relay

Two machines build Likeness, and they never talk to each other. The Linux machine where the code is written has no GPU; the Windows laptop with the RTX 5090 is where anything real is rendered or trained. **GitHub is the only channel between them.** Work for the laptop travels as a numbered packet in this folder, and the evidence travels back the same way.

```
relay/NNNN-slug/
  PROMPT.md     what to do and why, for the agent on the laptop (Codex). Self-contained.
  task.toml     the stages, for the runner: argument lists, timeouts, gates, files to expect
  out/          written by the runner: one log per stage, status.json, RUN.md, and the reports each stage makes
  REPORT.md     written by the agent afterwards: what happened, what was changed, what needs deciding
```

## One cycle

1. Claude writes a packet on the Linux machine and pushes it.
2. On the laptop the user pulls, opens Codex in the repository **with full access** (network and GPU) and says:

   > Read AGENTS.md, then carry out relay/0001-workstation-bringup/PROMPT.md.

3. Codex follows the prompt. The heavy lifting is one command, `uv run likeness relay run <id>`, which runs the stages in order, stops at the first failed gate and writes everything down.
4. Codex fills in `REPORT.md`, commits the packet folder and pushes.
5. Claude pulls, reads `REPORT.md` and `out/RUN.md`, and writes the next change or the next packet.

Each cycle costs the user's time, so packets are staged (later stages run only if earlier ones pass) and broad (one packet answers several questions).

## The packets

| Packet | What it is for | When |
|---|---|---|
| `0001-workstation-bringup` | Install the GPU environment, download the models, prove the real engine with renders and timings, show the studio running | First. Everything else waits for it. |
| `0002-likeness-lora` | Train a LoRA of the user's own face with ai-toolkit, measure whether it helps, adopt it only if it does | Later, when the user asks. Optional. |

## The runner

```
uv run likeness relay pending            packets not yet run to the end (optional ones are not listed)
uv run likeness relay run 0001           run a packet
uv run likeness relay run 0001 --only smoke --only matrix     repeat chosen stages
```

A stage in `task.toml`:

```toml
[[stage]]
id = "smoke"
run = ["uv", "run", "likeness", "smoke", "--engine", "qwen21_turbo"]   # an argument list; no shell, so it reads the same on Windows and Linux
timeout = 3600          # seconds (default 3600)
gate = true             # default: a failure stops the run. false: report it and carry on
expect = ["relay/0001-workstation-bringup/out/smoke/sheet-qwen21_turbo.jpg"]   # files that must exist afterwards, from the repository root
cwd = "workstation/ai-toolkit"    # optional: a folder of the repository to run in
```

`{root}` in an argument stands for the repository's path. Logs are committed, so the runner rewrites the repository's path as `.` and the home folder as `~` in them, and keeps only the last state of each progress bar.

## What never travels

Photographs and renders of real people, model weights, LoRAs, tokens and pairing keys. They live in `private/` and `workstation/`, which git ignores. Reports carry numbers; the only pictures that are committed are of the drawn test sitters in `tests/fixtures/sitters/`.
