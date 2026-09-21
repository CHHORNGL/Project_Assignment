"""Minimal FastAPI server for a Hugging Face adapter or merged model.

Environment:
    MODEL_ID: Hugging Face model or adapter repository.
    INFERENCE_API_KEY: optional shared secret expected in ``X-API-Key``.
    PORT: defaults to 7860 for Hugging Face Spaces.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field


MODEL_ID = os.getenv("MODEL_ID", "").strip()
INFERENCE_API_KEY = os.getenv("INFERENCE_API_KEY", "").strip()

app = FastAPI(title="AgriSystem AI Inference API", version="1.0")


class GenerationRequest(BaseModel):
    inputs: str = Field(min_length=1, max_length=20_000)
    parameters: dict[str, Any] = Field(default_factory=dict)


@lru_cache(maxsize=1)
def _load_model():
    if not MODEL_ID:
        raise RuntimeError("MODEL_ID is not configured")
    import torch
    from peft import AutoPeftModelForCausalLM
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    try:
        model = AutoPeftModelForCausalLM.from_pretrained(
            MODEL_ID,
            device_map="auto",
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        )
    except Exception:
        # This also supports uploading a fully merged model instead of an adapter.
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            device_map="auto",
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        )
    model.eval()
    return model, tokenizer


def _authorized(api_key: str | None) -> bool:
    return not INFERENCE_API_KEY or api_key == INFERENCE_API_KEY


@app.get("/health")
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

        model, tokenizer = _load_model()
        encoded = tokenizer(request.inputs, return_tensors="pt")
        device = next(model.parameters()).device
        encoded = {key: value.to(device) for key, value in encoded.items()}
        parameters = request.parameters
        max_new_tokens = min(max(int(parameters.get("max_new_tokens", 600)), 1), 1_000)
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
