import io

import pytest
from PIL import Image, ImageDraw

from likeness.engines.mock import MockEngine


@pytest.fixture
def photo() -> bytes:
    """A stand-in photograph: nobody's face, but enough of a picture to carry through the pipeline."""
    image = Image.new("RGB", (720, 960), "#9aa3ad")
    draw = ImageDraw.Draw(image)
    draw.ellipse((90, 660, 630, 1300), fill="#3d4a5c")
    draw.ellipse((230, 200, 490, 560), fill="#d9a67e")
    draw.pieslice((220, 170, 500, 470), 180, 360, fill="#3a2a1e")
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=90)
    return buffer.getvalue()


@pytest.fixture
def engine() -> MockEngine:
    return MockEngine(step_delay=0)
