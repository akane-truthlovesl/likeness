"""Recipes: how each world is asked for, with and without the photograph.

A recipe has two variants. The locked variant hands the model the sitting itself and tells it what must
not change; the naive variant hands it only a description. They exist side by side so the difference
can be shown, measured and argued with.
"""

from __future__ import annotations

import json
import tomllib
from dataclasses import asdict, dataclass, replace
from functools import lru_cache
from pathlib import Path

from . import paths

ORDER = ("noir", "oil", "clay", "cinema", "brick", "cel", "knight")
ENGINE_LABELS = {"qwen21_turbo": "Qwen-Image 2.1 Turbo", "flux3_klein": "FLUX 3 Image Klein", "mock": "Simulator"}

LOCKED = (
    "Repaint the person in the input photograph{who} {medium}. Keep this exact person recognisable: the same face shape, "
    "eyes, nose, mouth, skin tone, apparent age and hairstyle{keep}, with the same expression and the same head pose. "
    "Head and shoulders, centred, facing the camera, one person only. {scene}"
)
NAIVE = "A head-and-shoulders portrait of a person with {attributes}, {medium}. Centred, facing the camera, one person only. {scene}"


@dataclass(frozen=True)
class Variant:
    engine: str = "qwen21_turbo"
    steps: int = 8
    guidance: float = 1.0
    width: int = 896
    height: int = 1200
    reference: str = "photograph"  # photograph | none
    identity_floor: float = 0.38   # face similarity below which a locked render is flagged; 0 where it does not apply
    lora: str = ""


@dataclass(frozen=True)
class Recipe:
    world: str
    name: str
    medium: str
    scene: str
    locked: Variant
    naive: Variant

    def variant(self, which: str) -> Variant:
        if which not in ("locked", "naive"):
            raise KeyError(f"Unknown recipe variant: {which}")
        return self.locked if which == "locked" else self.naive

    def prompt(self, which: str, words: dict | None = None, who: str = "") -> str:
        """The instruction sent to the engine, with the sitter's reading folded in. who: the trigger words of the
        sitter's own LoRA, when one is in use; it names them in the locked instruction and nowhere else."""
        words = words or {}
        if which == "locked":
            kept = [w for w in (words.get("glasses"), words.get("beard")) if w and not w.startswith("no ") and w != "clean-shaven"]
            return LOCKED.format(medium=self.medium, scene=self.scene, keep=(", including " + " and ".join(kept)) if kept else "", who=f", {who}," if who else "")
        said = [words.get(k) for k in ("skin", "hair", "glasses", "beard", "expression")]
        return NAIVE.format(medium=self.medium, scene=self.scene, attributes=", ".join(w for w in said if w) or "an ordinary face")


@lru_cache(maxsize=1)
def load_all(folder: Path | None = None) -> dict[str, Recipe]:
    recipes = {}
    for path in sorted((folder or paths.WORLDS).glob("*.toml")):
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        locked = Variant(**data.get("locked", {}))
        naive = replace(locked, reference="none", identity_floor=0.0, lora="", **data.get("naive", {}))
        recipes[data["world"]] = Recipe(data["world"], data["name"], data["medium"], data["scene"], locked, naive)
    return {world: recipes[world] for world in ORDER if world in recipes} | {w: r for w, r in recipes.items() if w not in ORDER}


def get(world: str) -> Recipe:
    try:
        return load_all()[world]
    except KeyError:
        raise KeyError(f"Unknown world: {world}") from None


def for_web() -> dict:
    """What the app's Lab shows about each recipe. Written to web/data/recipes.json by  likeness export-web."""
    sample = {"skin": "[skin]", "hair": "[hair]", "glasses": "[glasses]", "beard": "[beard]", "expression": "[expression]"}

    def card(recipe: Recipe, which: str) -> dict:
        v = recipe.variant(which)
        return {**asdict(v), "engine_label": ENGINE_LABELS.get(v.engine, v.engine), "prompt": recipe.prompt(which, sample if which == "naive" else None)}

    return {"version": 1, "worlds": {w: {"world": w, "name": r.name, "locked": card(r, "locked"), "naive": card(r, "naive")} for w, r in load_all().items()}}


def export_web(target: Path | None = None) -> Path:
    target = target or paths.WEB / "data" / "recipes.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(for_web(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return target
