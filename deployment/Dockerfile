FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860 \
    HF_HOME=/data/huggingface

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/cpu torch==2.2.2 \
    && pip install -r requirements.txt

COPY inference_api.py ./inference_api.py

RUN mkdir -p /data/huggingface

EXPOSE 7860

CMD ["sh", "-c", "uvicorn inference_api:app --host 0.0.0.0 --port ${PORT:-7860}"]
