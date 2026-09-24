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
import inspect
import re
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


def _build_training_args(
    sft_config_cls,
    output_dir: Path,
    use_bf16: bool,
    train_count: int,
    epochs: int = 4,
    batch_size: int = 2,
    gradient_accumulation_steps: int = 4,
):
    """Build SFTConfig / TrainingArguments dynamically compatible with any trl/transformers version."""
    steps_per_epoch = max(1, train_count // (batch_size * gradient_accumulation_steps))
    total_steps = steps_per_epoch * epochs
    warmup_steps = max(1, int(total_steps * 0.06))

    candidate_kwargs = {
        "output_dir": str(output_dir),
        "num_train_epochs": epochs,
        "per_device_train_batch_size": batch_size,
        "per_device_eval_batch_size": batch_size,
        "gradient_accumulation_steps": gradient_accumulation_steps,
        "learning_rate": 1.5e-4,
        "lr_scheduler_type": "cosine",
        "weight_decay": 0.01,
        "logging_steps": 10,
        "eval_steps": 50,
        "save_strategy": "steps",
        "save_steps": 50,
        "save_total_limit": 2,
        "bf16": use_bf16,
        "fp16": not use_bf16,
        "gradient_checkpointing": True,
        "report_to": "none",
        "seed": 42,
        "dataset_text_field": "text",
        "packing": False,
        "hub_model_id": HF_REPO_ID,
    }

    try:
        init_params = inspect.signature(sft_config_cls.__init__).parameters
        has_var_kwargs = any(
            p.kind == inspect.Parameter.VAR_KEYWORD for p in init_params.values()
        )
    except Exception:
        init_params = {}
        has_var_kwargs = True

    # Check parameter availability
    if "warmup_ratio" in init_params:
        candidate_kwargs["warmup_ratio"] = 0.06
    else:
        candidate_kwargs["warmup_steps"] = warmup_steps

    if "eval_strategy" in init_params:
        candidate_kwargs["eval_strategy"] = "steps"
    elif "evaluation_strategy" in init_params:
        candidate_kwargs["evaluation_strategy"] = "steps"
    else:
        candidate_kwargs["eval_strategy"] = "steps"

    if "max_length" in init_params:
        candidate_kwargs["max_length"] = 1024
    elif "max_seq_length" in init_params:
        candidate_kwargs["max_seq_length"] = 1024
    else:
        candidate_kwargs["max_length"] = 1024

    if "hub_token" in init_params:
        candidate_kwargs["hub_token"] = HF_TOKEN
    elif "token" in init_params:
        candidate_kwargs["token"] = HF_TOKEN
    else:
        candidate_kwargs["hub_token"] = HF_TOKEN

    if init_params and not has_var_kwargs:
        filtered_kwargs = {k: v for k, v in candidate_kwargs.items() if k in init_params}
    else:
        filtered_kwargs = dict(candidate_kwargs)

    while True:
        try:
            training_args = sft_config_cls(**filtered_kwargs)
            break
        except TypeError as exc:
            msg = str(exc)
            if "unexpected keyword argument" in msg:
                match = re.search(r"unexpected keyword argument '([^']+)'", msg)
                if match:
                    bad_arg = match.group(1)
                    print(f"Adapting SFTConfig: removing unsupported argument '{bad_arg}'")
                    filtered_kwargs.pop(bad_arg, None)
                    continue
            raise

    if hasattr(training_args, "warmup_ratio") and getattr(training_args, "warmup_ratio", None) is None:
        try:
            training_args.warmup_ratio = 0.06
        except Exception:
            pass
    if hasattr(training_args, "warmup_steps") and not getattr(training_args, "warmup_steps", 0):
        try:
            training_args.warmup_steps = warmup_steps
        except Exception:
            pass

    return training_args


def _build_trainer(
    sft_trainer_cls,
    model,
    tokenizer,
    dataset,
    training_args,
    lora_config,
):
    """Instantiate SFTTrainer with backwards/forwards-compatible argument mapping."""
    trainer_kwargs = {
        "model": model,
        "train_dataset": dataset["train"],
        "eval_dataset": dataset["validation"],
        "args": training_args,
        "peft_config": lora_config,
    }
    try:
        sft_params = inspect.signature(sft_trainer_cls.__init__).parameters
        if "processing_class" in sft_params:
            trainer_kwargs["processing_class"] = tokenizer
        else:
            trainer_kwargs["tokenizer"] = tokenizer
    except Exception:
        trainer_kwargs["processing_class"] = tokenizer

    while True:
        try:
            return sft_trainer_cls(**trainer_kwargs)
        except TypeError as exc:
            msg = str(exc)
            if "unexpected keyword argument" in msg:
                match = re.search(r"unexpected keyword argument '([^']+)'", msg)
                if match:
                    bad_arg = match.group(1)
                    print(f"Adapting SFTTrainer: adjusting argument '{bad_arg}'")
                    if bad_arg == "processing_class":
                        trainer_kwargs.pop("processing_class", None)
                        trainer_kwargs["tokenizer"] = tokenizer
                        continue
                    elif bad_arg == "tokenizer":
                        trainer_kwargs.pop("tokenizer", None)
                        trainer_kwargs["processing_class"] = tokenizer
                        continue
                    else:
                        trainer_kwargs.pop(bad_arg, None)
                        continue
            raise


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
    
    # Build resilient training arguments and trainer
    training_args = _build_training_args(
        sft_config_cls=SFTConfig,
        output_dir=OUTPUT_DIR,
        use_bf16=use_bf16,
        train_count=train_count,
        epochs=4,
        batch_size=2,
        gradient_accumulation_steps=4,
    )
    
    trainer = _build_trainer(
        sft_trainer_cls=SFTTrainer,
        model=model,
        tokenizer=tokenizer,
        dataset=dataset,
        training_args=training_args,
        lora_config=lora_config,
    )
    
    trainer.train()
    metrics = trainer.evaluate()
    print("Validation metrics:", metrics)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(OUTPUT_DIR))
    try:
        trainer.push_to_hub(
            commit_message="Update AgriSystem LoRA adapter",
            token=HF_TOKEN,
        )
    except TypeError:
        trainer.push_to_hub(
            commit_message="Update AgriSystem LoRA adapter",
        )
    print(f"LoRA Adapter uploaded successfully to https://huggingface.co/{HF_REPO_ID}")


if __name__ == "__main__":
    main()
