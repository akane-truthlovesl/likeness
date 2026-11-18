import json
import time

import pytest
from fastapi.testclient import TestClient

from likeness.server import create_app


@pytest.fixture
def client(engine, tmp_path):
    app = create_app(engine, tmp_path)
    with TestClient(app) as c:
        assert c.get("/studio.json").status_code == 401   # a stranger on the network
        assert c.get(f"/?pair={app.state.key}", follow_redirects=False).status_code == 307
        yield c


def finished(client, job):
    for _ in range(200):
        state = client.get(f"/api/jobs/{job}").json()
        if state["state"] in ("done", "failed"):
            return state
        time.sleep(0.02)
    raise AssertionError("the job never finished")


def test_the_studio_introduces_itself(client):
    info = client.get("/studio.json").json()
    assert info["edition"] == "live" and info["engine"]["kind"] == "simulator" and len(info["worlds"]) == 7
    assert client.get("/api/health").json()["ok"]
    assert "Likeness" in client.get("/").text   # the app itself is served from the same door


def test_a_wrong_pairing_code_opens_nothing(engine, tmp_path):
    with TestClient(create_app(engine, tmp_path)) as c:
        assert c.get("/?pair=guess").status_code == 401
        assert c.post("/api/sittings", files={"photo": ("p.jpg", b"x", "image/jpeg")}).status_code == 401


def test_sitting_to_plate_over_polling(client, photo):
    seated = client.post("/api/sittings", files={"photo": ("sitting.jpg", photo, "image/jpeg")}, data={"reading": json.dumps({"words": {"hair": "black hair"}})}).json()
    assert seated["gate"]["ok"]
    job = client.post(f"/api/sittings/{seated['id']}/portraits", json={"world": "clay", "seed": 5}).json()["job"]
    state = finished(client, job)
    assert state["state"] == "done" and state["events"][-1]["type"] == "done"
    portrait = state["portrait"]
    picture = client.get("/" + portrait["url"])
    assert picture.status_code == 200 and picture.headers["content-type"] == "image/jpeg" and len(picture.content) > 20000
    assert client.get("/api/history").json()[0]["id"] == portrait["id"]


def test_events_arrive_as_a_stream(client, photo):
    seated = client.post("/api/sittings", files={"photo": ("sitting.jpg", photo, "image/jpeg")}).json()
    job = client.post(f"/api/sittings/{seated['id']}/portraits", json={"world": "noir", "recipe": "naive"}).json()["job"]
    with client.stream("GET", f"/api/jobs/{job}/events") as stream:
        assert stream.headers["content-type"].startswith("text/event-stream")
        kinds = [line.split(": ")[1] for line in stream.iter_lines() if line.startswith("event: ")]
    assert kinds[0] == "stage" and "step" in kinds and kinds[-1] == "done"


def test_what_the_studio_refuses(client, photo):
    assert client.post("/api/sittings", files={"photo": ("notes.txt", b"not a picture", "text/plain")}).status_code == 415
    assert client.post("/api/sittings/none/portraits", json={"world": "clay"}).status_code == 404
    seated = client.post("/api/sittings", files={"photo": ("sitting.jpg", photo, "image/jpeg")}).json()
    assert client.post(f"/api/sittings/{seated['id']}/portraits", json={"world": "watercolour"}).status_code == 404
    assert client.get("/api/files/portraits/..%2Fstudio.db").status_code == 404
    assert client.get("/api/jobs/none").status_code == 404
