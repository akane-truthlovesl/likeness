"""The studio's front door: the app's files, the sittings API, and a stream of events for each plate."""

from __future__ import annotations

import asyncio
import json
import os
import secrets
import threading
import time
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import __version__, engines, faces, paths, recipes
from .jobs import Jobs
from .pipeline import Studio
from .store import Store

LOOPBACK = {"127.0.0.1", "::1", "localhost"}
MAX_PHOTO = 24 * 2**20
NOT_PAIRED = """<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Likeness</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#121110;color:#ede6da;font:17px/1.5 Georgia,serif">
<p style="max-width:20em;padding:2em">This studio is paired with one phone.<br><br>Scan the code that  <code>likeness serve</code>  prints on the workstation to pair this one.</p>"""


class Order(BaseModel):
    world: str
    recipe: Literal["locked", "naive"] = "locked"
    seed: int | None = None


def pairing_key(home: Path) -> str:
    path = home / "pairing.key"
    if not path.exists():
        path.write_text(secrets.token_urlsafe(9), encoding="utf-8")
    return path.read_text(encoding="utf-8").strip()


def create_app(engine: engines.Engine | None = None, home: Path | None = None, open_door: bool | None = None) -> FastAPI:
    home = home or paths.home()
    engine = engine or engines.create(os.environ.get("LIKENESS_ENGINE", "auto"))
    studio, jobs, key = Studio(engine, Store(home), faces.load(home / "models" / "faces")), Jobs(), pairing_key(home)
    open_door = bool(os.environ.get("LIKENESS_OPEN")) if open_door is None else open_door
    state = {"error": ""}

    def warm() -> None:
        try:
            engine.load()
        except Exception as error:
            state["error"] = str(error)

    threading.Thread(target=warm, daemon=True, name="likeness-load").start()
    app = FastAPI(title="Likeness", version=__version__, docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
    app.state.studio, app.state.jobs, app.state.key = studio, jobs, key

    @app.middleware("http")
    async def paired(request: Request, call_next):
        """Only this machine, or a phone that has scanned the pairing code, may come in."""
        offered = request.query_params.get("pair")
        if offered and secrets.compare_digest(offered, key):
            response = RedirectResponse(str(request.url.remove_query_params("pair")))
            response.set_cookie("likeness_key", key, max_age=31536000, httponly=True, samesite="lax")
            return response
        host = request.client.host if request.client else ""
        if not (open_door or host in LOOPBACK or secrets.compare_digest(request.cookies.get("likeness_key", ""), key)):
            return HTMLResponse(NOT_PAIRED, status_code=401)
        response = await call_next(request)
        if not request.url.path.startswith("/api/files/"):
            response.headers["cache-control"] = "no-cache"
        return response

    def describe() -> dict:
        return {
            "ok": True, "edition": "live", "version": __version__, "worlds": list(recipes.load_all()), "faces": studio.faces is not None,
            "engine": {"id": engine.id, "kind": engine.kind, "device": engine.device, "ready": engine.ready, "error": state["error"]},
        }

    app.get("/studio.json")(describe)
    app.get("/api/health")(describe)
    app.get("/api/recipes")(recipes.for_web)
    app.get("/api/history")(lambda: studio.store.history())

    @app.post("/api/sittings")
    async def seat(photo: UploadFile = File(...), reading: str = Form("")):
        data = await photo.read(MAX_PHOTO + 1)
        if len(data) > MAX_PHOTO:
            raise HTTPException(413, "That photograph is larger than the studio accepts (24 MB).")
        try:
            notes = json.loads(reading) if reading else None
            return await run_in_threadpool(studio.seat, data, notes)
        except json.JSONDecodeError:
            raise HTTPException(422, "The reading sent with the photograph could not be understood.") from None
        except OSError:
            raise HTTPException(415, "That file could not be opened as a photograph.") from None

    @app.post("/api/sittings/{sitting_id}/portraits")
    def order(sitting_id: str, body: Order):
        if studio.store.sitting(sitting_id) is None:
            raise HTTPException(404, "The studio has no such sitting.")
        if body.world not in recipes.load_all():
            raise HTTPException(404, f"The studio has no world called {body.world}.")

        def work(emit):
            waited = 0.0
            while not engine.ready:
                if state["error"]:
                    raise RuntimeError(f"The engine could not start: {state['error']}")
                if waited == 0:
                    emit("log", text="the engine is still loading its weights")
                time.sleep(0.25)
                waited += 0.25
            return studio.develop(sitting_id, body.world, body.recipe, body.seed, emit)

        return {"job": jobs.submit(work).id}

    def find(job_id: str):
        job = jobs.jobs.get(job_id)
        if job is None:
            raise HTTPException(404, "The studio has no such job.")
        return job

    @app.get("/api/jobs/{job_id}")
    def job_state(job_id: str):
        job = find(job_id)
        return {"state": job.state, "events": job.events, "portrait": job.portrait}

    @app.get("/api/jobs/{job_id}/events")
    async def job_events(job_id: str):
        job = find(job_id)

        async def stream():
            sent = 0
            while True:
                while sent < len(job.events):
                    event = dict(job.events[sent])
                    sent += 1
                    yield f"event: {event.pop('type')}\ndata: {json.dumps(event)}\n\n"
                if job.finished and sent >= len(job.events):
                    return
                await asyncio.sleep(0.05)

        return StreamingResponse(stream(), media_type="text/event-stream", headers={"cache-control": "no-store", "x-accel-buffering": "no"})

    @app.get("/api/files/{kind}/{name}")
    def picture(kind: Literal["portraits", "sittings"], name: str):
        path = (home / kind / name).resolve()
        if path.parent != (home / kind).resolve() or path.suffix != ".jpg" or not path.exists():
            raise HTTPException(404, "The studio has no such picture.")
        return FileResponse(path, media_type="image/jpeg", headers={"cache-control": "private, max-age=31536000, immutable"})

    app.mount("/", StaticFiles(directory=paths.WEB, html=True), name="web")
    return app
