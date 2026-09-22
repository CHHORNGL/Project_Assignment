"""Minimal FastAPI server for a Hugging Face adapter or merged model.

Environment:
    MODEL_ID: Hugging Face model or adapter repository.
    INFERENCE_API_KEY: optional shared secret expected in ``X-API-Key``.
    PORT: defaults to 7860 for Hugging Face Spaces.
"""

from __future__ import annotations

import os
import threading
from functools import lru_cache
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


MODEL_ID = os.getenv("MODEL_ID", "").strip()
INFERENCE_API_KEY = os.getenv("INFERENCE_API_KEY", "").strip()
# The adapter uses Qwen2.5-1.5B as its base model. CPU float32 needs roughly
# 6 GB for weights alone, so Railway uses a half-precision dtype by default.
# Set MODEL_DTYPE=float32 only when the service has enough memory.
MODEL_DTYPE = os.getenv("MODEL_DTYPE", "bfloat16").strip().lower()
MODEL_MAX_INPUT_TOKENS = max(256, int(os.getenv("MODEL_MAX_INPUT_TOKENS", "1024")))
MODEL_MAX_NEW_TOKENS = max(16, int(os.getenv("MODEL_MAX_NEW_TOKENS", "128")))
# Serialize generation so simultaneous requests cannot each allocate a large
# KV cache and trigger the platform OOM killer.
INFERENCE_LOCK = threading.Lock()

app = FastAPI(title="AgriSystem AI Inference API", version="1.0")


class GenerationRequest(BaseModel):
    inputs: str = Field(min_length=1, max_length=20_000)
    parameters: dict[str, Any] = Field(default_factory=dict)


@lru_cache(maxsize=1)
def _load_model():
    if not MODEL_ID:
        raise RuntimeError("MODEL_ID is not configured")
    import torch
    from peft import AutoPeftModelForCausalLM, PeftConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer

    token = os.getenv("HF_TOKEN", "").strip() or None
    if MODEL_DTYPE in {"bf16", "bfloat16"}:
        dtype = torch.bfloat16
    elif MODEL_DTYPE in {"fp16", "float16", "half"}:
        dtype = torch.float16
    else:
        dtype = torch.float32

    use_cuda = torch.cuda.is_available()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, token=token)

    # Detect an adapter before loading weights. A broad try/except around model
    # loading can allocate the base model, fail, and then allocate a second
    # copy during fallback, which is enough to trigger an OOM kill.
    try:
        PeftConfig.from_pretrained(MODEL_ID, token=token)
        is_adapter = True
    except Exception:
        is_adapter = False

    load_options = {
        "token": token,
        "torch_dtype": dtype,
        "low_cpu_mem_usage": True,
    }
    if use_cuda:
        load_options["device_map"] = "auto"

    if is_adapter:
        model = AutoPeftModelForCausalLM.from_pretrained(
            MODEL_ID,
            **load_options,
        )
    else:
        # This supports uploading a fully merged model instead of an adapter.
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            **load_options,
        )

    if not use_cuda:
        model = model.to("cpu")
    model.eval()
    return model, tokenizer


def _authorized(api_key: str | None) -> bool:
    return not INFERENCE_API_KEY or api_key == INFERENCE_API_KEY


@app.get("/health")
@app.get("/healthz")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_ID or "not-configured"}


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
    try:
        import torch

        # Hold the lock through loading, tokenization and generation. This also
        # prevents two simultaneous cache-miss requests from loading duplicate
        # copies of the base model during startup.
        with INFERENCE_LOCK:
            model, tokenizer = _load_model()
            encoded = tokenizer(
                request.inputs,
                return_tensors="pt",
                truncation=True,
                max_length=MODEL_MAX_INPUT_TOKENS,
            )
            device = next(model.parameters()).device
            encoded = {key: value.to(device) for key, value in encoded.items()}
            parameters = request.parameters
            cpu_limit = MODEL_MAX_NEW_TOKENS if not torch.cuda.is_available() else 512
            max_new_tokens = min(
                max(int(parameters.get("max_new_tokens", MODEL_MAX_NEW_TOKENS)), 1),
                cpu_limit,
            )
            with torch.inference_mode():
                generated = model.generate(
                    **encoded,
                    max_new_tokens=max_new_tokens,
                    temperature=float(parameters.get("temperature", 0.25)),
                    top_p=float(parameters.get("top_p", 0.9)),
                    do_sample=True,
                    pad_token_id=tokenizer.eos_token_id,
                )
            new_tokens = generated[0][encoded["input_ids"].shape[-1] :]
            output = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
        return [{"generated_text": output}]
    except HTTPException:
        raise
    except Exception as exc:
        # Do not return model paths, stack traces, or provider credentials.
        print(f"Model inference failed: {exc}")
        raise HTTPException(status_code=503, detail="Model inference failed") from exc
