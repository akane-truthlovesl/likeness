import json

from likeness import paths, recipes


def test_the_seven_worlds_in_catalogue_order():
    assert tuple(recipes.load_all()) == recipes.ORDER


def test_locked_names_only_what_must_survive():
    prompt = recipes.get("clay").prompt("locked", {"glasses": "round glasses", "beard": "clean-shaven", "hair": "black hair, cropped"})
    assert "input photograph" in prompt and "including round glasses" in prompt
    assert "clean-shaven" not in prompt and "cropped" not in prompt


def test_naive_has_words_and_nothing_else():
    recipe = recipes.get("noir")
    assert recipe.naive.reference == "none" and recipe.naive.identity_floor == 0
    prompt = recipe.prompt("naive", {"skin": "sienna skin", "hair": "black hair, full curls", "expression": "a broad, open smile"})
    assert "sienna skin, black hair, full curls, a broad, open smile" in prompt and "photograph." not in prompt.split(",")[0]


def test_least_literal_worlds_do_not_claim_a_face_score():
    assert recipes.get("brick").locked.identity_floor == 0 and recipes.get("cel").locked.identity_floor == 0
    assert recipes.get("oil").locked.identity_floor > 0.3


def test_the_app_shows_the_recipes_the_studio_uses():
    shown = json.loads((paths.WEB / "data" / "recipes.json").read_text(encoding="utf-8"))
    assert shown == recipes.for_web(), "web/data/recipes.json is stale: run  uv run likeness export-web"
