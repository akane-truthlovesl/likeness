"""The simulator: an engine with no model in it.

It develops the photograph with classical filters, one look per world, and takes its time the way a
sampler would. It exists so the whole studio (upload, gate, jobs, events, storage, the app) can be
exercised without a graphics card. A words-only request has nothing to work from, so it is given a
stand-in bust: the simulator cannot imagine a face, and does not pretend to.
"""

from __future__ import annotations

import random
import time

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps

from . import RenderRequest, StepCallback


def _fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), size, Image.Resampling.LANCZOS, centering=(0.5, 0.42))


def _sweep(size: tuple[int, int]) -> Image.Image:
    """A left-to-right ramp, black to white."""
    return Image.linear_gradient("L").rotate(90, expand=True).resize(size)


def _vignette(image: Image.Image, strength: float, colour: str = "#000000") -> Image.Image:
    mask = Image.radial_gradient("L").resize(image.size).point(lambda v: int(max(0, v - 70) * 1.38 * strength))
    return Image.composite(Image.new("RGB", image.size, colour), image, mask)


def _stand_in(size: tuple[int, int], rng: random.Random) -> Image.Image:
    w, h = size
    image = Image.new("RGB", size, rng.choice(["#8d8a84", "#7d8791", "#93897d"]))
    draw = ImageDraw.Draw(image)
    skin, hair, cloth = rng.choice(["#e0ac85", "#c98d62", "#a9714b", "#eccba8"]), rng.choice(["#2a211b", "#5a4030", "#8a6a44"]), rng.choice(["#3d4a5c", "#5c3d3d", "#3f5c4a"])
    draw.ellipse((w * 0.08, h * 0.74, w * 0.92, h * 1.3), fill=cloth)
    draw.rectangle((w * 0.42, h * 0.56, w * 0.58, h * 0.8), fill=skin)
    draw.ellipse((w * 0.3, h * 0.2, w * 0.7, h * 0.66), fill=skin)
    draw.pieslice((w * 0.28, h * 0.16, w * 0.72, h * 0.56), 180, 360, fill=hair)
    for x in (0.42, 0.58):
        draw.ellipse((w * (x - 0.022), h * 0.4, w * (x + 0.022), h * 0.424), fill="#1c1410")
    draw.arc((w * 0.43, h * 0.5, w * 0.57, h * 0.57), 20, 160, fill="#7a3a34", width=max(2, w // 160))
    return image.filter(ImageFilter.GaussianBlur(w / 300))


def _noir(image: Image.Image, rng: random.Random) -> Image.Image:
    grey = ImageOps.autocontrast(ImageOps.grayscale(image), cutoff=2)
    magenta, cyan = ImageOps.colorize(grey, "#0a0614", "#ff2e88", mid="#5a1450"), ImageOps.colorize(grey, "#0a0614", "#19e3ff", mid="#123a66")
    out = Image.composite(cyan, magenta, _sweep(image.size))
    rain = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(rain)
    for _ in range(260):
        x, y, n = rng.randrange(image.width), rng.randrange(image.height), rng.randrange(18, 70)
        draw.line((x, y, x - n * 0.2, y + n), fill=rng.randrange(40, 120), width=1)
    return _vignette(ImageChops.screen(out, Image.merge("RGB", (rain, rain, rain))), 0.8, "#04020a")


def _oil(image: Image.Image, rng: random.Random) -> Image.Image:
    soft = image.filter(ImageFilter.MedianFilter(7)).filter(ImageFilter.ModeFilter(7))
    warm = ImageChops.multiply(ImageEnhance.Contrast(soft).enhance(1.25), Image.new("RGB", image.size, "#f0c890"))
    return _vignette(ImageEnhance.Brightness(warm).enhance(0.86), 1.0, "#0a0603")


def _clay(image: Image.Image, rng: random.Random) -> Image.Image:
    soft = image.filter(ImageFilter.MedianFilter(9)).filter(ImageFilter.SMOOTH_MORE)
    rich = ImageEnhance.Color(soft).enhance(1.4)
    return _vignette(Image.blend(rich, rich.filter(ImageFilter.EMBOSS), 0.16), 0.35, "#2b1a0c")


def _cinema(image: Image.Image, rng: random.Random) -> Image.Image:
    soft = ImageEnhance.Color(image.filter(ImageFilter.SMOOTH_MORE).filter(ImageFilter.SMOOTH_MORE)).enhance(1.45)
    bloom = ImageEnhance.Brightness(soft.filter(ImageFilter.GaussianBlur(image.width / 46))).enhance(0.55)
    return _vignette(ImageChops.screen(soft, bloom), 0.5, "#07141f")


def _brick(image: Image.Image, rng: random.Random) -> Image.Image:
    cell = max(8, image.width // 28)
    small = ImageOps.posterize(image.resize((image.width // cell, image.height // cell), Image.Resampling.BOX), 3)
    out = ImageEnhance.Color(small.resize(image.size, Image.Resampling.NEAREST)).enhance(1.5)
    draw = ImageDraw.Draw(out, "RGBA")
    for y in range(0, image.height, cell):
        for x in range(0, image.width, cell):
            draw.ellipse((x + cell * 0.2, y + cell * 0.2, x + cell * 0.8, y + cell * 0.8), outline=(255, 255, 255, 70), fill=(255, 255, 255, 26))
    return out


def _cel(image: Image.Image, rng: random.Random) -> Image.Image:
    flat = ImageEnhance.Color(ImageOps.posterize(image.filter(ImageFilter.MedianFilter(5)), 3)).enhance(1.5)
    edges = ImageOps.grayscale(image).filter(ImageFilter.GaussianBlur(1.4)).filter(ImageFilter.FIND_EDGES).point(lambda v: 0 if v > 22 else 255)
    return ImageChops.multiply(flat, Image.merge("RGB", (edges, edges, edges)))


def _knight(image: Image.Image, rng: random.Random) -> Image.Image:
    cold = Image.blend(image, ImageOps.colorize(ImageOps.grayscale(image), "#0b0f16", "#cfd9e3"), 0.6)
    lit = Image.composite(ImageChops.screen(cold, Image.new("RGB", image.size, "#b85a14")), cold, _sweep(image.size).point(lambda v: max(0, v - 150) * 2))
    return _vignette(ImageEnhance.Contrast(lit).enhance(1.2), 0.85, "#05060a")


LOOKS = {"noir": _noir, "oil": _oil, "clay": _clay, "cinema": _cinema, "brick": _brick, "cel": _cel, "knight": _knight}


class MockEngine:
    id = "mock"
    kind = "simulator"
    device = "CPU · filters, no model"
    default_steps = 8

    def __init__(self, step_delay: float = 0.16):
        self.step_delay = step_delay
        self.ready = False

    def load(self) -> None:
        self.ready = True

    def render(self, request: RenderRequest, on_step: StepCallback) -> Image.Image:
        if request.world not in LOOKS:
            raise KeyError(f"Unknown world: {request.world}")
        rng, size = random.Random(request.seed), (request.width, request.height)
        subject = _fit(request.photo, size) if request.photo is not None else _stand_in(size, rng)
        for i in range(1, request.steps + 1):
            time.sleep(self.step_delay)
            on_step(i, request.steps)
        return LOOKS[request.world](subject, rng)
