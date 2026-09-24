# GGUF inference deployment

> Legacy path: production AI inference now runs in the protected Hugging Face
> Gradio Space `Maoseavik/agrisystem-agricultural-assistant`. The Railway
> instructions below are retained only as a recoverable GGUF/llama.cpp
> alternative and are not used by the current backend.

This service uses `llama-cpp-python` and a quantized GGUF model. The Flask web
process remains lightweight and calls this service over HTTP; it does not load
model weights itself.

## 1. Create the GGUF model artifact

The trained `Maoseavik/agri-qwen3b-lora` Hub repository contains the Qwen2.5-3B
LoRA adapter files (`adapter_model.safetensors` and `adapter_config.json`). It
can now be converted into a standalone GGUF artifact.

After the adapter repository contains its weights, run the conversion script on
a machine with enough RAM or a Colab GPU:

```bash
HF_TOKEN=hf_... \
ADAPTER_ID=Maoseavik/agri-qwen3b-lora \
GGUF_REPO_ID=Maoseavik/agrisystem-qwen2.5-3b-gguf \
python scripts/convert_lora_to_gguf.py
```

The script merges the LoRA adapter into `Qwen/Qwen2.5-3B-Instruct`, converts
the merged model to GGUF, quantizes it to `Q4_K_M`, and prints the Hub upload
command. The conversion produces
`agrisystem-qwen2.5-3b-q4_k_m.gguf` for the repository
`Maoseavik/agrisystem-qwen2.5-3b-gguf`.

llama.cpp requires the model to already be in GGUF format; it cannot load the
original Transformers/PEFT adapter directly.

## 2. Railway variables

Create or select the separate Railway inference service, set its root directory
to `deployment`, and use `deployment/Dockerfile`. Set:

```env
GGUF_REPO_ID=Maoseavik/agrisystem-qwen2.5-3b-gguf
GGUF_FILENAME=agrisystem-qwen2.5-3b-q4_k_m.gguf
GGUF_REVISION=main
MODEL_CONTEXT_SIZE=4096
MODEL_MAX_NEW_TOKENS=128
MODEL_THREADS=4
MODEL_GPU_LAYERS=0
INFERENCE_API_KEY=use-a-long-random-secret
```

`MODEL_ID` is still accepted as an alias for `GGUF_REPO_ID`, but using the
explicit GGUF names avoids accidentally pointing Railway at the old LoRA
adapter repository. Set `HF_TOKEN` only when the GGUF repository is private.

Railway uses `/ready` as its health check. That endpoint downloads the model
and loads it into llama.cpp, so a bad GGUF file fails deployment validation
instead of appearing healthy until the first farmer request:

```bash
curl https://YOUR-RAILWAY-INFERENCE-DOMAIN/ready
curl -X POST https://YOUR-RAILWAY-INFERENCE-DOMAIN/generate \
  -H "Authorization: Bearer YOUR_INFERENCE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"inputs":"How can I identify rice blast disease?","parameters":{"max_new_tokens":64}}'
```

The lightweight `/health` endpoint only checks that the process is running.
`/ready` and `/generate` are the checks that prove the GGUF file is valid and
llama.cpp can load it.

## 3. Connect Flask to Railway

In the Flask admin settings, configure the inference endpoint as the Railway
URL ending in `/generate`, set the same API key, activate the model profile,
and keep the provider set to Hugging Face/custom remote inference. The model
ID shown in the profile should be the GGUF repository ID.
