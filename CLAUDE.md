# CLAUDE.md

Notes for Claude working in this repository on the Linux machine (2 cores, no GPU).

## The shape of the project

- `web/` is the app: plain HTML, CSS and ES modules, no build step, designed on a 9:16 stage sized in `cqw`.
- `likeness/` is the studio server (FastAPI) for the user's Windows RTX 5090 laptop. Nothing GPU-bound can run here; the simulator engine (`--engine mock`) stands in.
- The two machines never connect. GPU work is handed over as relay packets (`relay/README.md`); Codex runs them on the laptop and pushes a `REPORT.md` back.

## When a report comes back

`git pull`, then read `relay/<packet>/REPORT.md` and `relay/<packet>/out/RUN.md` before anything else. Look at the contact sheets in `out/`. Fix what the report asks for here, and answer its questions in the next packet or commit.

## Checks to run before every push

```
npm run check            # tsc over JSDoc, no emit
uv run pytest            # the studio (the face tests skip unless private/models/faces exists)
npm test                 # Playwright, system Chrome, fake camera: showcase and live-simulator projects
```

The browser suite takes about six minutes on this machine. One Chrome at a time: do not run it alongside other browser work.

## House rules

- Three editions, always labelled honestly: Showcase (the atelier draws studies on the device), Live · Simulator, Live · Workstation. Never let a simulated number or a drawn study pass for a render.
- Nothing personal is committed: no photographs or renders of real people, no weights, no tokens. Test faces are the drawn house sitters (`npm run fixtures`).
- No GitHub Actions workflow files: the token on this machine has no `workflow` scope.
- `web/data/recipes.json` is generated: `uv run likeness export-web` after touching `likeness/worlds/*.toml` or `likeness/recipes.py`.
