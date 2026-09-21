# Remote inference deployment

This service is intentionally separate from Flask. Deploy it to a GPU-backed
Hugging Face Space or another host with:

```bash
pip install -r deployment/requirements.txt
MODEL_ID=your-account/agrisystem-adapter \
INFERENCE_API_KEY=replace-with-a-long-random-secret \
uvicorn deployment.inference_api:app --host 0.0.0.0 --port 7860
```

Configure the Flask server with the same URL and key:

```env
AI_PROVIDER=huggingface
HF_INFERENCE_URL=https://your-space-or-endpoint/generate
HF_TOKEN=replace-with-a-long-random-secret
```

The Flask client sends `POST` JSON with `inputs` and `parameters`, and this
service returns the Text Generation Inference-compatible response
`[{"generated_text": "..."}]`.
