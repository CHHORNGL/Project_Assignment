"""Google Colab script for fine-tuning an agricultural instruction model.

Run this file in Colab after cloning the repository and exporting the JSONL
files. It trains a LoRA adapter rather than copying full model weights. Keep
the Hugging Face token in a Colab secret or an environment variable; never
commit it to the repository.

Required environment variables:
    HF_TOKEN       Hugging Face write token
    HF_REPO_ID     e.g. your-account/agri-qwen3b-lora

Optional variables:
    DATA_DIR       defaults to /workspace/Project_Assignment/exports
    BASE_MODEL     defaults to Qwen/Qwen2.5-3B-Instruct
    OUTPUT_DIR     defaults to /workspace/agri-qwen3b-lora
"""

from __future__ import annotations

import os
import json
from pathlib import Path


DATA_DIR = Path(os.getenv("DATA_DIR", "/workspace/Project_Assignment/exports"))
BASE_MODEL = os.getenv("BASE_MODEL", "Qwen/Qwen2.5-3B-Instruct")
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "/workspace/agri-qwen3b-lora"))
HF_REPO_ID = os.getenv("HF_REPO_ID", "").strip()
HF_TOKEN = os.getenv("HF_TOKEN", "").strip()


def _validate_jsonl(path: Path) -> tuple[int, set[str]]:
    """Validate the instruction schema before loading the model or using GPU."""
    records = 0
    fingerprints: set[str] = set()
    with path.open("r", encoding="utf-8") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            if not raw_line.strip():
                continue
            try:
                example = json.loads(raw_line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON in {path}:{line_number}: {exc}") from exc
            messages = example.get("messages")
            if not isinstance(messages, list) or not messages:
                raise ValueError(f"Missing messages list in {path}:{line_number}")
            roles = [item.get("role") for item in messages if isinstance(item, dict)]
            if roles != ["system", "user", "assistant"]:
                raise ValueError(
                    f"Expected system/user/assistant roles in {path}:{line_number}; got {roles}"
                )
            if any(not isinstance(item.get("content"), str) or not item["content"].strip() for item in messages):
                raise ValueError(f"Blank message content in {path}:{line_number}")
            fingerprint = json.dumps(example, ensure_ascii=False, sort_keys=True)
            if fingerprint in fingerprints:
                raise ValueError(f"Duplicate record in {path}:{line_number}")
            fingerprints.add(fingerprint)
            records += 1
    if records == 0:
        raise ValueError(f"No training records found in {path}")
    return records, fingerprints


def _format_messages(example, tokenizer):
    """Convert our messages JSONL to the tokenizer's chat template."""
    messages = example["messages"]
    try:
        return {
            "text": tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=False,
            )
        }
    except Exception:
        # A base model without a chat template still receives a readable format.
        lines = [f"{item['role'].upper()}: {item['content']}" for item in messages]
        return {"text": "\n\n".join(lines)}


def main() -> None:
    if not HF_REPO_ID:
        raise RuntimeError(
            "Set HF_REPO_ID before training, for example account/agri-qwen3b-lora"
        )
    if not HF_TOKEN:
        raise RuntimeError("Set HF_TOKEN using a Colab secret or environment variable")

    from datasets import load_dataset
    from huggingface_hub import login
    from peft import LoraConfig
    import torch
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
    )
    from trl import SFTConfig, SFTTrainer

    train_file = DATA_DIR / "agri_train_data.jsonl"
    validation_file = DATA_DIR / "agri_validation_data.jsonl"
    if not train_file.exists() or not validation_file.exists():
        raise FileNotFoundError(
            f"Expected {train_file} and {validation_file}. Run scripts/export_to_jsonl.py first."
        )

    train_count, train_fingerprints = _validate_jsonl(train_file)
    validation_count, validation_fingerprints = _validate_jsonl(validation_file)
    overlap = train_fingerprints & validation_fingerprints
    if overlap:
        raise ValueError(f"Found {len(overlap)} records duplicated across train and validation")
    print(
        f"Validated dataset: {train_count} train records, "
        f"{validation_count} validation records, no overlap"
    )

    login(token=HF_TOKEN, add_to_git_credential=False)
    dataset = load_dataset(
        "json",
        data_files={"train": str(train_file), "validation": str(validation_file)},
    )
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, token=HF_TOKEN)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    dataset = dataset.map(
        lambda example: _format_messages(example, tokenizer),
        remove_columns=dataset["train"].column_names,
    )

    # Use bfloat16 only when the runtime supports it (for example, A100/L4).
    # T4 runtimes should use float16 for bitsandbytes compute.
    use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()

    # QLoRA keeps GPU memory manageable.
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 if use_bf16 else torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        token=HF_TOKEN,
        device_map="auto",
        quantization_config=quantization_config,
    )
    model.config.use_cache = False

    lora_config = LoraConfig(
        r=32,
        lora_alpha=64,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
    )
    
    # Use SFTConfig with cosine learning rate decay and warmup
    training_args = SFTConfig(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=4,
        per_device_train_batch_size=2,
        per_device_eval_batch_size=2,
        gradient_accumulation_steps=4,
        learning_rate=1.5e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.06,
        weight_decay=0.01,
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=50,
        save_strategy="steps",
        save_steps=50,
        save_total_limit=2,
        bf16=use_bf16,
        fp16=not use_bf16,
        gradient_checkpointing=True,
        report_to="none",
        seed=42,
        dataset_text_field="text",
        max_length=1024,
        packing=False,
        hub_model_id=HF_REPO_ID,
        hub_token=HF_TOKEN,
    )
    
    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        args=training_args,
        peft_config=lora_config,
    )
    
    trainer.train()
    metrics = trainer.evaluate()
    print("Validation metrics:", metrics)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(OUTPUT_DIR))
    trainer.push_to_hub(
        commit_message="Update AgriSystem LoRA adapter",
        token=HF_TOKEN,
    )
    print(f"LoRA Adapter uploaded successfully to https://huggingface.co/{HF_REPO_ID}")


if __name__ == "__main__":
    main()
