# app/services/rule_engine.py

import re
from typing import Optional

from sqlalchemy.orm import joinedload

from app.models.rule import Rule
from app.models.disease import Disease


def _normalize(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _symptom_matches(rule_symptom: str, user_symptoms: list) -> bool:
    for user_symptom in user_symptoms:
        if rule_symptom == user_symptom:
            return True
        if rule_symptom in user_symptom or user_symptom in rule_symptom:
            return True
    return False


def diagnose(symptoms_input: list, crop_id: Optional[int] = None):
    """
    Rule-based diagnosis engine

    :param symptoms_input: list of symptoms from user
           Example: ['yellow leaves', 'brown spots']
    :return: dict {
        rule: Rule,
        matched_symptoms: list[str],
        confidence: float  # 0-1 final score
    } or None
    """

    if not symptoms_input:
        return None

    # ---------------------------------
    # Normalize input symptoms
    # ---------------------------------
    symptoms_input = [
        _normalize(s)
        for s in symptoms_input
        if _normalize(s)
    ]

    matched_results = []

    # ---------------------------------
    # Iterate through all rules
    # ---------------------------------
    rules_query = (
        Rule.query.options(
            joinedload(Rule.symptoms),
            joinedload(Rule.disease)
        )
    )

    if crop_id:
        rules_query = rules_query.join(Rule.disease).filter(
            Disease.crop_id == crop_id
        )

    for rule in rules_query.all():

        if not rule.symptoms:
            continue

        # Rule symptoms (relationship list)
        rule_symptoms = [
            _normalize(s.name)
            for s in rule.symptoms
            if s and getattr(s, "name", None) and _normalize(s.name)
        ]

        # Find matched symptoms
        matched = [
            s for s in rule_symptoms
            if _symptom_matches(s, symptoms_input)
        ]

        # If at least one symptom matches → consider rule
        if matched:
            match_ratio = len(matched) / len(rule_symptoms)
            final_confidence = match_ratio * (rule.confidence or 1.0)
            matched_results.append({
                "rule": rule,
                "matched_symptoms": matched,
                "confidence": final_confidence
            })

    # ---------------------------------
    # No rule matched
    # ---------------------------------
    if not matched_results:
        return None

    # ---------------------------------
    # Sort by confidence (highest first)
    # ---------------------------------
    matched_results.sort(
        key=lambda r: (r["confidence"], len(r["matched_symptoms"])),
        reverse=True
    )

    # Return best rule + explanation
    return matched_results[0]
