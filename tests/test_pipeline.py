import pytest
from PIL import Image

from likeness import recipes
from likeness.pipeline import STAGES, Studio
from likeness.store import Store


@pytest.fixture
def studio(engine, tmp_path):
    engine.load()
    return Studio(engine, Store(tmp_path))


def test_a_sitting_is_normalised_and_remembered(studio, photo):
    seated = studio.seat(photo, {"words": {"hair": "dark brown hair, cropped"}})
    assert seated["gate"]["ok"] and "no face model" in seated["gate"]["note"]
    kept = Image.open(studio.store.photo(seated["id"]))
    assert kept.size == (960, 1280)
    assert [s["id"] for s in studio.store.sitting(seated["id"])["trace"]] == ["capture", "normalise", "gate", "identity"]


@pytest.mark.parametrize("world", recipes.ORDER)
def test_every_world_develops_to_a_plate(studio, photo, world):
    events = []
    record = studio.develop(studio.seat(photo)["id"], world, "locked", seed=3, emit=lambda kind, **data: events.append((kind, data)))
    plate = Image.open(studio.store.plate(record["id"]))
    assert plate.size == (896, 1200) and record["engine"] == "mock" and record["seed"] == 3
    assert [s["id"] for s in record["trace"]] == list(STAGES)
    assert [d["i"] for kind, d in events if kind == "step"] == list(range(1, 9))
    beats = [d["beat"] for kind, d in events if kind == "stage"]
    assert beats == sorted(beats) and set(beats) == {0, 1, 2}


def test_the_photograph_is_what_makes_it_a_likeness(studio, photo):
    sitting = studio.seat(photo)["id"]
    locked, naive = studio.develop(sitting, "cinema", "locked", seed=1), studio.develop(sitting, "cinema", "naive", seed=1)
    assert locked["similarity"] > naive["similarity"]
    assert "proxy" in locked["trace"][-2]["note"]   # no face model here, and the trace says so


def test_same_seed_same_plate(studio, photo):
    sitting = studio.seat(photo)["id"]
    a, b = (studio.develop(sitting, "noir", "locked", seed=11) for _ in range(2))
    assert studio.store.plate(a["id"]).read_bytes() == studio.store.plate(b["id"]).read_bytes()


def test_unknown_sitting_and_world_are_refused(studio, photo):
    with pytest.raises(KeyError):
        studio.develop("nobody", "noir")
    with pytest.raises(KeyError):
        studio.develop(studio.seat(photo)["id"], "watercolour")
