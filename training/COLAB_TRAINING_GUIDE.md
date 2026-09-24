# 🌾 AgriSystem AI (AGY V2.0.0) – Google Colab Training Guide

This guide walks you through fine-tuning your custom agricultural AI model (**AGY V2.0.0**) on a free Google Colab GPU (T4 / L4 / A100) using **Qwen/Qwen2.5-3B-Instruct** and **QLoRA**.

---

## 🚀 Quick Step-by-Step Instructions

### Step 1: Open Google Colab
1. Go to [Google Colab](https://colab.research.google.com).
2. Click **New Notebook**.
3. Under **Runtime** > **Change runtime type**, select **T4 GPU** (or A100/L4 if you have Colab Pro).

---

### Step 2: Install Required Libraries
Paste and run this in the first code cell:

```python
!pip install -q -U transformers datasets trl peft bitsandbytes accelerate huggingface_hub
```

---

### Step 3: Clone the Repository or Upload Dataset
Clone your repository to get the training dataset (`exports/agri_train_data.jsonl`):

```python
!git clone https://github.com/CHHORNGL/Project_Assignment.git
%cd Project_Assignment
```

---

### Step 4: Set Environment Variables & Hugging Face Token
Add your Hugging Face write token (get it from [Hugging Face Settings > Tokens](https://huggingface.co/settings/tokens)):

```python
import os

# Your Hugging Face repository where the fine-tuned LoRA will be uploaded
os.environ["HF_REPO_ID"] = "Maoseavik/agri-qwen3b-lora"

# Your Hugging Face write token (e.g. hf_xxxx...)
os.environ["HF_TOKEN"] = "PASTE_YOUR_HF_WRITE_TOKEN_HERE"

# Base model and export paths
os.environ["BASE_MODEL"] = "Qwen/Qwen2.5-3B-Instruct"
os.environ["DATA_DIR"] = "/content/Project_Assignment/exports"
os.environ["OUTPUT_DIR"] = "/content/agri-qwen3b-lora"
```

---

### Step 5: Start Training!
Execute the training script:

```python
!python training/colab_train_agri_lora.py
```

### ⏱️ Expected Time:
- **T4 GPU:** ~25 to 35 minutes for 4 epochs (2,937 records including casual conversation & data-driven agricultural insights).
- **A100 GPU:** ~8 to 12 minutes.

---

### Step 6: Verify and Connect to Production
Once training finishes, the script automatically:
1. Evaluates validation loss and metrics.
2. Saves the fine-tuned LoRA weights.
3. Pushes the adapter directly to your Hugging Face repository: `https://huggingface.co/Maoseavik/agri-qwen3b-lora`.
4. Your Hugging Face Space (`Maoseavik/agrisystem-agricultural-assistant`) will automatically reload the newly updated adapter!
