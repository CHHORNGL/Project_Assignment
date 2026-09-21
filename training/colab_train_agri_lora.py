"""Google Colab script for fine-tuning an agricultural instruction model.

Run this file in Colab after cloning the repository and exporting the JSONL
files. It trains a LoRA adapter rather than copying full model weights. Keep
the Hugging Face token in a Colab secret or an environment variable; never
commit it to the repository.

Typical Colab setup::

    !pip install -U transformers datasets peft trl bitsandbytes accelerate huggingface_hub
    !git clone https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git /content/agri-project
    %run /content/agri-project/training/colab_train_agri_lora.py

Required environment variables:
    HF_TOKEN       Hugging Face write token
    HF_REPO_ID     e.g. your-account/agrisystem-adapter

Optional variables:
    DATA_DIR       defaults to /content/agri-project/exports
    BASE_MODEL     defaults to Qwen/Qwen2.5-1.5B-Instruct
    OUTPUT_DIR     defaults to /content/agri-agri-lora
"""

from __future__ import annotations

import os
from pathlib import Path


DATA_DIR = Path(os.getenv("DATA_DIR", "/content/agri-project/exports"))
BASE_MODEL = os.getenv("BASE_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "/content/agri-lora-output"))
HF_REPO_ID = os.getenv("HF_REPO_ID", "").strip()
HF_TOKEN = os.getenv("HF_TOKEN", "").strip()


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
        raise RuntimeError("Set HF_REPO_ID before training, for example account/agrisystem-adapter")
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
        TrainingArguments,
    )
    from trl import SFTTrainer

    train_file = DATA_DIR / "agri_train_data.jsonl"
    validation_file = DATA_DIR / "agri_validation_data.jsonl"
    if not train_file.exists() or not validation_file.exists():
        raise FileNotFoundError(
            f"Expected {train_file} and {validation_file}. Run scripts/export_to_jsonl.py first."
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

    # QLoRA keeps Colab GPU memory manageable. If the selected model does not
    # support 4-bit loading, remove quantization_config and use a smaller model.
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
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
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    )
    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=3,
        per_device_train_batch_size=2,
        per_device_eval_batch_size=2,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=50,
        save_strategy="steps",
        save_steps=50,
        save_total_limit=2,
        bf16=True,
        gradient_checkpointing=True,
        report_to="none",
        seed=42,
    )
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        dataset_text_field="text",
        max_seq_length=1024,
        packing=False,
        args=training_args,
        peft_config=lora_config,
    )
    trainer.train()
    metrics = trainer.evaluate()
    print("Validation metrics:", metrics)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    trainer.push_to_hub(HF_REPO_ID, token=HF_TOKEN)
    tokenizer.push_to_hub(HF_REPO_ID, token=HF_TOKEN)
    print(f"Adapter uploaded to https://huggingface.co/{HF_REPO_ID}")


if __name__ == "__main__":
    main()
