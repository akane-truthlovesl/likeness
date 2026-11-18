"""Engines: the one seam between the studio and whatever paints.

An engine takes a request (an instruction, an optional reference photograph, a size, a seed) and returns
a picture, reporting each step as it goes. The simulator and the GPU engines are interchangeable behind it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Protocol

from PIL import Image

StepCallback = Callable[[int, int], None]


@dataclass
class RenderRequest:
    world: str
    variant: str               # locked | naive
    prompt: str
    width: int
    height: int
    steps: int = 8
    guidance: float = 1.0
    seed: int = 0
    photo: Image.Image | None = None   # the sitting; None for a words-only render
    lora: str = ""
    extra: dict = field(default_factory=dict)


class Engine(Protocol):
    id: str
    kind: str      # "simulator" | "gpu"
    device: str
    ready: bool

    def load(self) -> None: ...
    def render(self, request: RenderRequest, on_step: StepCallback) -> Image.Image: ...


def create(name: str = "auto") -> Engine:
    """Builds an engine by name. `auto` picks a GPU engine when PyTorch can see one, else the simulator."""
    if name == "auto":
        try:
            import torch

            name = "qwen21_turbo" if torch.cuda.is_available() else "mock"
        except Exception:
            name = "mock"
    if name == "mock":
        from .mock import MockEngine

        return MockEngine()
    from .diffusers_engine import DiffusersEngine

    return DiffusersEngine(name)
