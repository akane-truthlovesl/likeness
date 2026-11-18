"""Enrolment: a folder of your photographs becomes a training set, without leaving this machine.

Each photograph is checked (one face, large enough, the same person as the others), cropped around
the face at one of three framings, and captioned with the trigger words. A few are held back and never
trained on, so that a LoRA can be judged on pictures it has not seen. Everything is written under
private/enrol/; what is printed, and may end up in a relay log, is counts only.
"""

from __future__ import annotations

import json
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps

from . import paths

FRAMINGS = (("close-up portrait", 0.5), ("head and shoulders portrait", 0.36), ("portrait, upper body", 0.26))   # caption, face width as a share of the crop
READABLE = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
TRIGGER, TEMPLATE = "ohwx person", "likeness-lora.qwen21-turbo.yaml"
SMALLEST_FACE, STRANGER = 140, 0.25


def _crop(image: Image.Image, face, share: float, size: int) -> tuple[Image.Image, float]:
    """A square around the face, as wide as the framing asks or as the photograph allows. Never upscaled."""
    cx, cy = (face.box[0] + face.box[2]) / 2, (face.box[1] + face.box[3]) / 2
    side = int(min(face.width / share, image.width, image.height))
    left = int(min(max(cx - side / 2, 0), image.width - side))
    top = int(min(max(cy - side * 0.44, 0), image.height - side))   # the face sits a little above the middle
    crop = image.crop((left, top, left + side, top + side))
    return (crop.resize((size, size), Image.Resampling.LANCZOS) if side > size else crop), face.width / side


def build(source: Path, home: Path, tools, trigger: str = TRIGGER, size: int = 1024, minimum: int = 8) -> dict:
    """Builds private/enrol/{dataset,holdout} from the photographs in source. Returns counts; names stay in enrol.json."""
    root = home / "enrol"
    dataset, holdout = root / "dataset", root / "holdout"
    for folder in (dataset, holdout):
        shutil.rmtree(folder, ignore_errors=True)
        folder.mkdir(parents=True)
    accepted, rejected = [], []
    for path in sorted(p for p in source.iterdir() if p.is_file()) if source.is_dir() else []:
        if path.suffix.lower() not in READABLE:
            rejected.append({"file": path.name, "why": "not a JPEG, PNG or WebP (export HEIC photographs as JPEG first)"})
            continue
        try:
            image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        except OSError:
            rejected.append({"file": path.name, "why": "could not be opened as a picture"})
            continue
        found = tools.detect(image)
        if not found:
            rejected.append({"file": path.name, "why": "no face found"})
        elif len(found) > 1 and found[1].width > found[0].width * 0.6:
            rejected.append({"file": path.name, "why": "more than one face"})
        elif found[0].width < SMALLEST_FACE:
            rejected.append({"file": path.name, "why": f"the face is under {SMALLEST_FACE} px wide"})
        else:
            accepted.append({"path": path, "face": found[0], "vector": tools.embed(image, found[0])})

    # The same person throughout: a photograph whose face resembles none of the others is set aside.
    if len(accepted) >= 3:
        vectors = tools.np.stack([a["vector"] for a in accepted])
        alike = vectors @ vectors.T
        for i, a in enumerate(accepted):
            a["cohesion"] = float((alike[i].sum() - 1) / (len(accepted) - 1))
        for a in [a for a in accepted if a["cohesion"] < STRANGER]:
            rejected.append({"file": a["path"].name, "why": "looks like a different person from the rest"})
        accepted = [a for a in accepted if a["cohesion"] >= STRANGER]

    count = len(accepted)
    held = 0 if count < minimum else max(1, min(4, round(count * 0.15)))
    held_at = {round((j + 0.5) * count / held) for j in range(held)} if held else set()
    trained = 0
    for i, a in enumerate(accepted):
        image = ImageOps.exif_transpose(Image.open(a["path"])).convert("RGB")
        if i in held_at:
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            image.save(holdout / f"{len(list(holdout.glob('*.jpg'))) + 1:03d}.jpg", quality=93)
            continue
        crop, share = _crop(image, a["face"], FRAMINGS[trained % len(FRAMINGS)][1], size)
        framing = min(FRAMINGS, key=lambda f: abs(f[1] - share))[0]
        trained += 1
        crop.save(dataset / f"{trained:03d}.jpg", quality=95)
        (dataset / f"{trained:03d}.txt").write_text(f"a photo of {trigger}, {framing}", encoding="utf-8")

    cohesion = [a["cohesion"] for a in accepted if "cohesion" in a]
    report = {
        "trigger": trigger, "seen": count + len(rejected), "accepted": count, "trained_on": trained, "held_out": len(held_at),
        "rejected": dict(Counter(r["why"] for r in rejected)), "cohesion": {"mean": round(sum(cohesion) / len(cohesion), 3), "lowest": round(min(cohesion), 3)} if cohesion else None,
        "enough": trained >= minimum, "advice": "" if trained >= minimum else f"Add photographs: {minimum} usable ones are the least that trains, 15 to 25 is better. Vary light, angle and expression.",
    }
    root.mkdir(parents=True, exist_ok=True)
    (root / "enrol.json").write_text(json.dumps({**report, "rejected_files": rejected, "dataset": str(dataset), "holdout": str(holdout)}, indent=2), encoding="utf-8")
    return report


def enrolled(home: Path) -> dict:
    path = home / "enrol" / "enrol.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def write_config(home: Path, name: str = "likeness_v1") -> Path:
    """Writes the ai-toolkit config for the likeness LoRA with this machine's paths filled in. Forward slashes: they work on Windows and need no escaping."""
    trigger = enrolled(home).get("trigger", TRIGGER)
    text = (paths.ROOT / "train" / TEMPLATE).read_text(encoding="utf-8")
    for key, value in {"__NAME__": name, "__TRIGGER__": trigger, "__DATASET__": (home / "enrol" / "dataset").resolve().as_posix(), "__OUTPUT__": (home / "lora" / "runs").resolve().as_posix()}.items():
        text = text.replace(key, value)
    target = home / "enrol" / "likeness-lora.yaml"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    return target
