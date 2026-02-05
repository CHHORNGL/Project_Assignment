from flask import request, jsonify
from sqlalchemy import func

from app.extensions import db
from app.models.rule import Rule
from app.models.disease import Disease
from app.models.symptom import Symptom


# ===============================
# 🧠 CORE DIAGNOSIS ENGINE
# ===============================
def diagnose(symptom_ids):

    # Load symptoms
    symptoms = Symptom.query.filter(Symptom.id.in_(symptom_ids)).all()
    farmer_symptoms = {s.name.lower() for s in symptoms}

    if not farmer_symptoms:
        return None

    results = []

    rules = Rule.query.all()

    for rule in rules:
        rule_symptoms = {s.name.lower() for s in rule.symptoms}

        # Count matches
        matched = farmer_symptoms.intersection(rule_symptoms)
        score = len(matched) / len(rule_symptoms)

        final_confidence = score * (rule.confidence or 1)

        results.append({
            "disease": rule.disease,
            "confidence": round(final_confidence * 100, 2)
        })

    if not results:
        return None

    # Return highest confidence disease
    return max(results, key=lambda x: x["confidence"])
