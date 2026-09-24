---
title: AgriSystem Agricultural Assistant
emoji: 🌾
colorFrom: green
colorTo: yellow
sdk: gradio
sdk_version: 5.50.0
app_file: app.py
short_description: Ask the fine-tuned agricultural assistant
python_version: "3.12"
startup_duration_timeout: 1h
---

# AgriSystem Agricultural Assistant

This Space serves `Maoseavik/agri-qwen3b-lora`, a LoRA adapter fine-tuned from
`Qwen/Qwen2.5-3B-Instruct` for agricultural questions. The tokenizer is loaded
from the original base model for runtime compatibility.

The adapter repository is public, but the base model may still require a
Hugging Face token in the Space secrets if its access policy changes. Add
`HF_TOKEN` as a secret when needed.
