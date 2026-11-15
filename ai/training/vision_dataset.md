# Crop/disease vision dataset contract

Before training an image classifier, collect consented agricultural images and
label each image with the disease or condition confirmed by an expert. Do not
use farmer chat attachments or diagnosis uploads automatically; they may contain
personal data, location information, or uncertain labels.

Use this layout:

```text
datasets/crop_disease/
├── train/
│   ├── healthy/
│   ├── rice_blast/
│   └── tomato_early_blight/
├── val/
│   ├── healthy/
│   ├── rice_blast/
│   └── tomato_early_blight/
└── test/
    ├── healthy/
    ├── rice_blast/
    └── tomato_early_blight/
```

Rules for the first dataset:

- Keep one plant/farm/session in only one split; never place near-identical
  photos in both training and validation.
- Use expert-confirmed labels and retain the original crop, disease, location
  region, date/season, and image-source metadata in a separate manifest.
- Include healthy examples and an `unknown_or_uncertain` review queue rather
  than forcing every image into a disease class.
- Start with at least 100 labelled images per class for a baseline; more is
  needed for different cultivars, lighting, phones, and field conditions.
- Keep the rule engine authoritative. A vision model should return a class,
  confidence, and abstain decision; it should not prescribe treatment itself.

Run the audit before training:

```bash
python -m pip install -r training/vision_requirements.txt
python scripts/audit_image_dataset.py \
  --dataset-dir datasets/crop_disease \
  --output exports/vision_dataset_audit.json
```

Do not proceed to model training until the report has no cross-split duplicates,
no invalid images, and a real validation split.
