FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860 \
    HF_HOME=/data/huggingface \
    MODEL_CACHE_DIR=/data/models

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip \
    && pip install --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu -r requirements.txt

COPY inference_api.py ./inference_api.py

RUN mkdir -p /data/huggingface /data/models

EXPOSE 7860

CMD ["sh", "-c", "uvicorn inference_api:app --host 0.0.0.0 --port ${PORT:-7860}"]
