"""Merge the project's LoRA adapter and create a quantized GGUF artifact.

This is a conversion-time tool. PyTorch, Transformers and PEFT are intentionally
not part of the Railway runtime image. Run this on Colab or another machine
with enough memory, then upload the final GGUF file to a Hub model repository.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import tempfile
from pathlib import Path


def _run(command: list[str]) -> None:
    print("+", " ".join(command))
    subprocess.run(command, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--adapter-id",
        default=os.getenv(
            "ADAPTER_ID", "Maoseavik/agrisystem-qwen2.5-3b-adapter"
        ),
    )
    parser.add_argument("--output-dir", type=Path, default=Path(os.getenv("OUTPUT_DIR", "exports/gguf")))
    parser.add_argument("--llama-cpp-dir", type=Path, default=Path(os.getenv("LLAMA_CPP_DIR", "llama.cpp")))
    parser.add_argument("--quantization", default=os.getenv("GGUF_QUANTIZATION", "Q4_K_M"))
    parser.add_argument("--gguf-repo-id", default=os.getenv("GGUF_REPO_ID", ""))
    args = parser.parse_args()

    token = os.getenv("HF_TOKEN", "").strip() or None
    if not token:
        raise SystemExit("Set HF_TOKEN in the environment; never put it in this script or git.")

    converter = args.llama_cpp_dir / "convert_hf_to_gguf.py"
    quantizer_candidates = [
        args.llama_cpp_dir / "build/bin/llama-quantize",
        args.llama_cpp_dir / "llama-quantize",
    ]
    quantizer = next((path for path in quantizer_candidates if path.exists()), None)
    if not converter.exists():
        raise SystemExit(f"Missing {converter}. Clone/build llama.cpp first.")
    if quantizer is None:
        raise SystemExit("Could not find llama-quantize under llama.cpp/build/bin or llama.cpp/")

    import torch
    from peft import AutoPeftModelForCausalLM
    from transformers import AutoTokenizer

    use_cuda = torch.cuda.is_available()
    dtype = torch.float16 if use_cuda else torch.float32
    load_options = {
        "torch_dtype": dtype,
        "low_cpu_mem_usage": True,
        "token": token,
    }
    if use_cuda:
        load_options["device_map"] = "auto"

    print(f"Loading adapter {args.adapter_id}; this requires the adapter weight files.")
    model = AutoPeftModelForCausalLM.from_pretrained(args.adapter_id, **load_options)
    merged = model.merge_and_unload()
    tokenizer = AutoTokenizer.from_pretrained(args.adapter_id, token=token)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="agri-merged-") as temporary_dir:
        merged_dir = Path(temporary_dir) / "merged"
        merged_dir.mkdir(parents=True, exist_ok=True)
        merged.save_pretrained(merged_dir, safe_serialization=True, max_shard_size="2GB")
        tokenizer.save_pretrained(merged_dir)

        f16_file = args.output_dir / "agrisystem-qwen2.5-3b-f16.gguf"
        quantized_file = args.output_dir / f"agrisystem-qwen2.5-3b-{args.quantization.lower()}.gguf"
        _run([
            "python",
            str(converter),
            str(merged_dir),
            "--outfile",
            str(f16_file),
            "--outtype",
            "f16",
        ])
        _run([
            str(quantizer),
            str(f16_file),
            str(quantized_file),
            args.quantization,
        ])

    f16_file.unlink(missing_ok=True)
    print(f"GGUF created: {quantized_file}")
    if args.gguf_repo_id:
        print("Upload it with:")
        print(
            "hf upload "
            f"{args.gguf_repo_id} {quantized_file} "
            "--type model --commit-message 'Add quantized AgriSystem GGUF model'"
        )
    else:
        print("Set GGUF_REPO_ID and run the printed hf upload command to publish it.")


if __name__ == "__main__":
    main()
