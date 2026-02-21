# Rule-Based Agricultural Diagnosis Engine

This design follows the required flow for low-technical-literacy farmers:

1. Category selection
2. Structured symptom checklist
3. Adaptive clarification (max 5-7 questions)
4. Score-based rule matching
5. Confidence evaluation
6. Structured output (Diagnosis, Reason, Evidence)
7. Solution + prevention recommendations
8. User feedback loop

## 1) Diagnosis Logic Architecture

Components:

- `UI Wizard (Farmer)`  
  Collects only guided input: category, crop, yes/no/skip symptom answers.
- `Diagnosis Controller (Flask route)`  
  Validates payload, maps symptom IDs, calls rule engine, stores structured result.
- `Rule Engine (Scoring Service)`  
  Computes candidate rule scores from positive and negative symptoms.
- `Knowledge Base (DB)`  
  Stores crops, diseases, symptoms, rules, and rule-symptom relations.
- `Diagnosis Store (DB)`  
  Stores user answers, confidence tier, evidence, recommendations, and feedback.
- `Result + Feedback UI`  
  Shows structured diagnosis and collects farmer feedback for future improvement.

Data flow:

- Farmer selects category + crop.
- Wizard asks adaptive yes/no questions (5-7 max).
- Flask submits confirmed/denied symptoms to rule engine.
- Rule engine returns top scored rule + structured explanation.
- Diagnosis is persisted and shown in result view.
- Farmer submits feedback (`helpful` / `not_helpful` + optional comment).

## 2) Decision Algorithm

Inputs:

- `crop_id`
- `diagnosis_category`
- `positive_symptoms[]`
- `negative_symptoms[]`

Scoring for each candidate rule:

- `coverage = matched_rule_symptoms / total_rule_symptoms`
- `precision = matched_rule_symptoms / total_positive_symptoms`
- `contradiction_ratio = contradicted_rule_symptoms / total_rule_symptoms`
- `expert_confidence = rule.confidence` (0-1)

Combined score:

- `base = 0.60*coverage + 0.20*precision + 0.20*expert_confidence`
- `penalty = 0.45*contradiction_ratio`
- `category_adjustment = +0.08 (if category aligns) / -0.08 (if category conflicts)`
- `final_confidence = clamp(base - penalty + category_adjustment, 0, 1)`

Selection:

- Keep rules with at least 1 positive match.
- Sort by:
  1) `final_confidence` desc  
  2) number of matched symptoms desc  
  3) number of contradicted symptoms asc
- Select top rule as diagnosis candidate.

Confidence tiers:

- `high >= 0.75`
- `medium >= 0.55`
- `low >= 0.35`
- `insufficient < 0.35`

## 3) Database Schema

Core knowledge schema (existing):

- `crops(id, name, ...)`
- `diseases(id, crop_id, name, description, treatment, severity_level, ...)`
- `symptoms(id, name, ...)`
- `rules(id, disease_id, name, confidence)`
- `rule_symptoms(rule_id, symptom_id)`

Diagnosis session schema (`expert_diagnoses`) extensions:

- `diagnosis_category` `VARCHAR(40)`
- `confidence_level` `VARCHAR(20)`
- `selected_symptom_ids` `JSON`
- `denied_symptom_ids` `JSON`
- `clarification_answers` `JSON`
- `diagnosis_reason` `TEXT`
- `diagnosis_evidence` `JSON`
- `prevention_recommendations` `TEXT`
- `feedback_rating` `VARCHAR(20)`
- `feedback_comment` `TEXT`
- `feedback_submitted_at` `DATETIME`

## 4) Flask Backend Pseudo-code

```python
@farmer_bp.post("/diagnose/rule-based")
def diagnose_rule_based():
    crop_id = form["crop_id"]
    category = form.get("diagnosis_category", "other")
    positive_ids = parse_int_list(form.getlist("symptoms"))
    negative_ids = parse_int_list(form.getlist("denied_symptoms"))
    clarification_payload = safe_json(form.get("clarification_payload", "[]"))

    validate(crop_id, positive_ids)
    crop = Crop.get(crop_id)
    positive_names = symptom_names(positive_ids)
    negative_names = symptom_names(negative_ids)

    result = rule_engine.diagnose(
        symptoms_input=positive_names,
        crop_id=crop.id,
        negative_symptoms_input=negative_names,
        category=category,
    )

    if result:
        diagnosis = Diagnosis(
            crop_id=crop.id,
            diagnosis_category=category,
            disease_id=result.rule.disease_id,
            disease_name=result.diagnosis,
            confidence=result.confidence,
            confidence_level=result.confidence_tier,
            diagnosis_reason=result.reason,
            diagnosis_evidence=result.evidence,
            solution=result.recommendations.solution,
            prevention_recommendations="\\n".join(result.recommendations.prevention),
            selected_symptom_ids=positive_ids,
            denied_symptom_ids=negative_ids,
            clarification_answers=clarification_payload,
        )
    else:
        diagnosis = Diagnosis(
            crop_id=crop.id,
            diagnosis_category=category,
            disease_name="Unknown",
            confidence_level="insufficient",
            diagnosis_reason="No strong rule match...",
            ...
        )

    db.session.add(diagnosis)
    db.session.commit()
    return redirect(url_for("farmer.diagnosis_result", diagnosis_id=diagnosis.id))


@farmer_bp.post("/result/<int:diagnosis_id>/feedback")
def diagnosis_feedback(diagnosis_id):
    diagnosis = ensure_owner(diagnosis_id, current_user.id)
    rating = form["rating"]   # helpful | not_helpful
    comment = form.get("comment")
    diagnosis.submit_feedback(rating, comment)
    db.session.commit()
    return redirect(url_for("farmer.diagnosis_result", diagnosis_id=diagnosis.id))
```

## 5) UI Wizard Interaction Flow

Step 1: Category + Crop

- Farmer picks one category from simple choices.
- Farmer selects crop from dropdown.
- `Next` enabled only when crop is selected.

Step 2: Adaptive clarification

- System asks one symptom question at a time.
- Answers: `Yes`, `No`, `Skip`.
- Questions adapt based on surviving candidate rules.
- Hard cap: 5-7 questions (depending on symptom pool size).

Step 3: Structured result

- Show:
  - Diagnosis
  - Reason
  - Evidence (matched, conflicting, missing, coverage)
  - Confidence (% and tier)
  - Solution and prevention actions

Step 4: Feedback loop

- Farmer marks result as `Helpful` or `Not Helpful`.
- Optional short comment for missing/confusing guidance.

Usability choices for low literacy:

- No free-text symptom entry.
- One question per screen block.
- Simple yes/no controls.
- Small number of steps and clear progress.
- Action-oriented recommendations in plain language.
