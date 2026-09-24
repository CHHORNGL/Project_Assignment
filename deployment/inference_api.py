"""Small FastAPI service for a GGUF model served by llama.cpp.

The model is downloaded from Hugging Face on first use and is never loaded by
the Flask application. ``MODEL_ID`` is kept as a compatibility alias for
``GGUF_REPO_ID``; it must now point to a repository containing a real ``.gguf``
file, not the original LoRA adapter repository.
"""

from __future__ import annotations

import os
import shutil
import threading
import urllib.parse
import urllib.request
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


def _env_int(name: str, default: int, minimum: int = 0) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


GGUF_REPO_ID = os.getenv("GGUF_REPO_ID", "").strip() or os.getenv("MODEL_ID", "").strip()
GGUF_FILENAME = os.getenv("GGUF_FILENAME", "").strip()
GGUF_MODEL_URL = os.getenv("GGUF_MODEL_URL", "").strip()
GGUF_MODEL_PATH = os.getenv("GGUF_MODEL_PATH", "").strip()
GGUF_REVISION = os.getenv("GGUF_REVISION", "main").strip() or "main"
MODEL_CACHE_DIR = Path(os.getenv("MODEL_CACHE_DIR", "/data/models").strip())
HF_TOKEN = os.getenv("HF_TOKEN", "").strip() or None
INFERENCE_API_KEY = os.getenv("INFERENCE_API_KEY", "").strip()
MODEL_CHAT_FORMAT = os.getenv("MODEL_CHAT_FORMAT", "").strip() or None
MODEL_CONTEXT_SIZE = _env_int("MODEL_CONTEXT_SIZE", 4096, minimum=512)
MODEL_MAX_NEW_TOKENS = _env_int("MODEL_MAX_NEW_TOKENS", 128, minimum=1)
MODEL_THREADS = _env_int("MODEL_THREADS", 4, minimum=1)
MODEL_BATCH_SIZE = _env_int("MODEL_BATCH_SIZE", 512, minimum=1)
MODEL_GPU_LAYERS = _env_int("MODEL_GPU_LAYERS", 0, minimum=-1)
MODEL_MAX_INPUT_CHARS = _env_int("MODEL_MAX_INPUT_CHARS", 16_000, minimum=1_000)

INFERENCE_LOCK = threading.Lock()

SYSTEM_PROMPT = (
    "You are AgriSystem AI, a careful agricultural assistant. Give clear, "
    "practical advice about crops, diseases, pests, soil, irrigation, and "
    "safe treatment. Do not invent a diagnosis, pesticide dose, or guarantee. "
    "If information is missing, say what the farmer should check or ask a "
    "local agronomist."
)

app = FastAPI(title="AgriSystem GGUF Inference API", version="2.0")


class GenerationRequest(BaseModel):
    inputs: str = Field(min_length=1, max_length=20_000)
    parameters: dict[str, Any] = Field(default_factory=dict)


def _model_label() -> str:
    return GGUF_MODEL_PATH or GGUF_MODEL_URL or GGUF_REPO_ID or "not-configured"


def _validate_gguf_path(path: Path) -> Path:
    if path.suffix.lower() != ".gguf":
        raise RuntimeError(f"Model file must use .gguf format: {path.name}")
    if not path.is_file():
        raise RuntimeError(f"GGUF model file does not exist: {path}")
    return path


def _download_direct_url() -> Path:
    parsed = urllib.parse.urlparse(GGUF_MODEL_URL)
    filename = Path(parsed.path).name
    if parsed.scheme != "https" or not filename.endswith(".gguf"):
        raise RuntimeError("GGUF_MODEL_URL must be an HTTPS URL ending in .gguf")

    destination = MODEL_CACHE_DIR / filename
    if destination.is_file():
        return _validate_gguf_path(destination)

    MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    headers = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}
    request = urllib.request.Request(GGUF_MODEL_URL, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as output:
            shutil.copyfileobj(response, output)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    return _validate_gguf_path(destination)


def _resolve_model_path() -> Path:
    if GGUF_MODEL_PATH:
        return _validate_gguf_path(Path(GGUF_MODEL_PATH))
    if GGUF_MODEL_URL:
        return _download_direct_url()
    if not GGUF_REPO_ID:
        raise RuntimeError("Set GGUF_REPO_ID (or MODEL_ID) to a GGUF repository")
    if not GGUF_FILENAME or not GGUF_FILENAME.lower().endswith(".gguf"):
        raise RuntimeError("Set GGUF_FILENAME to the exact .gguf file in the model repository")

    from huggingface_hub import hf_hub_download

    path = hf_hub_download(
        repo_id=GGUF_REPO_ID,
        filename=GGUF_FILENAME,
        revision=GGUF_REVISION,
        token=HF_TOKEN,
        cache_dir=str(MODEL_CACHE_DIR),
    )
    return _validate_gguf_path(Path(path))


@lru_cache(maxsize=1)
def _load_model():
    from llama_cpp import Llama

    model_path = _resolve_model_path()
    options: dict[str, Any] = {
        "model_path": str(model_path),
        "n_ctx": MODEL_CONTEXT_SIZE,
        "n_threads": MODEL_THREADS,
        "n_batch": MODEL_BATCH_SIZE,
        "n_gpu_layers": MODEL_GPU_LAYERS,
        "verbose": False,
    }
    if MODEL_CHAT_FORMAT:
        options["chat_format"] = MODEL_CHAT_FORMAT
    return Llama(**options)


def _authorized(api_key: str | None) -> bool:
    return not INFERENCE_API_KEY or api_key == INFERENCE_API_KEY


def _bounded_float(parameters: dict[str, Any], name: str, default: float, lower: float, upper: float) -> float:
    try:
        return max(lower, min(float(parameters.get(name, default)), upper))
    except (TypeError, ValueError):
        return default


@app.get("/health")
@app.get("/healthz")
def health() -> dict[str, str]:
    """Cheap process/config check; does not allocate model memory."""
    return {"status": "ok", "backend": "llama.cpp", "model": _model_label()}


@app.get("/ready")
def ready() -> dict[str, str]:
    """Load the real model so readiness can be verified explicitly."""
    try:
        with INFERENCE_LOCK:
            _load_model()
        return {"status": "ready", "backend": "llama.cpp", "model": _model_label()}
    except Exception as exc:
        print(f"GGUF model readiness failed: {exc}")
        raise HTTPException(status_code=503, detail="GGUF model is not ready") from exc


@app.post("/")
@app.post("/generate")
def generate(
    request: GenerationRequest,
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
):
    bearer_key = ""
    if authorization and authorization.lower().startswith("bearer "):
        bearer_key = authorization[7:].strip()
    if not _authorized(x_api_key or bearer_key):
        raise HTTPException(status_code=401, detail="Invalid inference API key")

    parameters = request.parameters
    try:
        max_tokens = max(1, min(int(parameters.get("max_new_tokens", MODEL_MAX_NEW_TOKENS)), MODEL_MAX_NEW_TOKENS))
    except (TypeError, ValueError):
        max_tokens = MODEL_MAX_NEW_TOKENS
    temperature = _bounded_float(parameters, "temperature", 0.25, 0.0, 1.2)
    top_p = _bounded_float(parameters, "top_p", 0.9, 0.05, 1.0)
    repeat_penalty = _bounded_float(parameters, "repetition_penalty", 1.05, 0.8, 1.5)
    prompt = request.inputs[:MODEL_MAX_INPUT_CHARS]

    try:
        with INFERENCE_LOCK:
            model = _load_model()
            response = model.create_chat_completion(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                repeat_penalty=repeat_penalty,
            )
        choices = response.get("choices") or []
        output = ""
        if choices:
            output = str((choices[0].get("message") or {}).get("content") or "").strip()
            if not output:
                output = str(choices[0].get("text") or "").strip()
        return [{"generated_text": output}]
    except HTTPException:
        raise
    except Exception as exc:
        print(f"GGUF model inference failed: {exc}")
        raise HTTPException(status_code=503, detail="Model inference failed") from exc
