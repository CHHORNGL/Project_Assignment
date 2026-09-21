"""Export the agricultural knowledge base as instruction-tuning JSONL.

This script deliberately reads only agricultural knowledge tables. It does not
export users, chat messages, diagnoses, API keys, or other private data.

Usage (from the repository root)::

    python scripts/export_to_jsonl.py
    python scripts/export_to_jsonl.py --out-dir exports --validation-ratio 0.2

The resulting files use the ``messages`` format accepted by most supervised
fine-tuning tools. The split is deterministic, so rerunning the export does
not move examples between train and validation unless the source data changes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable


# When invoked as ``python scripts/export_to_jsonl.py``, Python puts the
# scripts directory on sys.path rather than the repository root. Add the root
# explicitly so the Flask application package can be imported reliably.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - dependencies are installed in normal project use
    def load_dotenv() -> bool:
        return False


SYSTEM_PROMPTS = {
    "en": (
        "You are a careful agricultural expert. Give practical advice based "
        "only on the supplied knowledge. If the information is insufficient, "
        "say so and recommend consulting a local agricultural expert."
    ),
    "km": (
        "អ្នកជំនាញកសិកម្មដែលមានការប្រុងប្រយ័ត្ន។ ផ្តល់ដំបូន្មានជាក់ស្តែង "
        "ដោយផ្អែកតែលើចំណេះដឹងដែលបានផ្តល់។ ប្រសិនបើព័ត៌មានមិនគ្រប់គ្រាន់ "
        "សូមបញ្ជាក់ថាមិនប្រាកដ ហើយណែនាំឱ្យពិគ្រោះអ្នកជំនាញកសិកម្មក្នុងតំបន់។"
    ),
}


def _text(value: Any) -> str:
    """Return normalized, non-empty text without leaking database reprs."""
    if value is None:
        return ""
    return " ".join(str(value).strip().split())


def _first(*values: Any) -> str:
    for value in values:
        result = _text(value)
        if result:
            return result
    return ""


def _has_khmer(*values: Any) -> bool:
    return any("\u1780" <= char <= "\u17ff" for value in values for char in _text(value))


def _field(obj: Any, name: str, language: str, fallback: str = "") -> str:
    if language == "km":
        localized = _text(getattr(obj, f"{name}_kh", None))
        if localized:
            return localized
    return _first(getattr(obj, name, None), fallback)


def _message(question: str, answer: str, language: str) -> dict[str, Any]:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPTS[language]},
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ]
    }


def _record(
    *,
    record_id: str,
    language: str,
    question: str,
    answer: str,
    category: str,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    payload = _message(question, answer, language)
    payload["metadata"] = {
        "record_id": record_id,
        "language": language,
        "category": category,
        **metadata,
    }
    return payload


def _disease_answer(disease: Any, language: str, symptoms: list[str]) -> str:
    crop_name = _field(disease.crop, "name", language) if disease.crop else ""
    disease_name = _field(disease, "name", language)
    sections = [f"Crop: {crop_name}" if crop_name else "", f"Disease: {disease_name}"]

    description = _field(disease, "description", language)
    cause = _field(disease, "cause_explanation", language)
    treatment = _field(disease, "treatment", language)
    prevention = _field(disease, "prevention_tips", language)
    category = _first(disease.agriculture_category, disease.agriculture_sub_category)

    if description:
        sections.append(f"Description: {description}")
    if symptoms:
        sections.append(f"Symptoms: {', '.join(symptoms)}")
    if cause:
        sections.append(f"Cause: {cause}")
    if treatment:
        sections.append(f"Treatment: {treatment}")
    if prevention:
        sections.append(f"Prevention: {prevention}")
    if category:
        sections.append(f"Category: {category}")
    return "\n".join(section for section in sections if section)


def _disease_records(disease: Any) -> Iterable[dict[str, Any]]:
    crop = disease.crop
    crop_en = _field(crop, "name", "en") if crop else ""
    crop_km = _field(crop, "name", "km") if crop else ""
    disease_en = _field(disease, "name", "en")
    disease_km = _field(disease, "name", "km")
    symptoms_by_language = {
        "en": sorted({_field(symptom, "name", "en") for rule in disease.rules for symptom in rule.symptoms}),
        "km": sorted({_field(symptom, "name", "km") for rule in disease.rules for symptom in rule.symptoms}),
    }

    localized_values = [
        getattr(disease, "name_kh", None),
        getattr(disease, "description_kh", None),
        getattr(disease, "cause_explanation_kh", None),
        getattr(disease, "treatment_kh", None),
        getattr(disease, "prevention_tips_kh", None),
        getattr(crop, "name_kh", None) if crop else None,
        *(
            getattr(symptom, "name_kh", None)
            for rule in disease.rules
            for symptom in rule.symptoms
        ),
    ]
    languages = ["en", "km"] if _has_khmer(*localized_values) else ["en"]

    templates = {
        "en": [
            "What are the symptoms of {disease} in {crop}?",
            "How do I treat {disease} in {crop}?",
            "How can I prevent {disease} in {crop}?",
            "What causes {disease} in {crop}?",
        ],
        "km": [
            "តើជំងឺ {disease} លើដំណាំ {crop} មានរោគសញ្ញាអ្វីខ្លះ?",
            "តើខ្ញុំគួរព្យាបាលជំងឺ {disease} លើដំណាំ {crop} ដូចម្តេច?",
            "តើធ្វើដូចម្តេចដើម្បីការពារជំងឺ {disease} លើដំណាំ {crop}?",
            "តើអ្វីជាមូលហេតុនៃជំងឺ {disease} លើដំណាំ {crop}?",
        ],
    }

    for language in languages:
        disease_name = disease_km if language == "km" else disease_en
        crop_name = crop_km if language == "km" else crop_en
        if not disease_name:
            continue
        answer = _disease_answer(disease, language, symptoms_by_language[language])
        if not answer:
            continue
        for index, template in enumerate(templates[language]):
            question = template.format(disease=disease_name, crop=crop_name or "this crop")
            yield _record(
                record_id=f"disease:{disease.id}:{language}:{index}",
                language=language,
                question=question,
                answer=answer,
                category="disease",
                metadata={
                    "crop_id": crop.id if crop else None,
                    "crop": crop_name,
                    "disease_id": disease.id,
                    "disease": disease_name,
                },
            )


def _crop_records(crop: Any) -> Iterable[dict[str, Any]]:
    languages = ["en", "km"] if _has_khmer(crop.name_kh, crop.description_kh) else ["en"]
    for language in languages:
        name = _field(crop, "name", language)
        description = _field(crop, "description", language)
        if not name or not description:
            continue
        if language == "km":
            question = f"តើអ្វីជាព័ត៌មានសំខាន់អំពីដំណាំ {name}?"
        else:
            question = f"What should I know about growing {name}?"
        yield _record(
            record_id=f"crop:{crop.id}:{language}",
            language=language,
            question=question,
            answer=f"Crop: {name}\nDescription: {description}",
            category="crop",
            metadata={"crop_id": crop.id, "crop": name},
        )


def _rule_records(disease: Any) -> Iterable[dict[str, Any]]:
    crop = disease.crop
    for rule in disease.rules:
        symptoms_en = sorted({_field(symptom, "name", "en") for symptom in rule.symptoms if _field(symptom, "name", "en")})
        if not symptoms_en:
            continue
        crop_name = _field(crop, "name", "en") if crop else ""
        disease_name = _field(disease, "name", "en")
        rule_name = _field(rule, "name", "en")
        question = f"Which agricultural condition may match these symptoms on {crop_name or 'a crop'}: {', '.join(symptoms_en)}?"
        answer = (
            f"The rule '{rule_name}' is associated with {disease_name}"
            f"{f' on {crop_name}' if crop_name else ''}."
            f" Relevant symptoms are: {', '.join(symptoms_en)}."
            " Confirm the diagnosis with additional symptoms or a local expert before treatment."
        )
        yield _record(
            record_id=f"rule:{rule.id}:en",
            language="en",
            question=question,
            answer=answer,
            category="diagnostic_rule",
            metadata={
                "crop_id": crop.id if crop else None,
                "disease_id": disease.id,
                "rule_id": rule.id,
                "confidence": rule.confidence,
            },
        )


def _mixed_fact_records(fact: Any) -> Iterable[dict[str, Any]]:
    fact_text = _text(fact.fact_text)
    topic = _text(fact.topic) or "agriculture"
    if not fact_text:
        return
    question = f"What does the agricultural knowledge base say about {topic}?"
    source = fact.source
    answer = fact_text
    if source and _text(source.source_title):
        answer += f"\nSource: {_text(source.source_title)}"
    yield _record(
        record_id=f"mixed_fact:{fact.id}:en",
        language="en",
        question=question,
        answer=answer,
        category="agricultural_fact",
        metadata={
            "fact_id": fact.id,
            "topic": topic,
            "region": _text(fact.region),
            "source_id": fact.source_id,
            "source_url": _text(source.source_url) if source else "",
        },
    )


def _records() -> list[dict[str, Any]]:
    # Import after dotenv is loaded so the Flask application sees DATABASE_URL.
    from sqlalchemy.orm import joinedload, selectinload

    from app import create_app
    from app.extensions import db
    from app.models import Crop, Disease, MixedAgriFact, Rule

    app = create_app()
    with app.app_context():
        crops = Crop.query.options(selectinload(Crop.diseases)).order_by(Crop.id).all()
        diseases = (
            Disease.query.options(
                joinedload(Disease.crop),
                selectinload(Disease.rules).selectinload(Rule.symptoms),
            )
            .order_by(Disease.id)
            .all()
        )
        facts = (
            MixedAgriFact.query.options(joinedload(MixedAgriFact.source))
            .order_by(MixedAgriFact.id)
            .all()
        )

        records: list[dict[str, Any]] = []
        for crop in crops:
            records.extend(_crop_records(crop))
        for disease in diseases:
            records.extend(_disease_records(disease))
            records.extend(_rule_records(disease))
        for fact in facts:
            records.extend(_mixed_fact_records(fact))
        db.session.remove()
        return records


def _split(records: list[dict[str, Any]], validation_ratio: float) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    train: list[dict[str, Any]] = []
    validation: list[dict[str, Any]] = []
    for record in records:
        digest = hashlib.sha256(record["metadata"]["record_id"].encode("utf-8")).hexdigest()
        bucket = int(digest[:8], 16) / 0xFFFFFFFF
        (validation if bucket < validation_ratio else train).append(record)
    return train, validation


def _write_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> int:
    count = 0
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
            count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=Path("exports"))
    parser.add_argument("--validation-ratio", type=float, default=0.2)
    args = parser.parse_args()
    if not 0 < args.validation_ratio < 1:
        parser.error("--validation-ratio must be between 0 and 1")

    load_dotenv()
    records = _records()
    if not records:
        raise SystemExit("No agricultural records found. Seed the database first.")

    # De-duplicate by stable ID while preserving source order.
    unique: dict[str, dict[str, Any]] = {}
    for record in records:
        unique.setdefault(record["metadata"]["record_id"], record)
    records = list(unique.values())
    train, validation = _split(records, args.validation_ratio)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    train_path = args.out_dir / "agri_train_data.jsonl"
    validation_path = args.out_dir / "agri_validation_data.jsonl"
    train_count = _write_jsonl(train_path, train)
    validation_count = _write_jsonl(validation_path, validation)

    categories = Counter(record["metadata"]["category"] for record in records)
    manifest = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source_date": date.today().isoformat(),
        "record_count": len(records),
        "train_count": train_count,
        "validation_count": validation_count,
        "validation_ratio": args.validation_ratio,
        "categories": dict(sorted(categories.items())),
        "files": [train_path.name, validation_path.name],
        "private_data_excluded": True,
    }
    (args.out_dir / "agri_dataset_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Exported {len(records)} records: {train_count} train, "
        f"{validation_count} validation to {args.out_dir}."
    )
    print("Categories:", ", ".join(f"{key}={value}" for key, value in sorted(categories.items())))
    return 0


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUTF8", "1")
    raise SystemExit(main())
