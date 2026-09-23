"""Audit a crop/disease image dataset before training.

Expected layouts are either::

    dataset/{class_name}/*.jpg
    dataset/{train,val,test}/{class_name}/*.jpg

The script only scans the directory passed with ``--dataset-dir``. It does not
discover or use application uploads, chat attachments, or database images.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
SPLIT_NAMES = {"train", "val", "validation", "test"}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as image_file:
        for block in iter(lambda: image_file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _decode_check(paths: list[Path]) -> tuple[int, list[str], str]:
    try:
        from PIL import Image
    except ImportError:
        return len(paths), [], "skipped: install Pillow to verify image decoding"

    invalid: list[str] = []
    for path in paths:
        try:
            with Image.open(path) as image:
                image.verify()
        except Exception:
            invalid.append(str(path))
    return len(paths) - len(invalid), invalid, "performed"


def audit_dataset(root: Path) -> dict:
    result = {
        "dataset_dir": str(root),
        "status": "ok",
        "layout": "unknown",
        "total_images": 0,
        "class_counts": {},
        "split_counts": {},
        "duplicate_files": [],
        "cross_split_duplicates": [],
        "invalid_images": [],
        "decode_check": "not-run",
        "warnings": [],
    }

    if not root.is_dir():
        result["status"] = "missing"
        result["warnings"].append(
            "Dataset directory does not exist. Create it using the documented class-folder layout."
        )
        return result

    split_dirs = sorted(
        directory for directory in root.iterdir() if directory.is_dir() and directory.name.lower() in SPLIT_NAMES
    )
    if split_dirs:
        result["layout"] = "split_class_folders"
        groups = [(directory.name.lower(), directory) for directory in split_dirs]
    else:
        result["layout"] = "class_folders_without_split"
        groups = [("unsplit", root)]
        result["warnings"].append(
            "No train/val/test folders found. Create a deterministic split before training."
        )

    image_paths: list[Path] = []
    class_counts: Counter[str] = Counter()
    split_counts: Counter[str] = Counter()
    split_hashes: defaultdict[str, set[str]] = defaultdict(set)
    hashes: defaultdict[str, list[str]] = defaultdict(list)

    for split_name, split_root in groups:
        for class_dir in sorted(directory for directory in split_root.iterdir() if directory.is_dir()):
            class_images = sorted(
                path for path in class_dir.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
            )
            class_counts[class_dir.name] += len(class_images)
            split_counts[split_name] += len(class_images)
            for path in class_images:
                image_paths.append(path)
                digest = _sha256(path)
                hashes[digest].append(str(path))
                split_hashes[digest].add(split_name)

    result["total_images"] = len(image_paths)
    result["class_counts"] = dict(sorted(class_counts.items()))
    result["split_counts"] = dict(sorted(split_counts.items()))

    result["duplicate_files"] = sorted(
        paths for paths in hashes.values() if len(paths) > 1
    )
    result["cross_split_duplicates"] = sorted(
        paths for digest, paths in hashes.items() if len(split_hashes[digest]) > 1
    )

    if not image_paths:
        result["status"] = "empty"
        result["warnings"].append("No supported image files were found.")
        return result

    valid_count, invalid_images, decode_status = _decode_check(image_paths)
    result["invalid_images"] = invalid_images
    result["decode_check"] = decode_status
    if invalid_images:
        result["warnings"].append(f"{len(invalid_images)} image(s) failed decoding.")

    if result["duplicate_files"]:
        result["warnings"].append("Duplicate image content was found; remove duplicates before splitting.")
    if result["cross_split_duplicates"]:
        result["warnings"].append(
            "The same image appears in multiple splits; validation metrics would be misleading."
        )

    nonzero_counts = [count for count in class_counts.values() if count]
    if nonzero_counts and max(nonzero_counts) >= 5 * min(nonzero_counts):
        result["warnings"].append("Class imbalance is at least 5:1; use class weights or collect more data.")
    if len(class_counts) < 2:
        result["warnings"].append("At least two disease/classes are required for classification.")
    if split_dirs and not {"train", "val", "validation"}.intersection(split_counts):
        result["warnings"].append("A validation split is required before reporting model quality.")

    if invalid_images or result["cross_split_duplicates"]:
        result["status"] = "needs_cleanup"
    elif result["warnings"]:
        result["status"] = "warnings"
    result["valid_images"] = valid_count
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        required=True,
        help="Explicit image dataset directory; private app uploads are never scanned automatically.",
    )
    parser.add_argument("--output", type=Path, help="Optional JSON report path")
    args = parser.parse_args()

    report = audit_dataset(args.dataset_dir)
    rendered = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if report["status"] in {"ok", "warnings"} else 1


if __name__ == "__main__":
    sys.exit(main())
