import shutil

import pytest
from PIL import Image

from likeness import enrol, faces, identity, paths, recipes
from likeness.engines.mock import MockEngine
from likeness.pipeline import Studio
from likeness.store import Store

FIXTURES = sorted((paths.ROOT / "tests" / "fixtures" / "sitters").glob("*.jpg"))


class Recording(MockEngine):
    """The simulator, remembering what it was asked for."""

    def __init__(self):
        super().__init__(step_delay=0)
        self.requests = []

    def render(self, request, on_step):
        self.requests.append(request)
        return super().render(request, on_step)


@pytest.fixture(scope="module")
def tools():
    found = faces.load(paths.home() / "models" / "faces")
    if found is None:
        pytest.skip("the face models are not installed here (uv sync --group faces, then uv run likeness fetch faces)")
    return found


def test_a_locked_instruction_can_name_the_sitter():
    clay = recipes.get("clay")
    assert "the input photograph, ohwx person, as a hand-sculpted" in clay.prompt("locked", None, who="ohwx person")
    assert "the input photograph as a hand-sculpted" in clay.prompt("locked")
    assert "ohwx" not in clay.prompt("naive", {"hair": "black hair"}, who="ohwx person")


def test_a_candidate_lora_is_used_only_once_adopted(tmp_path, photo):
    trained = tmp_path / "trained.safetensors"
    trained.write_bytes(b"weights")
    engine = Recording()
    engine.load()
    studio = Studio(engine, Store(tmp_path))
    sitting = studio.seat(photo)["id"]

    identity.register(tmp_path, trained, "ohwx person", steps=1500)
    assert identity.candidate(tmp_path)["trigger"] == "ohwx person" and identity.personal(tmp_path) is None
    plain = studio.develop(sitting, "oil", seed=1)
    assert not plain["lora"] and engine.requests[-1].lora == "" and "ohwx" not in engine.requests[-1].prompt

    identity.adopt(tmp_path, delta=0.06)
    assert identity.personal(tmp_path)["steps"] == 1500 and identity.personal(tmp_path)["delta"] == 0.06
    locked = studio.develop(sitting, "oil", seed=1)
    assert locked["lora"] and engine.requests[-1].lora.endswith("likeness.safetensors") and "ohwx person" in engine.requests[-1].prompt
    assert "own LoRA" in next(s["note"] for s in locked["trace"] if s["id"] == "recipe")

    naive = studio.develop(sitting, "oil", "naive", seed=1)   # words only means words only
    assert not naive["lora"] and engine.requests[-1].lora == "" and "ohwx" not in engine.requests[-1].prompt
    without = studio.develop(sitting, "oil", seed=1, personal=None)
    assert not without["lora"] and engine.requests[-1].lora == ""


def test_faces_are_found_aligned_and_recognised(tools):
    first, second = (Image.open(p).convert("RGB") for p in FIXTURES[:2])
    found = tools.detect(first)
    assert len(found) == 1 and found[0].score > 0.5 and 0.2 < found[0].width / first.width < 0.4
    assert tools.align(first, found[0]).size == (112, 112)
    a = tools.embed(first, found[0])
    closer = first.crop((60, 80, 860, 1150)).resize((640, 860))       # the same picture, reframed and resized
    b = tools.embed(closer, tools.detect(closer)[0])
    c = tools.embed(second, tools.detect(second)[0])
    assert tools.similarity(a, a) == pytest.approx(1, abs=1e-5)
    assert tools.similarity(a, b) > 0.9 > tools.similarity(a, c)


def test_the_gate_and_the_score_use_the_face_model(tools, engine, tmp_path, photo):
    engine.load()
    studio = Studio(engine, Store(tmp_path), tools)
    seated = studio.seat(FIXTURES[0].read_bytes())
    assert seated["gate"]["ok"] and seated["gate"]["faces"] == 1 and "one face" in seated["gate"]["note"]
    assert studio.store.embedding(seated["id"]).exists()
    record = studio.develop(seated["id"], "cinema", seed=2)
    assert record["measure"] == "face" and (record["similarity"] is None or -1 <= record["similarity"] <= 1)
    nobody = studio.seat(photo)                                         # shapes, not a face
    assert not nobody["gate"]["ok"] and nobody["gate"]["reason"] == "No face was found in this photograph."


def test_enrolment_builds_a_training_set_and_holds_some_back(tools, tmp_path, photo):
    source = tmp_path / "in"
    source.mkdir()
    for round_ in range(2):
        for fixture in FIXTURES:
            shutil.copy(fixture, source / f"{fixture.stem}-{round_}.jpg")
    (source / "nobody.jpg").write_bytes(photo)
    (source / "notes.heic").write_bytes(b"not readable here")
    report = enrol.build(source, tmp_path, tools, trigger="ohwx person", size=768)
    assert report["seen"] == 14 and report["accepted"] == 12 and report["enough"]
    assert report["rejected"] == {"no face found": 1, "not a JPEG, PNG or WebP (export HEIC photographs as JPEG first)": 1}
    assert report["trained_on"] + report["held_out"] == 12 and report["held_out"] == 2
    pictures = sorted((tmp_path / "enrol" / "dataset").glob("*.jpg"))
    assert len(pictures) == report["trained_on"] == len(list((tmp_path / "enrol" / "dataset").glob("*.txt")))
    assert len(list((tmp_path / "enrol" / "holdout").glob("*.jpg"))) == 2
    for picture in pictures:
        image = Image.open(picture)
        assert image.width == image.height <= 768
        assert picture.with_suffix(".txt").read_text(encoding="utf-8").startswith("a photo of ohwx person, ")
    assert "file" not in str(report)                                    # names stay in private/enrol/enrol.json
    config = enrol.write_config(tmp_path, "likeness_test").read_text(encoding="utf-8")
    assert "__" not in config and (tmp_path / "enrol" / "dataset").resolve().as_posix() in config and 'name: "likeness_test"' in config


def test_a_lora_that_does_not_help_is_not_called_helpful(tools, engine, tmp_path):
    engine.load()
    studio = Studio(engine, Store(tmp_path), tools)
    kept = []
    report = identity.check(studio, FIXTURES[:2], {"path": "candidate.safetensors", "trigger": "ohwx person"}, ["cinema", "oil"], keep=lambda *plate: kept.append(plate))
    assert len(kept) == 8 and report["photos"] == 2 and set(report["worlds"]) == {"cinema", "oil"}
    assert not report["helps"]                                          # the simulator ignores LoRAs, so nothing can improve
    assert all(world["delta"] in (0, None) for world in report["worlds"].values())
