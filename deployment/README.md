# Remote inference deployment

This service is intentionally separate from Flask. Deploy it to a GPU-backed
Hugging Face Space or another host with:

```bash
pip install --index-url https://download.pytorch.org/whl/cpu torch==2.2.2
pip install -r deployment/requirements.txt
MODEL_ID=your-account/agrisystem-adapter \
INFERENCE_API_KEY=replace-with-a-long-random-secret \
uvicorn deployment.inference_api:app --host 0.0.0.0 --port 7860
```

## Railway

Create a separate Railway service from this repository and set its **Root
Directory** to `deployment`. Railway will then use `deployment/Dockerfile`
and `deployment/railway.json`. Set these variables:

```env
MODEL_ID=Maoseavik/agrisystem-adapter
MODEL_DTYPE=bfloat16
MODEL_MAX_INPUT_TOKENS=1024
MODEL_MAX_NEW_TOKENS=128
INFERENCE_API_KEY=replace-with-a-long-random-secret
```

The `/health` endpoint is intentionally lightweight and does not load the
model. The model is loaded on the first `/generate` request. A 1.5B model
needs substantial memory on CPU; if Railway metrics show an OOM kill, use a
GPU-backed host or deploy a quantized model instead of switching back to
`MODEL_DTYPE=float32`.

## Connect it to the admin settings

The admin settings are stored in the Flask application's database. They select
which remote endpoint the Flask app calls; they do not provide environment
variables to this separate Railway container. Configure both sides:

1. In this Railway inference service, set `MODEL_ID` and `INFERENCE_API_KEY`.
2. In Admin → Settings → Trained AI model, use the same model ID, set the
   public Gradio Space URL (for example `https://username-space-name.hf.space`),
   leave the API key blank for a public Space, and activate it. The Flask
   client automatically calls the Space's `/gradio_api/call/answer` endpoint.

For the current model:

```text
Model ID: Maoseavik/agrisystem-adapter
Endpoint: https://<username-space-name>.hf.space
```

Configure the Flask server with the same URL and key:

```env
AI_PROVIDER=huggingface
HF_INFERENCE_URL=https://<username-space-name>.hf.space
# Only needed for a private Space or gated base model.
HF_TOKEN=optional-huggingface-token
```

The Flask client supports both the custom `/generate` service and Gradio's
queued `/gradio_api/call/answer` API.
