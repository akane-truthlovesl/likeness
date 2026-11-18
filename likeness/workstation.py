"""Workstation tools: what only the machine that owns the GPU can find out.

probe   what this machine is (OS, GPU, driver, memory, disk, PyTorch).
fetch   download the models in models/manifest.toml.
smoke   render a few plates end to end and write a contact sheet and numbers.
matrix  time each loading strategy and size, so defaults can be chosen from data.
"""

from __future__ import annotations

import datetime
import importlib.metadata
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import time
import tomllib
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image

from . import engines, enrol, faces, identity, paths
from .pipeline import Studio
from .store import Store


def _ram_gb() -> float | None:
    try:
        if sys.platform == "win32":
            import ctypes

            class Memory(ctypes.Structure):
                _fields_ = [("length", ctypes.c_ulong), ("load", ctypes.c_ulong), ("total", ctypes.c_ulonglong), ("free", ctypes.c_ulonglong), ("a", ctypes.c_ulonglong), ("b", ctypes.c_ulonglong), ("c", ctypes.c_ulonglong), ("d", ctypes.c_ulonglong), ("e", ctypes.c_ulonglong)]

            status = Memory()
            status.length = ctypes.sizeof(Memory)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status))
            return round(status.total / 2**30, 1)
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemTotal"):
                return round(int(line.split()[1]) / 2**20, 1)
    except Exception:
        return None
    return None


def _gpus() -> list[dict]:
    try:
        out = subprocess.run(["nvidia-smi", "--query-gpu=name,driver_version,memory.total,memory.used", "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=20, check=True).stdout
        return [dict(zip(("name", "driver", "vram_mb", "used_mb"), (part.strip() for part in line.split(",")))) for line in out.splitlines() if line.strip()]
    except Exception:
        return []


def _torch() -> dict:
    try:
        import torch
    except Exception as error:
        return {"installed": False, "error": str(error)}
    info = {"installed": True, "version": torch.__version__, "cuda_build": torch.version.cuda, "cuda": torch.cuda.is_available()}
    if info["cuda"]:
        info["device"] = torch.cuda.get_device_name(0)
        started = time.perf_counter()
        x = torch.randn(4096, 4096, device="cuda", dtype=torch.float16)
        (x @ x).sum().item()
        info["matmul_ms"] = round((time.perf_counter() - started) * 1000)
    return info


def _version(package: str) -> str | None:
    try:
        return importlib.metadata.version(package)
    except Exception:
        return None


def probe() -> dict:
    cache = Path(os.environ.get("HF_HOME") or Path.home() / ".cache" / "huggingface")
    disk = shutil.disk_usage(cache if cache.exists() else Path.home())
    info = {
        "when": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "platform": platform.platform(), "python": sys.version.split()[0],
        "cpu_threads": os.cpu_count(), "ram_gb": _ram_gb(), "hf_cache": str(cache), "disk_free_gb": round(disk.free / 2**30), "gpus": _gpus(), "torch": _torch(),
        "packages": {name: _version(name) for name in ("diffusers", "transformers", "accelerate", "peft", "bitsandbytes", "onnxruntime-gpu", "huggingface_hub", "fastapi")},
        "hf_token": bool(os.environ.get("HF_TOKEN") or (cache / "token").exists()),
    }
    worries = []
    if not info["gpus"]:
        worries.append("nvidia-smi reports no GPU")
    elif float(info["gpus"][0]["vram_mb"]) < 20000:
        worries.append("less than 20 GB of VRAM: the finalists will need quantised weights")
    if info["torch"].get("installed") and not info["torch"].get("cuda"):
        worries.append("PyTorch is installed without CUDA: reinstall from the cu132 index (uv sync --group gpu)")
    if info["disk_free_gb"] < 70:
        worries.append("less than 70 GB free where Hugging Face caches models")
    info["worries"] = worries
    return info


def manifest() -> dict:
    return tomllib.loads(paths.MANIFEST.read_text(encoding="utf-8"))["models"]


def fetch(names: list[str] | None = None) -> list[dict]:
    """Downloads models. Gated ones fail with a sentence saying exactly what to accept and where."""
    models, done = manifest(), []
    for name in names or [n for n, m in models.items() if m.get("default", True)]:
        model, started, row = models[name], time.perf_counter(), {"name": name}
        try:
            if model["kind"] == "hf":
                from huggingface_hub import snapshot_download

                row["path"] = snapshot_download(model["repo"], revision=model.get("revision") or None, allow_patterns=model.get("allow") or None)
            else:
                target = paths.home() / model["into"]
                target.mkdir(parents=True, exist_ok=True)
                if not all((target / member).exists() for member in model["members"]):
                    with tempfile.TemporaryDirectory() as tmp:
                        archive = Path(tmp) / "pack.zip"
                        urllib.request.urlretrieve(model["url"], archive)
                        with zipfile.ZipFile(archive) as pack:
                            for member in model["members"]:
                                (target / member).write_bytes(pack.read(next(n for n in pack.namelist() if n.endswith(member))))
                row["path"] = str(target)
            row["ok"] = True
        except Exception as error:
            row["ok"], row["error"] = False, f"{error.__class__.__name__}: {error}"
            if model.get("gated"):
                row["hint"] = f"This model is gated. Accept its terms at https://huggingface.co/{model['repo']} and sign in on this machine with  uv run hf auth login"
        row["seconds"] = round(time.perf_counter() - started, 1)
        done.append(row)
    return done


def _peak_vram_gb() -> float | None:
    try:
        import torch

        return round(torch.cuda.max_memory_allocated() / 2**30, 2) if torch.cuda.is_available() else None
    except Exception:
        return None


def _sheet(rows: list[list[Image.Image]], target: Path, cell: int = 300) -> None:
    height = cell * 4 // 3
    sheet = Image.new("RGB", (cell * max(len(r) for r in rows), height * len(rows)), "#1b1a19")
    for y, row in enumerate(rows):
        for x, picture in enumerate(row):
            sheet.paste(picture.convert("RGB").resize((cell, height), Image.Resampling.LANCZOS), (x * cell, y * height))
    sheet.save(target, quality=82)


def smoke(engine_name: str, out: Path, photos: list[Path], worlds: list[str], private: bool = False) -> dict:
    """Seats each photograph and develops it in each world. Pictures of real people stay out of `out`: pass private=True."""
    out.mkdir(parents=True, exist_ok=True)
    pictures = paths.home() / "smoke" if private else out
    pictures.mkdir(parents=True, exist_ok=True)
    engine, started = engines.create(engine_name), time.perf_counter()
    engine.load()
    report = {"engine": engine.id, "device": engine.device, "load_s": round(time.perf_counter() - started, 1), "private": private, "renders": []}
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        studio, rows = Studio(engine, Store(Path(tmp)), faces.load(paths.home() / "models" / "faces")), []
        report["face_model"] = studio.faces is not None
        for photo in photos:
            seated, row = studio.seat(photo.read_bytes()), [Image.open(photo)]
            for world in worlds:
                entry = {"photo": photo.stem if not private else "private", "world": world, "gate": seated["gate"]}
                try:
                    record = studio.develop(seated["id"], world, "locked", seed=7)
                    plate = Image.open(studio.store.plate(record["id"]))
                    plate.load()
                    row.append(plate)
                    entry.update(ok=True, ms=record["ms"], similarity=record["similarity"], steps=record["steps"], size=list(plate.size), trace=record["trace"])
                except Exception as error:
                    entry.update(ok=False, error=f"{error.__class__.__name__}: {error}")
                report["renders"].append(entry)
            rows.append(row)
        if rows:
            _sheet(rows, pictures / f"sheet-{engine.id}.jpg")
        studio.store.close()
    report["peak_vram_gb"] = _peak_vram_gb()
    times = [r["ms"] for r in report["renders"] if r.get("ok")]
    report["median_ms"] = sorted(times)[len(times) // 2] if times else None
    (out / f"smoke-{engine.id}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def lora_check(engine_name: str, out: Path, worlds: list[str], lora: Path | None = None, trigger: str = "", adopt: bool = False) -> dict:
    """Judges a trained LoRA on the held-out photographs, and adopts it only if it helps.
    Pictures go to private/lora/check; the report in out holds numbers and nothing else."""
    home = paths.home()
    if lora:
        identity.register(home, lora, trigger or enrol.enrolled(home).get("trigger", enrol.TRIGGER))
    candidate, photos, tools = identity.candidate(home), sorted((home / "enrol" / "holdout").glob("*.jpg")), faces.load(home / "models" / "faces")
    missing = [text for absent, text in (
        (candidate is None, "there is no candidate LoRA (pass --lora <file.safetensors>)"),
        (not photos, "there are no held-out photographs (run  uv run likeness enrol  first)"),
        (tools is None, "the face models are not installed (run  uv run likeness fetch faces)"),
    ) if absent]
    if missing:
        raise SystemExit("Cannot check the LoRA: " + "; ".join(missing) + ".")
    out.mkdir(parents=True, exist_ok=True)
    engine, plates = engines.create(engine_name), {}
    engine.load()

    def keep(photo: Path, world: str, label: str, plate: Path) -> None:
        picture = Image.open(plate)
        picture.load()
        plates.setdefault(photo, [Image.open(photo)]).append(picture)

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        studio = Studio(engine, Store(Path(tmp)), tools)
        report = identity.check(studio, photos, candidate, worlds, keep=keep)
        studio.store.close()
    pictures = home / "lora" / "check"
    pictures.mkdir(parents=True, exist_ok=True)
    _sheet(list(plates.values()), pictures / "sheet.jpg", cell=240)   # each row: the photograph, then without and with, world by world
    report.update(engine=engine.id, trigger=candidate["trigger"], adopted=False, peak_vram_gb=_peak_vram_gb())
    if adopt and report["helps"]:
        identity.adopt(home, delta=report["delta"], checked=datetime.datetime.now().astimezone().isoformat(timespec="seconds"))
        report["adopted"] = True
    (out / "lora-check.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def matrix(engine_name: str, out: Path, photo: Path) -> dict:
    """Times one render per loading strategy and size. Out-of-memory is a result, not a failure."""
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for strategy in ("offload", "cuda"):
        try:
            import torch

            torch.cuda.empty_cache()
            torch.cuda.reset_peak_memory_stats()
        except Exception:
            pass
        started = time.perf_counter()
        try:
            engine = engines.create(engine_name)
            engine.strategy = strategy
            engine.load()
        except Exception as error:
            rows.append({"strategy": strategy, "ok": False, "error": f"{error.__class__.__name__}: {error}"})
            continue
        load_s = round(time.perf_counter() - started, 1)
        for width, height in ((896, 1200), (1344, 1792), (1792, 2400)):
            row = {"strategy": strategy, "size": [width, height], "load_s": load_s}
            try:
                request = engines.RenderRequest("clay", "locked", "Repaint the person in the input photograph as a hand-sculpted stop-motion clay character. Keep this exact person recognisable.", width, height, engine.default_steps, 1.0, 7, Image.open(photo))
                for attempt in ("warm", "timed"):
                    started = time.perf_counter()
                    engine.render(request, lambda i, n: None)
                    row[f"{attempt}_s"] = round(time.perf_counter() - started, 2)
                row.update(ok=True, peak_vram_gb=_peak_vram_gb())
            except Exception as error:
                row.update(ok=False, error=f"{error.__class__.__name__}: {str(error)[:300]}")
            rows.append(row)
        del engine
    report = {"engine": engine_name, "rows": rows}
    (out / f"matrix-{engine_name}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report
