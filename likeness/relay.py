"""The relay: numbered packets of work for the workstation, run stage by stage with every result written down.

A packet is a folder in relay/ holding PROMPT.md (for the agent), task.toml (for this runner) and, after a
run, out/ (logs, numbers, sheets) and REPORT.md (the agent's account). Stages run in order; a failed gate
stops the run so that nothing downstream wastes an hour.
"""

from __future__ import annotations

import datetime
import json
import re
import subprocess
import time
import tomllib
from pathlib import Path

from . import paths

REPORT = """# Report: {title}

Packet {id}. Fill this in after  uv run likeness relay run {id}  and commit it with the out/ folder.

## Summary

(Two or three sentences: what ran, what the numbers say, what blocks the next step.)

## Changes made

(Every file edited on the workstation and why. "None" if none.)

## Questions for Claude

(Anything that needs a decision. "None" if none.)

## Run

See out/RUN.md for the stage table and log tails; it is rewritten by every run.
"""


def find(packet: str, root: Path | None = None) -> Path:
    matches = sorted(p for p in (root or paths.RELAY).glob(f"{packet}*") if (p / "task.toml").exists())
    if len(matches) != 1:
        raise SystemExit(f"Expected one packet matching '{packet}' in relay/, found {len(matches)}.")
    return matches[0]


def pending(root: Path | None = None) -> list[Path]:
    """Packets that have never been run to the end, oldest first. A packet marked  optional = true  waits to be asked for."""
    packets = sorted(p for p in (root or paths.RELAY).iterdir() if (p / "task.toml").exists())
    return [p for p in packets if not _status(p).get("finished") and not tomllib.loads((p / "task.toml").read_text(encoding="utf-8")).get("optional")]


def _status(folder: Path) -> dict:
    path = folder / "out" / "status.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def _scrub(text: str, cwd: Path) -> str:
    """Logs are committed, so the repository's own path is written as "." and the home folder as "~", in either slash style."""
    for found, shown in ((str(cwd), "."), (cwd.as_posix(), "."), (str(Path.home()), "~"), (Path.home().as_posix(), "~")):
        if len(found) > 3:
            text = text.replace(found, shown)
    text = text.replace("\r\n", "\n")
    return re.sub(r"[^\n]*\r(?!\n)", "", text)   # a progress bar redraws its line thousands of times; keep each line's last state


def run(packet: str, only: list[str] | None = None, root: Path | None = None, cwd: Path | None = None) -> dict:
    """Runs a packet's stages in order. A stage is an argument list (no shell); "{root}" in an argument stands for the
    repository, and an optional  cwd  runs the stage in a folder of it."""
    folder = find(packet, root)
    task, out, cwd = tomllib.loads((folder / "task.toml").read_text(encoding="utf-8")), folder / "out", cwd or paths.ROOT
    out.mkdir(exist_ok=True)
    rows, stopped = [], ""
    for stage in task["stage"]:
        if only and stage["id"] not in only:
            continue
        row = {"id": stage["id"], "command": " ".join(stage["run"]), "gate": stage.get("gate", True)}
        if stopped:
            rows.append({**row, "state": "not run", "seconds": 0, "why": f"stopped at {stopped}"})
            continue
        started, log = time.perf_counter(), out / f"{stage['id']}.log"
        command, where = [part.replace("{root}", cwd.as_posix()) for part in stage["run"]], cwd / stage["cwd"] if stage.get("cwd") else cwd
        print(f"[relay] {stage['id']}: {row['command']}", flush=True)
        try:
            with log.open("w", encoding="utf-8", errors="replace") as sink:
                code = subprocess.run(command, cwd=where, stdout=sink, stderr=subprocess.STDOUT, timeout=stage.get("timeout", 3600)).returncode
            why = "" if code == 0 else f"exit code {code}"
        except subprocess.TimeoutExpired:
            code, why = -1, f"timed out after {stage.get('timeout', 3600)} s"
        except OSError as error:
            code, why = -1, str(error)
        if log.exists():
            log.write_text(_scrub(log.read_bytes().decode("utf-8", errors="replace"), cwd), encoding="utf-8", newline="\n")
        missing = [e for e in stage.get("expect", []) if not (cwd / e).exists()]
        if code == 0 and missing:
            code, why = 1, "missing: " + ", ".join(missing)
        row.update(state="passed" if code == 0 else "failed", seconds=round(time.perf_counter() - started, 1), why=why)
        rows.append(row)
        print(f"[relay] {stage['id']}: {row['state']} in {row['seconds']} s {why}", flush=True)
        if code != 0 and row["gate"]:
            stopped = stage["id"]
    status = {"id": task["id"], "when": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "finished": not stopped and not only, "stopped_at": stopped, "stages": rows}
    (out / "status.json").write_text(json.dumps(status, indent=2), encoding="utf-8")
    lines = [f"# Run: {task['id']}", "", f"{status['when']}. " + ("All gates passed." if not stopped else f"Stopped at **{stopped}**."), "", "| Stage | State | Seconds | Note |", "|---|---|---|---|"]
    lines += [f"| {r['id']} | {r['state']} | {r['seconds']} | {r['why']} |" for r in rows]
    for r in rows:
        log = out / f"{r['id']}.log"
        if log.exists():
            tail = log.read_text(encoding="utf-8", errors="replace").splitlines()[-25:]
            lines += ["", f"## {r['id']}", "", "~~~", *tail, "~~~"]
    (out / "RUN.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    if not (folder / "REPORT.md").exists():
        (folder / "REPORT.md").write_text(REPORT.format(id=task["id"], title=task.get("title", task["id"])), encoding="utf-8")
    return status
