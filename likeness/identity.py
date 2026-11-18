"""A LoRA of the sitter's own face, when one has been trained: where it lives, and whether it has earned its place.

A freshly trained LoRA is a candidate (private/lora/candidate.safetensors). It is adopted, and from then
on used for every identity-locked render, only after  likeness lora-check  has shown that it brings
renders closer to photographs it was never trained on. Nothing here is ever committed.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

ADOPTED, CANDIDATE = "likeness", "candidate"
GAIN, SLIP = 0.03, 0.05   # adopt when the mean likeness gain is at least GAIN and no world loses more than SLIP


def _read(home: Path, name: str) -> dict | None:
    weights, note = home / "lora" / f"{name}.safetensors", home / "lora" / f"{name}.json"
    if not weights.exists():
        return None
    meta = json.loads(note.read_text(encoding="utf-8")) if note.exists() else {}
    return {**meta, "path": str(weights), "trigger": meta.get("trigger", "")}


def personal(home: Path) -> dict | None:
    """The adopted LoRA as {"path", "trigger", ...}, or None when there is none."""
    return _read(home, ADOPTED)


def candidate(home: Path) -> dict | None:
    return _read(home, CANDIDATE)


def register(home: Path, weights: Path, trigger: str, **meta) -> dict:
    """Copies a freshly trained LoRA in as the candidate."""
    folder = home / "lora"
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"{CANDIDATE}.safetensors"
    if weights.resolve() != target.resolve():
        shutil.copyfile(weights, target)
    (folder / f"{CANDIDATE}.json").write_text(json.dumps({"trigger": trigger, **meta}, indent=2), encoding="utf-8")
    return candidate(home)


def adopt(home: Path, **meta) -> dict:
    """The candidate becomes the sitter's LoRA."""
    folder = home / "lora"
    note = folder / f"{CANDIDATE}.json"
    shutil.copyfile(folder / f"{CANDIDATE}.safetensors", folder / f"{ADOPTED}.safetensors")
    kept = json.loads(note.read_text(encoding="utf-8")) if note.exists() else {}
    (folder / f"{ADOPTED}.json").write_text(json.dumps({**kept, **meta}, indent=2), encoding="utf-8")
    return personal(home)


def check(studio, photos: list[Path], lora: dict, worlds: list[str], seed: int = 7, keep=None) -> dict:
    """Renders each held-out photograph in each world without and with the LoRA, on the same seed, and compares
    the face similarity of each pair. keep(photo, world, label, plate_path) is told about every plate."""
    rows = []
    for photo in photos:
        seated = studio.seat(photo.read_bytes())
        for world in worlds:
            pair = {}
            for label, own in (("without", None), ("with", lora)):
                record = studio.develop(seated["id"], world, "locked", seed=seed, personal=own)
                pair[label] = record["similarity"] if record["measure"] == "face" else None
                if keep:
                    keep(photo, world, label, studio.store.plate(record["id"]))
            rows.append({"world": world, **pair})

    def mean(values: list[float]) -> float:
        return round(sum(values) / len(values), 3)

    by_world = {}
    for world in worlds:
        pairs = [r for r in rows if r["world"] == world and r["without"] is not None and r["with"] is not None]
        entry = {"pairs": len(pairs), "without": None, "with": None, "delta": None}
        if pairs:
            entry.update({"without": mean([r["without"] for r in pairs]), "with": mean([r["with"] for r in pairs])})
            entry["delta"] = round(entry["with"] - entry["without"], 3)
        by_world[world] = entry
    scored = [w for w in by_world.values() if w["delta"] is not None]
    overall = round(sum(w["delta"] * w["pairs"] for w in scored) / sum(w["pairs"] for w in scored), 3) if scored else None
    helps = overall is not None and overall >= GAIN and all(w["delta"] > -SLIP for w in scored)
    return {
        "photos": len(photos), "worlds": by_world, "delta": overall, "helps": helps,
        "rule": f"adopt when the mean gain in face similarity is at least {GAIN} and no world loses more than {SLIP}",
    }
