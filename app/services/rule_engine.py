# app/services/rule_engine.py

import re
from typing import Optional, Sequence

from sqlalchemy.orm import joinedload

from app.models.disease import Disease
from app.models.rule import Rule
from app.utils.i18n import normalize_display_text, get_current_language


CATEGORY_KEYWORDS = {
    "fungal": ("fung", "mildew", "rust", "blight", "mold", "rot"),
    "bacterial": ("bacter", "blight", "canker", "ooze", "spot"),
    "viral": ("virus", "mosaic", "streak", "curl"),
    "pest": ("pest", "insect", "mite", "worm", "borer", "hopper", "beetle", "thrips"),
    "nutrient": ("deficiency", "deficient", "nutrient", "nitrogen", "potassium", "phosphorus"),
    "environment": ("water stress", "drought", "flood", "heat", "cold", "sunburn", "salinity"),
}

BASE_PREVENTION_TIPS = [
    "Monitor the crop every 2-3 days and record symptom changes.",
    "Remove severely affected leaves or plants and keep the field clean.",
    "Use clean tools and avoid spreading infection between plots.",
]

CATEGORY_PREVENTION_TIPS = {
    "fungal": [
        "Improve spacing and airflow to reduce humidity around leaves.",
        "Avoid overhead irrigation late in the day.",
        "Use approved fungicide rotation only when symptoms continue to spread.",
    ],
    "bacterial": [
        "Avoid handling wet plants to reduce bacterial spread.",
        "Disinfect pruning tools between plants.",
        "Use disease-free seed and planting material next cycle.",
    ],
    "viral": [
        "Remove infected plants early to limit virus spread.",
        "Control vector insects such as aphids and whiteflies.",
        "Plant tolerant varieties when available.",
    ],
    "pest": [
        "Inspect both top and underside of leaves for insects and eggs.",
        "Use integrated pest management before chemical control.",
        "Rotate active ingredients if pesticide is required.",
    ],
    "nutrient": [
        "Verify soil pH and nutrient profile before applying fertilizer.",
        "Split fertilizer application into smaller planned doses.",
        "Combine compost with balanced nutrients to improve uptake.",
    ],
    "environment": [
        "Check irrigation timing and avoid long periods of water stress.",
        "Improve drainage where standing water is common.",
        "Use mulching to reduce sudden moisture and temperature swings.",
    ],
    "other": [
        "Collect more observations (new symptoms, spread pattern, field conditions).",
        "Ask an expert to verify diagnosis before major treatment decisions.",
    ],
}

CONFIDENCE_THRESHOLDS = (
    ("high", 0.75),
    ("medium", 0.55),
    ("low", 0.35),
)


def _normalize(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    # Keep Unicode letters/numbers so Khmer text is preserved for matching.
    text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
    text = text.replace("_", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _normalize_many(items: Sequence[str] | None) -> list[str]:
    if not items:
        return []
    cleaned: list[str] = []
    for item in items:
        norm = _normalize(item)
        if norm:
            cleaned.append(norm)
    return cleaned


def _symptom_matches(rule_symptom_aliases: Sequence[str], user_symptoms: Sequence[str]) -> bool:
    if not rule_symptom_aliases:
        return False
    aliases = [alias for alias in rule_symptom_aliases if alias]
    for user_symptom in user_symptoms:
        for alias in aliases:
            if alias == user_symptom:
                return True
            if alias in user_symptom or user_symptom in alias:
                return True
    return False


def _symptom_match_strength(rule_symptom_aliases: Sequence[str], user_symptoms: Sequence[str]) -> float:
    if not rule_symptom_aliases or not user_symptoms:
        return 0.0

    aliases = [alias for alias in rule_symptom_aliases if alias]
    if not aliases:
        return 0.0

    best = 0.0
    for user_symptom in user_symptoms:
        user_tokens = {token for token in user_symptom.split(" ") if token}
        for alias in aliases:
            if alias == user_symptom:
                return 1.0
            if alias in user_symptom or user_symptom in alias:
                shorter = min(len(alias), len(user_symptom))
                longer = max(len(alias), len(user_symptom), 1)
                best = max(best, shorter / longer)
                continue

            alias_tokens = {token for token in alias.split(" ") if token}
            if not alias_tokens or not user_tokens:
                continue
            overlap = len(alias_tokens & user_tokens) / max(len(alias_tokens), len(user_tokens))
            if overlap > best:
                best = overlap

    return _clamp01(best)


def _symptom_entry(symptom) -> Optional[dict]:
    if symptom is None:
        return None
    aliases: list[str] = []
    for raw_name in (getattr(symptom, "name", None), getattr(symptom, "name_kh", None)):
        cleaned = _normalize(normalize_display_text(raw_name or "", lang="km"))
        if cleaned and cleaned not in aliases:
            aliases.append(cleaned)
    if not aliases:
        return None

    lang = get_current_language()
    display_name = ""
    if lang == "km":
        display_name = getattr(symptom, "name_kh", None)
    if not display_name:
        display_name = getattr(symptom, "name", None)
    if not display_name:
        display_name = aliases[0]

    display_name = normalize_display_text(display_name.strip(), lang=lang)
    return {
        "canonical": aliases[0],
        "aliases": aliases,
        "display": display_name,
    }


def _infer_disease_category(disease: Optional[Disease]) -> str:
    if disease is None:
        return "other"

    disease_text = " ".join(
        filter(
            None,
            [
                _normalize(getattr(disease, "name", "") or ""),
                _normalize(getattr(disease, "description", "") or ""),
                _normalize(getattr(disease, "treatment", "") or ""),
            ],
        )
    )

    if not disease_text:
        return "other"

    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in disease_text for keyword in keywords):
            return category
    return "other"


def _confidence_tier(score: float) -> str:
    for tier, threshold in CONFIDENCE_THRESHOLDS:
        if score >= threshold:
            return tier
    return "insufficient"


def _split_knowledge_lines(raw_text: str | None) -> list[str]:
    if not raw_text:
        return []
    rows: list[str] = []
    seen = set()
    for raw_line in str(raw_text).replace("\r", "\n").split("\n"):
        cleaned = re.sub(r"^\s*[-*]+\s*", "", raw_line.strip())
        cleaned = re.sub(r"^\s*\d+\.\s*", "", cleaned).strip()
        key = cleaned.lower()
        if not cleaned or key in seen:
            continue
        seen.add(key)
        rows.append(cleaned)
    return rows


def _build_disease_knowledge_payload(disease: Optional[Disease]) -> dict:
    if disease is None:
        return {
            "cause_explanation": None,
            "treatment_steps": None,
            "prevention_tips": [],
            "references": [],
            "has_image": False,
        }

    return {
        "cause_explanation": (getattr(disease, "cause_explanation", None) or "").strip() or None,
        "treatment_steps": (getattr(disease, "treatment", None) or "").strip() or None,
        "prevention_tips": _split_knowledge_lines(getattr(disease, "prevention_tips", None)),
        "references": _split_knowledge_lines(getattr(disease, "reference_links", None)),
        "has_image": bool(getattr(disease, "knowledge_image_data", None)),
    }


def _build_prevention_recommendations(category: str, disease: Optional[Disease]) -> list[str]:
    if disease and getattr(disease, "prevention_tips", None):
        custom_tips = _split_knowledge_lines(disease.prevention_tips)
        if custom_tips:
            return custom_tips

    tips = list(BASE_PREVENTION_TIPS)
    tips.extend(CATEGORY_PREVENTION_TIPS.get(category, CATEGORY_PREVENTION_TIPS["other"]))

    if disease and getattr(disease, "severity_level", None):
        level = _normalize(disease.severity_level)
        if level in {"high", "critical"}:
            tips.append("Prioritize urgent field inspection because severity is high.")

    deduped: list[str] = []
    seen = set()
    for tip in tips:
        key = tip.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(tip)
    return deduped


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _symptom_scores_from_signals(signals: Sequence[dict], limit: int = 5) -> list[dict]:
    rows = []
    for row in signals or []:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()
        score = float(row.get("score") or 0.0)
        if not name or score <= 0:
            continue
        rows.append(
            {
                "name": name,
                "score": score,
                "match_strength": round(float(row.get("match_strength") or 0.0), 4),
                "frequency": int(row.get("frequency") or 0),
            }
        )

    if not rows:
        return []

    rows.sort(key=lambda item: (item["score"], item["match_strength"], -item["frequency"]), reverse=True)
    max_score = max(item["score"] for item in rows) or 1.0

    scored = []
    for item in rows[:max(1, limit)]:
        scored.append(
            {
                "name": item["name"],
                "percent": round((item["score"] / max_score) * 100, 1),
                "match_strength": item["match_strength"],
                "frequency": item["frequency"],
            }
        )
    return scored


def _aggregate_symptom_scores(results: Sequence[dict], limit: int = 5) -> list[dict]:
    merged = {}
    for index, result in enumerate(results or []):
        if not isinstance(result, dict):
            continue
        candidate_confidence = float(result.get("confidence") or 0.0)
        if candidate_confidence <= 0:
            continue
        rank_factor = 1.0 / (1.0 + (index * 0.25))
        for signal in (result.get("symptom_signals") or []):
            if not isinstance(signal, dict):
                continue

            symptom_name = str(signal.get("name") or "").strip()
            canonical = str(signal.get("canonical") or "").strip() or _normalize(symptom_name)
            if not symptom_name or not canonical:
                continue

            base_score = float(signal.get("score") or 0.0)
            if base_score <= 0:
                continue

            merged_entry = merged.setdefault(
                canonical,
                {
                    "name": symptom_name,
                    "score": 0.0,
                    "match_strength": 0.0,
                    "frequency": int(signal.get("frequency") or 0),
                },
            )
            merged_entry["score"] += base_score * candidate_confidence * rank_factor
            merged_entry["match_strength"] = max(
                float(merged_entry.get("match_strength") or 0.0),
                float(signal.get("match_strength") or 0.0),
            )
            frequency = int(signal.get("frequency") or 0)
            if frequency > 0:
                current_frequency = int(merged_entry.get("frequency") or 0)
                if current_frequency <= 0:
                    merged_entry["frequency"] = frequency
                else:
                    merged_entry["frequency"] = min(current_frequency, frequency)

    if not merged:
        return []

    return _symptom_scores_from_signals(list(merged.values()), limit=limit)


def _serialize_ranked_candidate(result: dict) -> dict:
    rule = result.get("rule")
    disease = rule.disease if rule and getattr(rule, "disease", None) else None
    confidence = float(result.get("confidence") or 0.0)
    symptom_scores = _symptom_scores_from_signals(result.get("symptom_signals") or [], limit=5)

    return {
        "rule_id": rule.id if rule else None,
        "rule_name": rule.name if rule else None,
        "disease_id": disease.id if disease else None,
        "disease_name": result.get("diagnosis") or (disease.name if disease else "Unknown"),
        "confidence": round(confidence, 4),
        "confidence_percent": round(confidence * 100, 1),
        "confidence_tier": _confidence_tier(confidence),
        "coverage": round(float(result.get("coverage") or 0.0), 4),
        "precision": round(float(result.get("precision") or 0.0), 4),
        "matched_symptoms": list(result.get("matched_symptoms") or []),
        "missing_symptoms": list(result.get("missing_symptoms") or []),
        "contradicted_symptoms": list(result.get("contradicted_symptoms") or []),
        "symptom_scores": symptom_scores,
        "reason": result.get("reason"),
        "treatment": (result.get("recommendations") or {}).get("solution"),
        "prevention": list(((result.get("recommendations") or {}).get("prevention") or [])),
    }


def diagnose(
    symptoms_input: list,
    crop_id: Optional[int] = None,
    negative_symptoms_input: Optional[list] = None,
    category: Optional[str] = None,
):
    """
    Score-based agricultural rule diagnosis.

    Parameters
    ----------
    symptoms_input:
        Positive/confirmed symptoms from checklist.
    crop_id:
        Optional crop filter.
    negative_symptoms_input:
        Symptoms explicitly denied by user during clarification.
    category:
        User-selected diagnosis category.
    """

    positive_symptoms = _normalize_many(symptoms_input)
    negative_symptoms = _normalize_many(negative_symptoms_input)
    selected_category = _normalize(category or "")

    if not positive_symptoms and not negative_symptoms:
        return None

    matched_results = []

    rules_query = (
        Rule.query.options(
            joinedload(Rule.symptoms),
            joinedload(Rule.disease),
        )
    )

    if crop_id:
        rules_query = rules_query.join(Rule.disease).filter(Disease.crop_id == crop_id)

    preprocessed_rules = []
    symptom_frequency: dict[str, int] = {}
    for rule in rules_query.all():
        if not rule.symptoms:
            continue

        rule_symptom_entries = []
        unique_canonical = set()
        for symptom_row in rule.symptoms:
            entry = _symptom_entry(symptom_row)
            if not entry:
                continue
            rule_symptom_entries.append(entry)
            canonical = str(entry.get("canonical") or "").strip()
            if canonical and canonical not in unique_canonical:
                unique_canonical.add(canonical)
                symptom_frequency[canonical] = symptom_frequency.get(canonical, 0) + 1

        if not rule_symptom_entries:
            continue
        preprocessed_rules.append((rule, rule_symptom_entries))

    for rule, rule_symptom_entries in preprocessed_rules:
        matched_entries = []
        matched_strength_by_key = {}
        for entry in rule_symptom_entries:
            if not _symptom_matches(entry["aliases"], positive_symptoms):
                continue
            matched_entries.append(entry)
            canonical = str(entry.get("canonical") or "").strip()
            strength = _symptom_match_strength(entry["aliases"], positive_symptoms)
            if strength <= 0:
                strength = 1.0
            if canonical:
                matched_strength_by_key[canonical] = max(
                    strength,
                    float(matched_strength_by_key.get(canonical) or 0.0),
                )

        contradicted_entries = [
            entry
            for entry in rule_symptom_entries
            if _symptom_matches(entry["aliases"], negative_symptoms)
        ]

        matched_display_by_key = {}
        for entry in matched_entries:
            canonical = str(entry.get("canonical") or "").strip()
            if not canonical:
                continue
            if canonical not in matched_display_by_key:
                matched_display_by_key[canonical] = entry["display"]
        matched = list(matched_display_by_key.values())

        contradicted_display_by_key = {}
        for entry in contradicted_entries:
            canonical = str(entry.get("canonical") or "").strip()
            if not canonical:
                continue
            if canonical not in contradicted_display_by_key:
                contradicted_display_by_key[canonical] = entry["display"]
        contradicted = list(contradicted_display_by_key.values())

        if not matched:
            continue

        coverage = len(matched_entries) / len(rule_symptom_entries)
        precision = len(matched) / max(len(set(positive_symptoms)), 1)
        contradiction_ratio = len(contradicted_entries) / len(rule_symptom_entries)

        expert_confidence = rule.confidence if rule.confidence is not None else 0.6
        expert_confidence = _clamp01(expert_confidence)

        base_score = (coverage * 0.60) + (precision * 0.20) + (expert_confidence * 0.20)
        penalty = contradiction_ratio * 0.45

        inferred_category = _infer_disease_category(rule.disease)
        category_adjustment = 0.0
        if selected_category and selected_category != "other":
            if inferred_category == selected_category:
                category_adjustment = 0.08
            elif inferred_category != "other":
                category_adjustment = -0.08

        final_confidence = _clamp01(base_score - penalty + category_adjustment)
        if final_confidence <= 0:
            continue

        matched_keys = set(matched_display_by_key.keys())
        contradicted_keys = set(contradicted_display_by_key.keys())
        missing = [
            entry["display"]
            for entry in rule_symptom_entries
            if entry["canonical"] not in matched_keys and entry["canonical"] not in contradicted_keys
        ]

        symptom_signals = []
        for canonical, symptom_name in matched_display_by_key.items():
            frequency = max(1, int(symptom_frequency.get(canonical) or 1))
            rarity_weight = 1.0 / float(frequency)
            match_strength = float(matched_strength_by_key.get(canonical) or 0.0)
            signal_score = rarity_weight * (0.65 + (0.35 * match_strength))
            symptom_signals.append(
                {
                    "name": symptom_name,
                    "canonical": canonical,
                    "score": signal_score,
                    "match_strength": match_strength,
                    "frequency": frequency,
                }
            )
        symptom_signals.sort(key=lambda item: item.get("score", 0.0), reverse=True)

        prevention_recommendations = _build_prevention_recommendations(
            inferred_category,
            rule.disease,
        )
        knowledge_payload = _build_disease_knowledge_payload(rule.disease)

        disease_name = rule.disease.name if rule.disease else "Unknown"
        reason = (
            f"The rule '{rule.name}' for '{disease_name}' matched {len(matched)} key symptom(s)"
            f" with {len(contradicted)} contradiction(s)."
        )
        if knowledge_payload["cause_explanation"]:
            reason = f"{reason} Cause insight: {knowledge_payload['cause_explanation']}"

        evidence_lines = [
            f"Matched symptoms: {', '.join(matched)}.",
            f"Coverage: {int(round(coverage * 100))}% of rule symptoms.",
        ]
        if contradicted:
            evidence_lines.append(f"Conflicting symptoms: {', '.join(contradicted)}.")
        if missing:
            evidence_lines.append(f"Unconfirmed rule symptoms: {', '.join(missing)}.")

        matched_results.append(
            {
                "rule": rule,
                "diagnosis": disease_name,
                "matched_symptoms": matched,
                "missing_symptoms": missing,
                "contradicted_symptoms": contradicted,
                "coverage": coverage,
                "precision": precision,
                "confidence": final_confidence,
                "reason": reason,
                "evidence_lines": evidence_lines,
                "inferred_category": inferred_category,
                "selected_category": selected_category or None,
                "symptom_signals": symptom_signals,
                "recommendations": {
                    "solution": (
                        knowledge_payload["treatment_steps"]
                        or "Follow integrated crop management and consult an expert for confirmation."
                    ),
                    "prevention": prevention_recommendations,
                },
                "knowledge": knowledge_payload,
            }
        )

    if not matched_results:
        return None

    matched_results.sort(
        key=lambda result: (
            result["confidence"],
            len(result["matched_symptoms"]),
            -len(result["contradicted_symptoms"]),
        ),
        reverse=True,
    )

    best = matched_results[0]
    best["confidence_tier"] = _confidence_tier(best["confidence"])
    best["confidence_percent"] = round(best["confidence"] * 100, 1)
    best["symptom_scores"] = _aggregate_symptom_scores(matched_results, limit=5)
    if not best["symptom_scores"]:
        best["symptom_scores"] = _symptom_scores_from_signals(best.get("symptom_signals") or [], limit=5)
    best["ranked_candidates"] = [
        _serialize_ranked_candidate(result)
        for result in matched_results
    ]
    best["candidate_count"] = len(best["ranked_candidates"])
    best["alternative_candidates"] = best["ranked_candidates"][1:]
    best["evidence"] = {
        "matched": best["matched_symptoms"],
        "missing": best["missing_symptoms"],
        "contradicted": best["contradicted_symptoms"],
        "coverage": round(best["coverage"], 4),
        "precision": round(best["precision"], 4),
        "symptom_scores": best["symptom_scores"],
        }

    return best
