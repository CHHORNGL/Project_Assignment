# Colab training

1. Run the exporter from the repository root:

   ```bash
   python scripts/export_to_jsonl.py --out-dir exports
   ```

2. Commit the two JSONL files and push the repository, or upload them directly
   to Colab.

3. In a Colab GPU runtime, install the training dependencies, clone the
   repository, set `HF_TOKEN` and `HF_REPO_ID`, then run:

   ```python
   %run /content/agri-project/training/colab_train_agri_lora.py
   ```

The script uploads a LoRA adapter, not a full copy of the base model. Keep the
repository private if the dataset or adapter is not intended for public use.
Evaluate the validation metrics and manually test treatment and diagnosis
answers before connecting the model to production.
