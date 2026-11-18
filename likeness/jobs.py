"""One render at a time, on its own thread, with every event kept so a late listener misses nothing."""

from __future__ import annotations

import queue
import secrets
import threading
from typing import Callable


class Job:
    def __init__(self):
        self.id, self.state, self.events, self.portrait = secrets.token_hex(6), "queued", [], None

    def emit(self, kind: str, **data) -> None:
        self.events.append({"type": kind, **data})

    @property
    def finished(self) -> bool:
        return self.state in ("done", "failed")


class Jobs:
    def __init__(self):
        self.jobs: dict[str, Job] = {}
        self._queue: queue.Queue = queue.Queue()
        threading.Thread(target=self._work, daemon=True, name="likeness-render").start()

    def submit(self, work: Callable[[Callable[..., None]], dict]) -> Job:
        job = Job()
        self.jobs[job.id] = job
        self._queue.put((job, work))
        return job

    def _work(self) -> None:
        while True:
            job, work = self._queue.get()
            job.state = "running"
            try:
                job.portrait = work(job.emit)
                job.emit("done", portrait=job.portrait)
                job.state = "done"
            except Exception as error:   # the job fails; the studio carries on
                job.emit("failed", message=str(error) or error.__class__.__name__)
                job.state = "failed"
