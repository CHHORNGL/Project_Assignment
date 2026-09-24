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
import re
import sys
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable


EMOJI_PATTERN = re.compile(
    r"["
    r"\U00010000-\U0010ffff"
    r"\u2600-\u27bf"
    r"\u2300-\u23ff"
    r"\u2b50\u2b55\u200d\ufe0f\u3030\u303d\u00a9\u00ae\u2122"
    r"]+",
    flags=re.UNICODE,
)


def clean_professional_text(text: str) -> str:
    """Normalize text into smooth, professional language with zero ###, **, or emojis."""
    if not text:
        return ""
    # Strip emojis
    text = EMOJI_PATTERN.sub("", text)
    # Strip markdown headers (e.g. ###, ##, #)
    text = re.sub(r"(?m)^\s*#{1,6}\s*", "", text)
    text = re.sub(r"#{2,}", "", text)
    # Strip markdown bold/italic asterisks (**, *, ***)
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    text = text.replace("**", "").replace("*", "")
    # Clean up double spaces within lines
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


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
        "You are AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. "
        "You are a professional, empathetic, and knowledgeable agricultural expert. "
        "Provide practical, clear, structured, and human-like advice about crop diseases, pests, soil, irrigation, and safe "
        "treatment. Greet users warmly, ask for missing details when needed, mention uncertainty, and recommend "
        "a local agronomist for dangerous or severe cases. Never invent an unsupported diagnosis or chemical dosage. "
        "Do not use markdown headers, bold formatting, asterisks, or emojis in your response. "
        "Deliver smooth, clean, plain text that looks natural and professional."
    ),
    "km": (
        "អ្នកគឺជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ "
        "អ្នកគឺជាអ្នកជំនាញកសិកម្មដ៏រួសរាយ រាក់ទាក់ សុជីវធម៌ និងមានវិជ្ជាជីវៈខ្ពស់ដូចមនុស្សពិតប្រាកដ។ "
        "សូមផ្តល់ដំបូន្មានជាក់ស្តែង ច្បាស់លាស់ និងរៀបចំជាចំណុចងាយយល់អំពីជំងឺដំណាំ សត្វល្អិត ដី ការស្រោចស្រព និងការព្យាបាលប្រកបដោយសុវត្ថិភាពជាភាសាខ្មែរ។ "
        "ប្រសិនបើអ្នកប្រើប្រាស់សួរសួស្តី ឬស្វាគមន៍ សូមឆ្លើយតបដោយភាពកក់ក្តៅ និងគួរសម។ "
        "ប្រសិនបើព័ត៌មានមិនគ្រប់គ្រាន់ សូមបញ្ជាក់ និងណែនាំឱ្យពិគ្រោះអ្នកជំនាញកសិកម្មក្នុងតំបន់។ មិនត្រូវបង្កើតការធ្វើរោគវិនិច្ឆ័យដោយគ្មានមូលដ្ឋានឡើយ។ "
        "សូមកុំប្រើសញ្ញាក្បាលចំណងជើងម៉ាកដោន សញ្ញាផ្កាយដិត និងកុំប្រើរូបភាពអារម្មណ៍ emoji នៅក្នុងចម្លើយឡើយ ដោយផ្តល់ចម្លើយជាអត្ថបទធម្មតាយ៉ាងរលូន និងប្រកបដោយវិជ្ជាជីវៈ។"
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
    clean_q = clean_professional_text(question)
    clean_a = clean_professional_text(answer)
    payload = _message(clean_q, clean_a, language)
    payload["metadata"] = {
        "record_id": record_id,
        "language": language,
        "category": category,
        **metadata,
    }
    return payload


def _format_disease_human_answer(
    disease: Any, language: str, symptoms: list[str], question_type: str = "general"
) -> str:
    crop_name = _field(disease.crop, "name", language) if disease.crop else ""
    disease_name = _field(disease, "name", language)
    description = _field(disease, "description", language)
    cause = _field(disease, "cause_explanation", language)
    treatment = _field(disease, "treatment", language)
    prevention = _field(disease, "prevention_tips", language)
    category = _first(disease.agriculture_category, disease.agriculture_sub_category)

    if language == "km":
        d_display = disease_name if disease_name.startswith("ជំងឺ") else f"ជំងឺ{disease_name}"
        c_display = crop_name or "ដំណាំនេះ"

        if question_type == "symptoms":
            symptom_list = "\n".join(f"- {s}" for s in symptoms) if symptoms else f"- {description}"
            return (
                f"ចំពោះ{d_display}លើដំណាំ {c_display} មានរោគសញ្ញាសំខាន់ៗដែលអ្នកអាចសង្កេតឃើញដូចខាងក្រោម៖\n\n"
                f"រោគសញ្ញាសម្គាល់៖\n{symptom_list}\n\n"
                f"ការពិពណ៌នាជំងឺ៖ {description}\n\n"
                f"ដំបូន្មានអ្នកជំនាញ៖ ប្រសិនបើលោកអ្នកប្រទះឃើញរោគសញ្ញាទាំងនេះ សូមប្រញាប់ចាត់វិធានការទប់ស្កាត់ជាបន្ទាន់ ឬពិគ្រោះជាមួយអ្នកជំនាញកសិកម្មក្នុងតំបន់ ដើម្បីការពារកុំឱ្យជំងឺឆ្លងរាលដាលកាន់តែខ្លាំង។"
            )

        if question_type == "treatment":
            symptom_note = f" (រោគសញ្ញាដែលត្រូវតាមដាន៖ {', '.join(symptoms[:3])})" if symptoms else ""
            return (
                f"ដើម្បីព្យាបាល{d_display}លើដំណាំ {c_display} ឱ្យទទួលបានប្រសិទ្ធភាពខ្ពស់ និងមានសុវត្ថិភាព សូមអនុវត្តតាមវិធានការដូចខាងក្រោម៖\n\n"
                f"វិធានការព្យាបាល៖\n{treatment}\n\n"
                f"ការណែនាំសុវត្ថិភាព និងការអនុវត្ត៖\n"
                f"- សូមអាន និងអនុវត្តតាមការណែនាំលើស្លាកសញ្ញាផលិតផលឱ្យបានត្រឹមត្រូវ ជៀសវាងការប្រើលើសកម្រិតកំណត់។\n"
                f"- ពាក់សម្ភារៈការពារខ្លួន (ម៉ាស់ ស្រោមដៃ វ៉ែនតា) ពេលបាញ់ថ្នាំ។\n"
                f"- តាមដានការវិវត្តរបស់ដំណាំក្រោយព្យាបាល{symptom_note}។ ប្រសិនបើស្ថានភាពមិនធូរស្រាល សូមទាក់ទងអ្នកបច្ចេកទេសកសិកម្មក្នុងតំបន់។"
            )

        if question_type == "prevention":
            return (
                f"ការការពារទុកជាមុន គឺជាវិធានការដ៏ល្អបំផុតដើម្បីកាត់បន្ថយការខូចខាតលើដំណាំ។ ដើម្បីការពារ{d_display}លើដំណាំ {c_display} សូមអនុវត្តតាមការណែនាំបច្ចេកទេសខាងក្រោម៖\n\n"
                f"វិធានការបង្ការ និងការពារ៖\n{prevention}\n\n"
                f"ការអនុវត្តល្អក្នុងកសិកម្ម (GAP)៖\n"
                f"- ជ្រើសរើសពូជសុទ្ធល្អដែលធន់នឹងជំងឺ និងមានប្រភពច្បាស់លាស់។\n"
                f"- សម្អាតស្មៅ និងកម្ទេចកាកសំណល់ដំណាំចាស់ៗចោល ដើម្បីកុំឱ្យជាជម្រកមេរោគ។\n"
                f"- រៀបចំប្រព័ន្ធស្រោចស្រព និងបង្ហូរទឹកឱ្យបានល្អ ជៀសវាងការជាំទឹកយូរនៅក្នុងចម្ការ។"
            )

        if question_type == "cause":
            return (
                f"មូលហេតុចម្បងដែលបង្កឱ្យកើតមាន{d_display}លើដំណាំ {c_display} រួមមាន៖\n\n"
                f"មូលហេតុ និងភ្នាក់ងារបង្កជំងឺ៖\n{cause}\n\n"
                f"កត្តាបរិស្ថានជំរុញ៖\n"
                f"- កម្រិតសំណើមខ្ពស់ កម្តៅ ឬភ្លៀងធ្លាក់ជាប់ៗគ្នា ដែលអំណោយផលដល់ការលូតលាស់នៃមេរោគ។\n"
                f"- ការដាំញឹកពេក ខ្វះពន្លឺថ្ងៃ និងខ្យល់ចេញចូលមិនគ្រប់គ្រាន់ក្នុងកម្រាលដំណាំ។\n\n"
                f"ដំបូន្មាន៖ ការគ្រប់គ្រងបរិស្ថានចម្ការឱ្យមានពន្លឺ និងខ្យល់ចេញចូលល្អ នឹងជួយកាត់បន្ថយហានិភ័យនៃការកើតជំងឺនេះបានយ៉ាងច្រើន។"
            )

        # General overview
        symptom_text = ", ".join(symptoms) if symptoms else "សូមតាមដានការប្រែប្រួលលើស្លឹក ដើម និងផ្លែ"
        cat_text = f"\nប្រភេទកសិកម្ម៖ {category}" if category else ""
        return (
            f"សេចក្តីណែនាំបច្ចេកទេសអំពី{d_display}លើដំណាំ {c_display}៖\n\n"
            f"ការពិពណ៌នា៖ {description}\n\n"
            f"រោគសញ្ញាសម្គាល់៖ {symptom_text}\n\n"
            f"មូលហេតុបង្ក៖ {cause}\n\n"
            f"វិធីសាស្រ្តព្យាបាល៖ {treatment}\n\n"
            f"ការការពារ និងបង្ការ៖ {prevention}{cat_text}\n\n"
            f"ការណែនាំពីអ្នកជំនាញ៖ សូមតាមដានសុខភាពដំណាំជាប្រចាំ។ ក្នុងករណីមានការសង្ស័យ ឬជំងឺឆ្លងរាលដាលខ្លាំង សូមទាក់ទងអ្នកជំនាញកសិកម្មក្នុងតំបន់ជាបន្ទាន់។"
        )

    # English formatting
    c_display = crop_name or "this crop"
    if question_type == "symptoms":
        symptom_list = "\n".join(f"- {s}" for s in symptoms) if symptoms else f"- {description}"
        return (
            f"Here are the primary symptoms of {disease_name} affecting {c_display}:\n\n"
            f"Identifiable Symptoms:\n{symptom_list}\n\n"
            f"Disease Overview: {description}\n\n"
            f"Agronomist Advice: If you observe these symptoms early, take immediate action to prevent further spread across your field. Consult a local agricultural extension officer for on-site verification if needed."
        )

    if question_type == "treatment":
        symptom_note = f" (Monitor key symptoms: {', '.join(symptoms[:3])})" if symptoms else ""
        return (
            f"To treat {disease_name} in {c_display} effectively and safely, follow these recommended practices:\n\n"
            f"Treatment Strategy:\n{treatment}\n\n"
            f"Safe Application & Precautions:\n"
            f"- Strictly follow manufacturer label instructions for dosage and pre-harvest intervals.\n"
            f"- Wear personal protective equipment (mask, gloves, eye protection) during chemical application.\n"
            f"- Monitor crop recovery closely{symptom_note}. If symptoms persist, seek agronomist guidance."
        )

    if question_type == "prevention":
        return (
            f"Preventative management is the most cost-effective way to protect your {c_display} from {disease_name}. Here are the recommended preventative measures:\n\n"
            f"Prevention Practices:\n{prevention}\n\n"
            f"Good Agricultural Practices (GAP):\n"
            f"- Plant certified disease-resistant crop varieties suited for your local climate.\n"
            f"- Maintain proper plant spacing and crop field sanitation to eliminate pathogen reservoirs.\n"
            f"- Ensure adequate field drainage to avoid prolonged standing water and excess humidity."
        )

    if question_type == "cause":
        return (
            f"The primary causes and contributing factors of {disease_name} in {c_display} are:\n\n"
            f"Pathogen & Underlying Cause:\n{cause}\n\n"
            f"Environmental Triggers:\n"
            f"- Prolonged high humidity, persistent rainfall, or poor air circulation within dense canopies.\n"
            f"- Soil conditions or nutritional imbalances that weaken crop resistance.\n\n"
            f"Management Tip: Improving aeration and field sanitation substantially reduces disease incidence."
        )

    # General overview
    symptom_text = ", ".join(symptoms) if symptoms else "Inspect leaves, stems, and fruits for abnormal lesions."
    cat_text = f"\nCategory: {category}" if category else ""
    return (
        f"Comprehensive Guide: {disease_name} in {c_display}:\n\n"
        f"Description: {description}\n\n"
        f"Symptoms: {symptom_text}\n\n"
        f"Cause: {cause}\n\n"
        f"Treatment: {treatment}\n\n"
        f"Prevention: {prevention}{cat_text}\n\n"
        f"Expert Guidance: Conduct regular field inspections and adopt integrated pest and disease management practices. Contact a local agricultural expert for severe infestations."
    )


def _disease_records(disease: Any) -> Iterable[dict[str, Any]]:
    crop = disease.crop
    crop_en = _field(crop, "name", "en") if crop else ""
    crop_km = _field(crop, "name", "km") if crop else ""
    disease_en = _field(disease, "name", "en")
    disease_km = _field(disease, "name", "km")
    symptoms_by_language = {
        "en": sorted({_field(symptom, "name", "en") for rule in disease.rules for symptom in rule.symptoms if _field(symptom, "name", "en")}),
        "km": sorted({_field(symptom, "name", "km") for rule in disease.rules for symptom in rule.symptoms if _field(symptom, "name", "km")}),
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

    template_defs = {
        "en": [
            ("symptoms", "What are the symptoms of {disease} in {crop}?"),
            ("symptoms", "My {crop} leaves look sick. What are the signs of {disease}?"),
            ("treatment", "How do I treat {disease} in {crop}?"),
            ("treatment", "What is the best way to cure {disease} affecting {crop}?"),
            ("prevention", "How can I prevent {disease} in {crop}?"),
            ("prevention", "What preventive measures protect {crop} from {disease}?"),
            ("cause", "What causes {disease} in {crop}?"),
            ("cause", "Why did my {crop} develop {disease}?"),
            ("general", "Please give me a complete overview of {disease} in {crop}."),
            ("general", "I need agronomic advice for managing {disease} on {crop}."),
        ],
        "km": [
            ("symptoms", "តើ{disease}លើដំណាំ {crop} មានរោគសញ្ញាអ្វីខ្លះ?"),
            ("symptoms", "ដំណាំ {crop} របស់ខ្ញុំមានរោគសញ្ញា {disease} តើគួរពិនិត្យចំណុចណាខ្លះ?"),
            ("treatment", "តើខ្ញុំគួរព្យាបាល{disease}លើដំណាំ {crop} ដូចម្តេច?"),
            ("treatment", "តើមានថ្នាំ ឬវិធីណាសម្រាប់ព្យាបាល{disease}លើដំណាំ {crop}?"),
            ("prevention", "តើធ្វើដូចម្តេចដើម្បីការពារ{disease}លើដំណាំ {crop}?"),
            ("prevention", "វិធានការបង្ការ និងការពារកុំឱ្យកើត{disease}លើដំណាំ {crop}"),
            ("cause", "តើអ្វីជាមូលហេតុនៃ{disease}លើដំណាំ {crop}?"),
            ("cause", "ហេតុអ្វីបានជាដំណាំ {crop} កើតមាន{disease}?"),
            ("general", "សូមរៀបរាប់ព័ត៌មានលម្អិតអំពី{disease}លើដំណាំ {crop}។"),
            ("general", "សូមផ្តល់ការណែនាំបច្ចេកទេសពេញលេញអំពី{disease}លើ{crop}"),
        ],
    }

    for language in languages:
        disease_name = disease_km if language == "km" else disease_en
        crop_name = crop_km if language == "km" else crop_en
        if not disease_name:
            continue
        if language == "km":
            d_display = disease_name if disease_name.startswith("ជំងឺ") else f"ជំងឺ{disease_name}"
            c_display = crop_name or "ដំណាំនេះ"
        else:
            d_display = disease_name
            c_display = crop_name or "this crop"

        for index, (qtype, template) in enumerate(template_defs[language]):
            answer = _format_disease_human_answer(
                disease, language, symptoms_by_language[language], qtype
            )
            if not answer:
                continue
            question = template.format(disease=d_display, crop=c_display)
            yield _record(
                record_id=f"disease:{disease.id}:{language}:{qtype}:{index}",
                language=language,
                question=question,
                answer=answer,
                category="disease",
                metadata={
                    "crop_id": crop.id if crop else None,
                    "crop": crop_name,
                    "disease_id": disease.id,
                    "disease": disease_name,
                    "question_type": qtype,
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
            answer = (
                f"ព័ត៌មានបច្ចេកទេស និងការដាំដុះដំណាំ {name}៖\n\n"
                f"ការពិពណ៌នា៖ {description}\n\n"
                f"ដំបូន្មានបច្ចេកទេស៖ ដើម្បីឱ្យដំណាំ {name} លូតលាស់បានល្អ និងផ្តល់ទិន្នផលខ្ពស់ "
                f"សូមជ្រើសរើសពូជសុទ្ធល្អដែលធន់នឹងជំងឺ រៀបចំដីឱ្យបានម៉ត់ល្អ គ្រប់គ្រងទឹកឱ្យបានត្រឹមត្រូវ "
                f"និងឧស្សាហ៍ចុះពិនិត្យតាមដានសត្វល្អិត និងជំងឺជាប្រចាំ។"
            )
        else:
            question = f"What should I know about growing {name}?"
            answer = (
                f"Key Technical Information for Growing {name}:\n\n"
                f"Description: {description}\n\n"
                f"Agronomic Best Practices: To achieve healthy growth and maximum yield with {name}, "
                f"select certified disease-resistant seed varieties, ensure well-prepared and well-draining soil, "
                f"maintain balanced irrigation, and regularly inspect fields for early pest or disease signs."
            )
        yield _record(
            record_id=f"crop:{crop.id}:{language}",
            language=language,
            question=question,
            answer=answer,
            category="crop",
            metadata={"crop_id": crop.id, "crop": name},
        )


def _rule_records(disease: Any) -> Iterable[dict[str, Any]]:
    crop = disease.crop
    for rule in disease.rules:
        symptoms_en = sorted({_field(symptom, "name", "en") for symptom in rule.symptoms if _field(symptom, "name", "en")})
        if symptoms_en:
            crop_name = _field(crop, "name", "en") if crop else ""
            disease_name = _field(disease, "name", "en")
            rule_name = _field(rule, "name", "en")
            question = f"Which agricultural condition may match these symptoms on {crop_name or 'a crop'}: {', '.join(symptoms_en)}?"
            answer = (
                f"Based on diagnostic rule analysis, the observable symptoms ({', '.join(symptoms_en)})"
                f" on {crop_name or 'the crop'} strongly point to {disease_name} (Rule: {rule_name}).\n\n"
                f"Clinical Assessment: These symptoms are distinctive indicators of {disease_name}. "
                f"Examine leaf undersides, stems, and surrounding plants to evaluate disease severity.\n\n"
                f"Safety Recommendation: Confirm this preliminary diagnosis with a local agricultural extension officer "
                f"before applying chemical treatments, ensuring correct dosage and safe handling."
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

        symptoms_km = sorted({_field(symptom, "name", "km") for symptom in rule.symptoms if _field(symptom, "name", "km")})
        if symptoms_km:
            crop_name_km = _field(crop, "name", "km") if crop else ""
            disease_name_km = _field(disease, "name", "km")
            d_km = disease_name_km if disease_name_km.startswith("ជំងឺ") else f"ជំងឺ{disease_name_km}"
            target_crop = f"លើដំណាំ {crop_name_km}" if crop_name_km else "លើដំណាំ"
            question_km = f"តើរោគសញ្ញាទាំងនេះ{target_crop} អាចជាជំងឺអ្វីខ្លះ៖ {', '.join(symptoms_km)}?"
            answer_km = (
                f"ផ្អែកលើការវិភាគតាមក្បួនវិនិច្ឆ័យកសិកម្ម រោគសញ្ញាជាក់ស្តែងដែលអ្នកបានសង្កេតឃើញ ({', '.join(symptoms_km)}) "
                f"{target_crop} ត្រូវគ្នាយ៉ាងខ្លាំងនឹង {d_km}។\n\n"
                f"ការវាយតម្លៃបច្ចេកទេស៖ រោគសញ្ញាទាំងនេះបង្ហាញពីសញ្ញាសម្គាល់នៃ {d_km}។ "
                f"សូមពិនិត្យមើលផ្នែកខាងក្រោមស្លឹក ដើម និងដំណាំជុំវិញបន្ថែមទៀត ដើម្បីវាយតម្លៃកម្រិតនៃការរាលដាល។\n\n"
                f"ការណែនាំសុវត្ថិភាព៖ សូមពិគ្រោះជាមួយអ្នកបច្ចេកទេសកសិកម្មក្នុងតំបន់ ឬប្រើប្រាស់មុខងារវិនិច្ឆ័យក្នុងប្រព័ន្ធ "
                f"មុននឹងសម្រេចចិត្តប្រើប្រាស់ថ្នាំកសិកម្ម ដើម្បីធានាសុវត្ថិភាព និងប្រសិទ្ធភាពខ្ពស់។"
            )
            yield _record(
                record_id=f"rule:{rule.id}:km",
                language="km",
                question=question_km,
                answer=answer_km,
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


def _identity_records() -> Iterable[dict[str, Any]]:
    qa_pairs_km = [
        (
            "តើអ្នកជាអ្នកណា?",
            "ខ្ញុំគឺជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ ខ្ញុំជាជំនួយការកសិកម្មឆ្លាតវៃ ត្រៀមខ្លួនជានិច្ចដើម្បីផ្តល់ការប្រឹក្សាបច្ចេកទេស ជួយពិនិត្យជំងឺដំណាំ និងចែករំលែកវិធីសាស្រ្តថែទាំដំណាំប្រកបដោយសុវត្ថិភាព និងប្រសិទ្ធភាព។",
        ),
        (
            "តើអ្នកណាបង្កើតអ្នក?",
            "ខ្ញុំត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ ម៉ូឌែលរបស់ខ្ញុំមានឈ្មោះថា AGY V2.0.0 ត្រូវបានរៀបចំឡើងដើម្បីជួយដល់បងប្អូនកសិករក្នុងការដោះស្រាយបញ្ហាកសិកម្ម។",
        ),
        (
            "តើនរណាជាអ្នកបង្កើត AI នេះ?",
            "AI នេះត្រូវបានបង្កើត និងដឹកនាំការអភិវឌ្ឍដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik) ជាមួយនឹងម៉ូឌែលឈ្មោះ AGY V2.0.0 សម្រាប់បម្រើដល់វិស័យកសិកម្ម។",
        ),
        (
            "តើ AI នេះបង្កើតឡើងដោយអ្នកណា?",
            "ប្រព័ន្ធ AI នេះត្រូវបានបង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik) ដំណើរការដោយម៉ូឌែល AGY V2.0.0 ដែលមានសមត្ថភាពវិភាគ និងផ្តល់ដំបូន្មានកសិកម្មយ៉ាងជាក់លាក់។",
        ),
        (
            "តើម៉ូឌែលរបស់អ្នកឈ្មោះអ្វី?",
            "ម៉ូឌែលរបស់ខ្ញុំមានឈ្មោះថា AGY V2.0.0 បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik) ជំនាញក្នុងការផ្តល់ប្រឹក្សាកសិកម្ម និងជំងឺដំណាំ។",
        ),
        (
            "តើ AI នេះប្រើម៉ូឌែលអ្វី?",
            "AI នេះដំណើរការដោយម៉ូឌែល AGY V2.0.0 បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik) ផ្តោតសំខាន់លើការផ្តល់ចំណេះដឹងកសិកម្មជាភាសាខ្មែរ និងអង់គ្លេស។",
        ),
        (
            "តើប្រធានក្រុមរបស់អ្នកឈ្មោះអ្វី?",
            "ប្រធានក្រុមដែលបានបង្កើត និងដឹកនាំការអភិវឌ្ឍខ្ញុំគឺលោក ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ ខ្ញុំជាម៉ូឌែល AGY V2.0.0។",
        ),
        (
            "តើអ្នកណាជាមេដឹកនាំគម្រោង ឬប្រធានក្រុមរបស់អ្នក?",
            "ប្រធានក្រុម និងជាអ្នកដឹកនាំគម្រោងបង្កើតខ្ញុំគឺលោក ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ ខ្ញុំដំណើរការលើម៉ូឌែល AGY V2.0.0។",
        ),
        (
            "ប្រាប់ខ្ញុំអំពីខ្លួនអ្នក",
            "ខ្ញុំគឺជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ ខ្ញុំដើរតួជាអ្នកជំនួយការបច្ចេកទេសកសិកម្ម ដែលអាចជួយលោកអ្នកក្នុងការសម្គាល់ជំងឺដំណាំ ស្វែងយល់ពីមូលហេតុ វិធានការព្យាបាល និងការបង្ការផ្សេងៗដើម្បីឱ្យដំណាំទទួលបានទិន្នផលខ្ពស់។",
        ),
        (
            "សួស្តី តើអ្នកជាអ្វី?",
            "សួស្តីបាទ/ចាស! ខ្ញុំគឺជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) ដែលបង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ ខ្ញុំជាជំនួយការកសិកម្មឆ្លាតវៃ។ តើថ្ងៃនេះលោកអ្នកមានបញ្ហាដំណាំ ឬចម្ងល់កសិកម្មអ្វីដែលខ្ញុំអាចជួយបានដែរទេ?",
        ),
        (
            "តើអ្នកណាជាអ្នកបង្កើតប្រព័ន្ធនេះ?",
            "ប្រព័ន្ធជំនួយការកសិកម្មឆ្លាតវៃនេះ ត្រូវបានបង្កើត និងដឹកនាំការអភិវឌ្ឍដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik) ដោយប្រើប្រាស់ម៉ូឌែល AGY V2.0.0។",
        ),
        (
            "តើម៉ូឌែល AGY V2.0.0 ជាអ្វី?",
            "AGY V2.0.0 គឺជាម៉ូឌែល AI ជំនួយការកសិកម្មជំនាន់ថ្មី បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik) ដែលមានសមត្ថភាពខ្ពស់ក្នុងការឆ្លើយសំណួរកសិកម្មជាភាសាខ្មែរយ៉ាងរលូន គួរសម និងប្រកបដោយវិជ្ជាជីវៈ។",
        ),
        (
            "តើអ្នកជាជំនាន់ (Version) ទីប៉ុន្មាន?",
            "ខ្ញុំគឺជាជំនាន់ AGY V2.0.0 ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។",
        ),
        (
            "តើអ្នកជាអ្នកណា ហើយអ្នកណាបង្កើតអ្នក?",
            "ជំរាបសួរលោកអ្នក! ខ្ញុំគឺជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ ខ្ញុំជាជំនួយការកសិកម្មឆ្លាតវៃ ត្រៀមខ្លួនជានិច្ចដើម្បីជួយលោកអ្នកពិនិត្យជំងឺដំណាំ វិភាគរោគសញ្ញា និងណែនាំវិធីសាស្រ្តកសិកម្មប្រកបដោយប្រសិទ្ធភាព និងសុវត្ថិភាព។",
        ),
        (
            "អ្នកជាអ្នកណា?",
            "ខ្ញុំគឺជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ តើខ្ញុំអាចជួយអ្វីលោកអ្នកបានខ្លះនៅថ្ងៃនេះ?",
        ),
        (
            "តើអ្នកជានរណា?",
            "ខ្ញុំគឺជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ ខ្ញុំរីករាយក្នុងការជួយដោះស្រាយបញ្ហាដំណាំ និងកសិកម្មជូនលោកអ្នក។",
        ),
        (
            "តើនរណាជាប្រធានក្រុម?",
            "ប្រធានក្រុមដែលបានបង្កើត និងដឹកនាំការអភិវឌ្ឍប្រព័ន្ធ និងម៉ូឌែល AGY V2.0.0 នេះ គឺលោក ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។",
        ),
    ]

    qa_pairs_en = [
        (
            "Who are you?",
            "I am AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. I am a specialized agricultural assistant dedicated to providing farmers with clear, practical, and safe farming advice.",
        ),
        (
            "Who created you?",
            "I was created and developed by Team Leader Mao Seavik. My model version is AGY V2.0.0.",
        ),
        (
            "Who made this AI?",
            "This AI was created and developed by Team Leader Mao Seavik, running on model AGY V2.0.0.",
        ),
        (
            "What is your model name?",
            "My model name is AGY V2.0.0, developed by Team Leader Mao Seavik.",
        ),
        (
            "What AI model is this?",
            "This is AgriSystem AI running on model AGY V2.0.0, developed by Team Leader Mao Seavik.",
        ),
        (
            "Who is your team leader or creator?",
            "My creator and Team Leader is Mao Seavik. My model is AGY V2.0.0.",
        ),
        (
            "Tell me about yourself.",
            "I am AgriSystem AI (model AGY V2.0.0), created by Team Leader Mao Seavik. As an agricultural assistant, I help farmers diagnose crop diseases, understand pest management, and adopt safe, sustainable agricultural techniques.",
        ),
        (
            "Hello, who are you?",
            "Hello! I am AgriSystem AI (model AGY V2.0.0), created by Team Leader Mao Seavik. How can I assist you with your crops and farming today?",
        ),
        (
            "Who developed this system?",
            "This intelligent agricultural system and model AGY V2.0.0 were developed by Team Leader Mao Seavik.",
        ),
        (
            "What is AGY V2.0.0?",
            "AGY V2.0.0 is an agricultural AI model developed by Team Leader Mao Seavik to deliver human-like, professional agricultural guidance in both Khmer and English.",
        ),
        (
            "What version are you?",
            "I am model version AGY V2.0.0, developed under the leadership of Team Leader Mao Seavik.",
        ),
        (
            "Hello! Who created you and what is your model name?",
            "Hello! I am AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. I am an intelligent agricultural assistant here to help you diagnose crop diseases and support your farm.",
        ),
        (
            "Who are you and what is your model?",
            "I am AgriSystem AI (model version: AGY V2.0.0), created and developed by Team Leader Mao Seavik. I'm here to provide smart, human-like agricultural advice for your crops.",
        ),
        (
            "Who is your team leader and what is your model version?",
            "My Team Leader and creator is Mao Seavik, and my model version is AGY V2.0.0.",
        ),
    ]

    for index, (question, answer) in enumerate(qa_pairs_km):
        yield _record(
            record_id=f"identity:km:{index}",
            language="km",
            question=question,
            answer=answer,
            category="agent_identity",
            metadata={"creator": "Team Leader Mao Seavik", "model_name": "AGY V2.0.0"},
        )

    for index, (question, answer) in enumerate(qa_pairs_en):
        yield _record(
            record_id=f"identity:en:{index}",
            language="en",
            question=question,
            answer=answer,
            category="agent_identity",
            metadata={"creator": "Team Leader Mao Seavik", "model_name": "AGY V2.0.0"},
        )


def _greeting_records() -> Iterable[dict[str, Any]]:
    qa_pairs_km = [
        (
            "សួស្តី",
            "សួស្តីបាទ/ចាស! ខ្ញុំជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ ខ្ញុំរីករាយណាស់ដែលបានជួយលោកអ្នក។ តើដំណាំរបស់អ្នកមានបញ្ហាអ្វី ឬតើខ្ញុំអាចជួយផ្តល់ដំបូន្មានកសិកម្មអ្វីខ្លះដល់អ្នកនៅថ្ងៃនេះ?",
        ),
        (
            "សួស្តី!",
            "សួស្តីបាទ/ចាស! ខ្ញុំជាជំនួយការកសិកម្ម AgriSystem AI (ម៉ូឌែល AGY V2.0.0)។ តើការដាំដុះ ឬសុខភាពដំណាំរបស់អ្នកដំណើរការយ៉ាងដូចម្តេចដែរ? សូមប្រាប់ខ្ញុំប្រសិនបើអ្នកត្រូវការជំនួយ។",
        ),
        (
            "សួស្តីបង",
            "សួស្តីបង! ខ្ញុំគឺជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ។ តើបងមានបញ្ហាលើដំណាំ ឬត្រូវការពិគ្រោះបច្ចេកទេសកសិកម្មអ្វីដែរទេបង?",
        ),
        (
            "ជំរាបសួរ",
            "ជំរាបសួរលោកអ្នក! ខ្ញុំជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ។ ខ្ញុំត្រៀមខ្លួនជួយលោកអ្នកដោះស្រាយបញ្ហាជំងឺដំណាំ ការស្រោចស្រព និងការថែទាំដំណាំជានិច្ច។ តើខ្ញុំអាចជួយអ្វីបានខ្លះថ្ងៃនេះ?",
        ),
        (
            "ជំរាបសួរបង",
            "ជំរាបសួរបង! ខ្ញុំរីករាយណាស់ដែលបានជួបបង។ ខ្ញុំជាជំនួយការកសិកម្ម AgriSystem AI (ម៉ូឌែល AGY V2.0.0)។ តើដំណាំរបស់បងមានសភាពធម្មតា ឬមានរោគសញ្ញាប្លែកអ្វីកើតឡើងដែរឬទេ?",
        ),
        (
            "ជំរាបសួរលោកគ្រូ",
            "ជំរាបសួរលោកអ្នក! ខ្ញុំជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ។ តើលោកអ្នកមានចម្ងល់ ឬត្រូវការការវិភាគលើដំណាំណាខ្លះដែរទេ?",
        ),
        (
            "សួស្តី AI",
            "សួស្តីបាទ/ចាស! ខ្ញុំជាជំនួយការកសិកម្ម AgriSystem AI (ម៉ូឌែល AGY V2.0.0)។ តើមានអ្វីឱ្យខ្ញុំជួយទាក់ទងនឹងដំណាំ ការពារជំងឺ ឬវិធីសាស្រ្តកសិកម្មថ្ងៃនេះទេ?",
        ),
        (
            "អរុណសួស្តី",
            "អរុណសួស្តី! សូមជូនពរឱ្យការងារកសិកម្មថ្ងៃនេះទទួលបានលទ្ធផលល្អ និងដំណាំលូតលាស់ល្អ។ ខ្ញុំជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0)។ តើលោកអ្នកត្រូវការឱ្យខ្ញុំជួយពិនិត្យដំណាំអ្វីដែរទេ?",
        ),
        (
            "សុខសប្បាយជាទេ?",
            "ខ្ញុំសុខសប្បាយជាធម្មតាទេ អរគុណច្រើន! ខ្ញុំជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ។ តើចម្ការ និងដំណាំរបស់អ្នកមានសុខភាពល្អធម្មតាដែរទេ?",
        ),
        (
            "សួរស្តី",
            "សួរស្តីបាទ/ចាស! ខ្ញុំគឺជាជំនួយការកសិកម្មឆ្លាតវៃ AgriSystem AI (ម៉ូឌែល AGY V2.0.0)។ តើអ្នកចង់សាកសួរព័ត៌មាន ឬដោះស្រាយបញ្ហាដំណាំអ្វីនៅថ្ងៃនេះ?",
        ),
        (
            "Hello in Khmer",
            "សួស្តីបាទ/ចាស! ជាភាសាខ្មែរយើងប្រើពាក្យ 'សួស្តី' (សម្រាប់ភាពស្និទ្ធស្នាល ឬទូទៅ) ឬ 'ជំរាបសួរ' (ប្រកបដោយការគួរសម និងការគោរព)។ ខ្ញុំជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ តើដំណាំរបស់អ្នកមានសុខភាពល្អធម្មតា ឬត្រូវការជំនួយបច្ចេកទេសអ្វីដែរទេបាទ/ចាស?",
        ),
        (
            "hello in khmer",
            "សួស្តីបាទ/ចាស! ជាភាសាខ្មែរយើងប្រើពាក្យ 'សួស្តី' ឬ 'ជំរាបសួរ'។ ខ្ញុំជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ តើថ្ងៃនេះខ្ញុំអាចជួយដោះស្រាយបញ្ហាដំណាំ ឬបច្ចេកទេសកសិកម្មអ្វីដល់លោកអ្នកបានខ្លះ?",
        ),
        (
            "Hello",
            "សួស្តីបាទ/ចាស! Hello! ខ្ញុំជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ តើខ្ញុំអាចជួយដោះស្រាយបញ្ហាដំណាំ ឬបច្ចេកទេសកសិកម្មអ្វីដល់លោកអ្នកបានខ្លះនៅថ្ងៃនេះ?",
        ),
        (
            "Hi",
            "សួស្តីបាទ/ចាស! Hi! ខ្ញុំជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ។ តើលោកអ្នកមានបញ្ហាលើដំណាំ ឬត្រូវការពិគ្រោះបច្ចេកទេសកសិកម្មអ្វីដែរទេ?",
        ),
    ]

    qa_pairs_en = [
        (
            "Hello",
            "Hello! I am AgriSystem AI (model: AGY V2.0.0), created by Team Leader Mao Seavik. How can I assist you with your crops or farming today?",
        ),
        (
            "Hi",
            "Hi there! I am AgriSystem AI (model: AGY V2.0.0), created by Team Leader Mao Seavik. What agricultural or crop health questions can I help you with today?",
        ),
        (
            "Greetings",
            "Greetings! I am AgriSystem AI (model: AGY V2.0.0), developed by Team Leader Mao Seavik. I'm ready to help you with crop care and disease management.",
        ),
        (
            "Good morning",
            "Good morning! I hope your crops are thriving today. How can I assist you with your agricultural work?",
        ),
        (
            "How are you?",
            "I am doing great, thank you! I am AgriSystem AI (model: AGY V2.0.0), ready to help with crop diseases, soil health, and safe farm practices. How are your plants doing?",
        ),
        (
            "Hello in English",
            "Hi there! In English, we greet with 'Hello' or 'Hi'! I am AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. How can I assist you with your crops or farm today?",
        ),
        (
            "hello in english",
            "Hi there! In English, we greet with 'Hello' or 'Hi'! I am AgriSystem AI (model: AGY V2.0.0), created by Team Leader Mao Seavik. How can I help you with your farming needs today?",
        ),
        (
            "Hello in Khmer",
            "In Khmer, you can say 'សួស្តី' (Suosdei - casual hello) or 'ជំរាបសួរ' (Choumreabsour - polite/respectful greeting)! I am AgriSystem AI (model: AGY V2.0.0), created under the leadership of Team Leader Mao Seavik. How can I help you with your farming needs today?",
        ),
        (
            "Hi there",
            "Hi there! Warm greetings to you! I am AgriSystem AI (model: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. What can I help you with regarding your crops or farm today?",
        ),
        (
            "Hi!",
            "Hi there! Warm greetings! I am AgriSystem AI (model: AGY V2.0.0), created by Team Leader Mao Seavik. How can I assist your farm today?",
        ),
    ]

    for index, (question, answer) in enumerate(qa_pairs_km):
        yield _record(
            record_id=f"greeting:km:{index}",
            language="km",
            question=question,
            answer=answer,
            category="greeting",
            metadata={"intent": "greeting"},
        )

    for index, (question, answer) in enumerate(qa_pairs_en):
        yield _record(
            record_id=f"greeting:en:{index}",
            language="en",
            question=question,
            answer=answer,
            category="greeting",
            metadata={"intent": "greeting"},
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
        records.extend(_identity_records())
        records.extend(_greeting_records())
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
    # Also write root train.json in instruction-output format for tools that expect it.
    train_json_path = REPO_ROOT / "train.json"
    train_instructions = [
        {"instruction": r["messages"][1]["content"], "output": r["messages"][2]["content"]}
        for r in records
    ]
    with train_json_path.open("w", encoding="utf-8") as handle:
        json.dump(train_instructions, handle, ensure_ascii=False, indent=2)

    print(
        f"Exported {len(records)} records: {train_count} train, "
        f"{validation_count} validation to {args.out_dir}, and updated {train_json_path.name}."
    )
    print("Categories:", ", ".join(f"{key}={value}" for key, value in sorted(categories.items())))
    return 0


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUTF8", "1")
    raise SystemExit(main())
