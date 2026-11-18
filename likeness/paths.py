"""Where things live. Everything personal stays under one git-ignored folder."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
WORLDS = Path(__file__).resolve().parent / "worlds"
MANIFEST = ROOT / "models" / "manifest.toml"
RELAY = ROOT / "relay"


def home() -> Path:
    """The private folder: photographs, renders, pairing key, face models. Never committed."""
    path = Path(os.environ.get("LIKENESS_HOME") or ROOT / "private")
    path.mkdir(parents=True, exist_ok=True)
    return path
