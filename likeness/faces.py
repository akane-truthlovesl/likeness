"""Face tools: find the face, and say how alike two faces are.

SCRFD (detector) and ArcFace (embedder) from the buffalo_l pack, run directly in ONNX Runtime with
NumPy and Pillow; no insightface package, no OpenCV. Optional: the simulator runs without them and
falls back to a plain pixel proxy that is labelled as such.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

DETECTOR, EMBEDDER = "det_10g.onnx", "w600k_r50.onnx"
# Where ArcFace expects the eyes, nose and mouth corners in its 112 px crop.
TEMPLATE = ((38.2946, 51.6963), (73.5318, 51.5014), (56.0252, 71.7366), (41.5493, 92.3655), (70.7299, 92.2041))


@dataclass
class Face:
    box: tuple[float, float, float, float]
    points: list[tuple[float, float]]
    score: float

    @property
    def width(self) -> float:
        return self.box[2] - self.box[0]


class FaceTools:
    def __init__(self, folder: Path):
        import numpy as np
        import onnxruntime as ort

        self.np = np
        available = ort.get_available_providers()
        if sys.platform == "win32" and "CUDAExecutionProvider" in available:
            ort.preload_dlls(msvc=False)
        providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in available]
        self.detector = ort.InferenceSession(str(folder / DETECTOR), providers=providers)
        self.embedder = ort.InferenceSession(str(folder / EMBEDDER), providers=providers)
        self.provider = self.detector.get_providers()[0]

    def detect(self, image: Image.Image, threshold: float = 0.5, size: int = 640) -> list[Face]:
        """Faces in the picture, largest first."""
        np, rgb = self.np, image.convert("RGB")
        scale = min(size / rgb.width, size / rgb.height)
        canvas = Image.new("RGB", (size, size))
        canvas.paste(rgb.resize((max(1, round(rgb.width * scale)), max(1, round(rgb.height * scale))), Image.Resampling.BILINEAR))
        blob = ((np.asarray(canvas, dtype=np.float32) - 127.5) / 128.0).transpose(2, 0, 1)[None]
        outs = self.detector.run(None, {self.detector.get_inputs()[0].name: blob})
        boxes, scores, points = [], [], []
        for i, stride in enumerate((8, 16, 32)):
            score, reach, marks = outs[i].reshape(-1), outs[i + 3].reshape(-1, 4) * stride, outs[i + 6].reshape(-1, 10) * stride
            side = size // stride
            centres = np.stack(np.mgrid[:side, :side][::-1], axis=-1).astype(np.float32).reshape(-1, 2) * stride
            centres = np.repeat(centres, 2, axis=0)   # two anchors per cell
            keep = score >= threshold
            c, r, k = centres[keep], reach[keep], marks[keep]
            boxes.append(np.stack([c[:, 0] - r[:, 0], c[:, 1] - r[:, 1], c[:, 0] + r[:, 2], c[:, 1] + r[:, 3]], axis=1))
            points.append(k.reshape(-1, 5, 2) + c[:, None, :])
            scores.append(score[keep])
        boxes, scores, points = np.concatenate(boxes) / scale, np.concatenate(scores), np.concatenate(points) / scale
        faces = [Face(tuple(map(float, boxes[i])), [tuple(map(float, p)) for p in points[i]], float(scores[i])) for i in self._nms(boxes, scores)]
        return sorted(faces, key=lambda f: -f.width)

    def _nms(self, boxes, scores, overlap: float = 0.4) -> list[int]:
        np, order, keep = self.np, scores.argsort()[::-1], []
        area = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
        while order.size:
            i, rest = order[0], order[1:]
            keep.append(int(i))
            w = np.maximum(0, np.minimum(boxes[i, 2], boxes[rest, 2]) - np.maximum(boxes[i, 0], boxes[rest, 0]))
            h = np.maximum(0, np.minimum(boxes[i, 3], boxes[rest, 3]) - np.maximum(boxes[i, 1], boxes[rest, 1]))
            order = rest[w * h / (area[i] + area[rest] - w * h) <= overlap]
        return keep

    def align(self, image: Image.Image, face: Face) -> Image.Image:
        """The face turned, scaled and cropped to ArcFace's 112 px template."""
        np = self.np
        src, dst = np.asarray(face.points, dtype=np.float64), np.asarray(TEMPLATE, dtype=np.float64)
        ms, md = src.mean(0), dst.mean(0)
        s, d = src - ms, dst - md
        u, sing, vt = np.linalg.svd(d.T @ s / len(src))
        flip = np.diag([1.0, -1.0 if np.linalg.det(u) * np.linalg.det(vt) < 0 else 1.0])
        m = (sing * np.diag(flip)).sum() / s.var(0).sum() * (u @ flip @ vt)
        inv = np.linalg.inv(m)
        shift = ms - inv @ md   # Pillow wants the map from the crop back to the photograph
        return image.convert("RGB").transform((112, 112), Image.Transform.AFFINE, (inv[0, 0], inv[0, 1], shift[0], inv[1, 0], inv[1, 1], shift[1]), Image.Resampling.BILINEAR)

    def embed(self, image: Image.Image, face: Face):
        np = self.np
        blob = ((np.asarray(self.align(image, face), dtype=np.float32) - 127.5) / 127.5).transpose(2, 0, 1)[None]
        vector = self.embedder.run(None, {self.embedder.get_inputs()[0].name: blob})[0][0]
        return vector / np.linalg.norm(vector)

    def similarity(self, a, b) -> float:
        return float(self.np.dot(a, b))


def load(folder: Path) -> FaceTools | None:
    """The face tools, or None where ONNX Runtime or the model files are not installed."""
    if not ((folder / DETECTOR).exists() and (folder / EMBEDDER).exists()):
        return None
    try:
        return FaceTools(folder)
    except Exception:
        return None


def proxy_similarity(a: Image.Image, b: Image.Image) -> float:
    """A stand-in for likeness where no face model is installed: correlation of the two pictures' central tones.
    It answers "is this a picture of the same photograph", not "is this the same person", and is reported as a proxy."""
    def tones(image: Image.Image) -> list[int]:
        w, h = image.size
        crop = image.crop((int(w * 0.22), int(h * 0.14), int(w * 0.78), int(h * 0.7)))
        return list(ImageOps.autocontrast(ImageOps.grayscale(crop).resize((36, 36), Image.Resampling.BOX)).tobytes())

    x, y = tones(a), tones(b)
    mx, my = sum(x) / len(x), sum(y) / len(y)
    cov = sum((p - mx) * (q - my) for p, q in zip(x, y))
    spread = (sum((p - mx) ** 2 for p in x) * sum((q - my) ** 2 for q in y)) ** 0.5
    return round(max(0.0, cov / spread) if spread else 0.0, 3)
