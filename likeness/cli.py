"""likeness: one command for the studio.

  serve        start the studio and print how the phone reaches it
  export-web   write the recipes the app's Lab shows (web/data/recipes.json)
  probe        describe this machine
  fetch        download models from models/manifest.toml
  smoke        render a few plates end to end
  matrix       time loading strategies and sizes
  enrol        turn a folder of your photographs into a training set (stays in private/)
  train-config write the ai-toolkit config for a LoRA of your face, with this machine's paths
  lora-check   judge a trained LoRA on photographs it has not seen, and adopt it if it helps
  relay        run a relay packet
"""

from __future__ import annotations

import argparse
import json
import socket
import sys
from pathlib import Path

from . import __version__, paths


def _lan_address() -> str:
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("10.255.255.255", 1))
        return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def _write(report: dict, out: str | None) -> None:
    text = json.dumps(report, indent=2)
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(text, encoding="utf-8")
    print(text)


def serve(args) -> int:
    import uvicorn

    from . import engines
    from .server import create_app, pairing_key

    engine = engines.create(args.engine)
    app = create_app(engine, open_door=args.open)
    local, phone = f"http://127.0.0.1:{args.port}/", f"http://{_lan_address()}:{args.port}/?pair={pairing_key(paths.home())}"
    print(f"\n  Likeness {__version__}  ·  engine: {engine.id} ({engine.kind})\n\n  On this machine   {local}\n  On your phone     {phone}\n")
    try:
        import segno

        segno.make(phone, error="m").terminal(compact=True, border=2)
    except Exception:
        pass
    print("  The phone must be on the same network. Scan the code once; it stays paired.\n  Ctrl+C stops the studio.\n", flush=True)
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
    return 0


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):   # Windows consoles default to a code page that cannot print ×, · or a QR block
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    parser = argparse.ArgumentParser(prog="likeness", description="Likeness: a personal portrait studio.")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("serve", help="start the studio")
    p.add_argument("--engine", default="auto", help="auto, mock, qwen21_turbo, flux3_klein (default: auto)")
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--port", type=int, default=8787)
    p.add_argument("--open", action="store_true", help="let any device on the network in without pairing")

    sub.add_parser("export-web", help="write web/data/recipes.json from the recipes")
    p = sub.add_parser("probe", help="describe this machine")
    p.add_argument("--out")
    p.add_argument("--require-gpu", action="store_true", help="fail unless PyTorch can use a CUDA device")
    p = sub.add_parser("fetch", help="download models")
    p.add_argument("names", nargs="*", help="models from models/manifest.toml (default: all marked default)")
    p.add_argument("--out")
    for name, text in (("smoke", "render a few plates end to end"), ("matrix", "time loading strategies and sizes")):
        p = sub.add_parser(name, help=text)
        p.add_argument("--engine", default="auto")
        p.add_argument("--out", default="private/" + name)
        p.add_argument("--photo", action="append", default=[], help="a photograph to use (kept out of the report's pictures)")
        p.add_argument("--worlds", default="clay,noir")
    p = sub.add_parser("enrol", help="turn a folder of your photographs into a training set")
    p.add_argument("--from", dest="source", default="", help="the folder of photographs (default: private/enrol/in)")
    p.add_argument("--trigger", default="ohwx person", help="the words that will stand for you in a prompt")
    p.add_argument("--size", type=int, default=1024)
    p.add_argument("--out", help="also write the counts (no file names) here")
    p = sub.add_parser("train-config", help="write the ai-toolkit config for the likeness LoRA")
    p.add_argument("--name", default="likeness_v1")
    p = sub.add_parser("lora-check", help="judge a trained LoRA on held-out photographs")
    p.add_argument("--engine", default="auto")
    p.add_argument("--lora", default="", help="the trained .safetensors file; it is copied in as the candidate")
    p.add_argument("--trigger", default="")
    p.add_argument("--worlds", default="clay,oil,cinema,noir")
    p.add_argument("--out", default="private/lora/check")
    p.add_argument("--adopt", action="store_true", help="adopt the LoRA if it passes")
    p = sub.add_parser("relay", help="run a relay packet")
    p.add_argument("action", choices=["run", "pending"])
    p.add_argument("packet", nargs="?", default="")
    p.add_argument("--only", action="append")

    args = parser.parse_args(argv)
    if args.command == "serve":
        return serve(args)
    if args.command == "export-web":
        from . import recipes

        print(recipes.export_web())
        return 0
    if args.command == "relay":
        from . import relay

        if args.action == "pending":
            print("\n".join(p.name for p in relay.pending()) or "No pending packets.")
            return 0
        waiting = relay.pending()
        if not args.packet and not waiting:
            print("No pending packets.")
            return 0
        status = relay.run(args.packet or waiting[0].name, args.only)
        return 0 if not status["stopped_at"] else 1

    from . import workstation

    if args.command == "probe":
        report = workstation.probe()
        _write(report, args.out)
        return 1 if args.require_gpu and not report["torch"].get("cuda") else 0
    if args.command == "enrol":
        from . import enrol, faces

        tools = faces.load(paths.home() / "models" / "faces")
        if tools is None:
            print("The face models are not installed. Run  uv run likeness fetch faces  first.")
            return 1
        source = Path(args.source) if args.source else paths.home() / "enrol" / "in"
        source.mkdir(parents=True, exist_ok=True)
        report = enrol.build(source, paths.home(), tools, args.trigger, args.size)
        _write(report, args.out)
        return 0 if report["enough"] else 1
    if args.command == "train-config":
        from . import enrol

        print(enrol.write_config(paths.home(), args.name).as_posix())
        return 0
    if args.command == "lora-check":
        report = workstation.lora_check(args.engine, Path(args.out), args.worlds.split(","), Path(args.lora) if args.lora else None, args.trigger, args.adopt)
        print(json.dumps(report, indent=2))
        return 0
    if args.command == "fetch":
        rows = workstation.fetch(args.names or None)
        _write({"models": rows}, args.out)
        return 0 if all(r["ok"] for r in rows) else 1
    fixtures = sorted((paths.ROOT / "tests" / "fixtures" / "sitters").glob("*.jpg"))
    photos = [Path(p) for p in args.photo] or fixtures[:2]
    if args.command == "smoke":
        report = workstation.smoke(args.engine, Path(args.out), photos, args.worlds.split(","), private=bool(args.photo))
        print(json.dumps({k: v for k, v in report.items() if k != "renders"} | {"renders": [{k: v for k, v in r.items() if k != "trace"} for r in report["renders"]]}, indent=2))
        return 0 if report["renders"] and all(r.get("ok") for r in report["renders"]) else 1
    report = workstation.matrix(args.engine, Path(args.out), photos[0])
    print(json.dumps(report, indent=2))
    return 0 if any(r.get("ok") for r in report["rows"]) else 1
