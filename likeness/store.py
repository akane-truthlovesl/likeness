"""What the studio remembers: sittings and portraits in SQLite, their pictures beside it on disk."""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path


class Store:
    def __init__(self, home: Path):
        self.home = home
        for folder in ("sittings", "portraits"):
            (home / folder).mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._db = sqlite3.connect(home / "studio.db", check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        with self._lock, self._db:
            self._db.execute("create table if not exists sittings (id text primary key, created real, record text)")
            self._db.execute("create table if not exists portraits (id text primary key, sitting text, created real, record text)")

    def photo(self, sitting_id: str) -> Path:
        return self.home / "sittings" / f"{sitting_id}.jpg"

    def plate(self, portrait_id: str) -> Path:
        return self.home / "portraits" / f"{portrait_id}.jpg"

    def embedding(self, sitting_id: str) -> Path:
        return self.home / "sittings" / f"{sitting_id}.npy"

    def add_sitting(self, record: dict) -> None:
        with self._lock, self._db:
            self._db.execute("insert or replace into sittings values (?, ?, ?)", (record["id"], time.time(), json.dumps(record)))

    def sitting(self, sitting_id: str) -> dict | None:
        with self._lock:
            row = self._db.execute("select record from sittings where id = ?", (sitting_id,)).fetchone()
        return json.loads(row["record"]) if row else None

    def add_portrait(self, record: dict) -> None:
        with self._lock, self._db:
            self._db.execute("insert or replace into portraits values (?, ?, ?, ?)", (record["id"], record["sitting"], time.time(), json.dumps(record)))

    def close(self) -> None:
        """Lets go of the database file. Windows will not delete a folder while it is open."""
        with self._lock:
            self._db.close()

    def history(self, limit: int = 60) -> list[dict]:
        with self._lock:
            rows = self._db.execute("select record from portraits order by created desc limit ?", (limit,)).fetchall()
        return [json.loads(row["record"]) for row in rows]
