from __future__ import annotations

import argparse
import re

from app import create_app
from app.extensions import db
from app.models import Crop, Disease, Rule, Symptom
from app.utils.i18n import normalize_display_text


def norm(text: str | None) -> str:
    if not text:
        return ""
    text = str(text).strip().lower()
    text = re.sub(r"[^a-z0-9\s]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def lines_to_bullets(lines: list[str]) -> str:
    return "\n".join(f"- {row.strip()}" for row in lines if row.strip())


PROFILES = {
    "fungal": {
        "description": "Fungal disease affecting crop health and yield.",
        "treatment": [
            "Apply a registered fungicide at early symptom stage.",
            "Remove heavily infected plant parts from the field.",
            "Repeat application based on product label and weather risk.",
        ],
        "prevention": [
            "Use clean planting material and maintain field sanitation.",
            "Reduce canopy humidity by proper spacing and airflow.",
            "Avoid prolonged leaf wetness from late overhead irrigation.",
        ],
    },
    "bacterial": {
        "description": "Bacterial infection causing rapid leaf or vascular damage.",
        "treatment": [
            "Remove severely infected plants or leaves quickly.",
            "Apply registered bactericide where allowed.",
            "Disinfect tools and avoid handling wet plants.",
        ],
        "prevention": [
            "Use clean seed or planting material from trusted sources.",
            "Avoid splash spread from uncontrolled irrigation.",
            "Rotate crops and destroy infected residues after harvest.",
        ],
    },
    "viral": {
        "description": "Viral disease often spread by insect vectors.",
        "treatment": [
            "Rogue infected plants early to reduce virus source.",
            "Control insect vectors with integrated pest management.",
            "Replant with clean seedlings only after vector pressure drops.",
        ],
        "prevention": [
            "Use resistant varieties when available.",
            "Start with virus-free seedling material.",
            "Control vector host weeds around field boundaries.",
        ],
    },
    "pest": {
        "description": "Pest or insect damage reducing plant vigor and yield.",
        "treatment": [
            "Monitor pest level and apply selective control at threshold.",
            "Remove heavily infested plant parts and destroy them.",
            "Use traps and targeted treatment for early larval stages.",
        ],
        "prevention": [
            "Maintain field hygiene and reduce alternate pest hosts.",
            "Encourage natural enemies and avoid unnecessary broad sprays.",
            "Inspect crop regularly and act early before severe spread.",
        ],
    },
    "nutrient": {
        "description": "Nutrition-related stress causing abnormal growth symptoms.",
        "treatment": [
            "Apply corrective nutrient dose based on field observation.",
            "Improve soil organic matter and moisture management.",
            "Split fertilizer application to improve nutrient uptake.",
        ],
        "prevention": [
            "Use balanced fertilization plan for each growth stage.",
            "Check soil and water condition before major nutrient changes.",
            "Avoid severe drought or waterlogging stress periods.",
        ],
    },
}

SYMPTOM_EXACT_KH_FALLBACK = {
    "whiteflies": "\u179f\u178f\u17d2\u179c\u1796\u178e\u17cc\u179f",
}
SYMPTOM_TOKEN_KH_FALLBACK = {
    "abundant": "\u1785\u17d2\u179a\u17be\u1793",
    "present": "\u1798\u17b6\u1793",
    "frequently": "\u1789\u17b9\u1780\u1789\u17b6\u1794\u17cb",
    "observed": "\u1794\u17b6\u1793\u1783\u17be\u1789",
    "field": "\u179c\u17b6\u179b",
}

CROP_NAME_KH = {
    "Rice": "ស្រូវ",
    "Potato": "ដំឡូងបារាំង",
    "Tomato": "ប៉េងប៉ោះ",
    "Cucumber": "ត្រសក់",
    "Chili Pepper": "ម្ទេស",
    "Banana": "ចេក",
    "Corn": "ពោត",
    "Cassava": "ដំឡូងមី",
    "Soybean": "សណ្តែកសៀង",
    "Sesame": "ល្ង",
}

DISEASE_NAME_KH = {
    "Rice Blast": "ជំងឺអុចភ្នែកក្របីស្រូវ",
    "Bacterial Leaf Blight": "ជំងឺខូចស្លឹកបាក់តេរី",
    "Rice Brown Spot": "ជំងឺអុចត្នោតស្រូវ",
    "Rice Stem Borer Damage": "ការខូចខាតដោយដង្កូវចូលដើមស្រូវ",
    "Rice Tungro Virus": "មេរោគទង់ក្រូស្រូវ",
    "Potato Late Blight": "ជំងឺដំបៅយឺតដំឡូងបារាំង",
    "Late Blight": "ជំងឺដំបៅយឺត",
    "Potato Early Blight": "ជំងឺដំបៅដំបូងដំឡូងបារាំង",
    "Potato Bacterial Wilt": "ជំងឺស្វិតបាក់តេរីដំឡូងបារាំង",
    "Potato Aphid Infestation": "ការរាតត្បាតអាហ្វីតលើដំឡូងបារាំង",
    "Tomato Late Blight": "ជំងឺដំបៅយឺតប៉េងប៉ោះ",
    "Tomato Early Blight": "ជំងឺដំបៅដំបូងប៉េងប៉ោះ",
    "Tomato Bacterial Wilt": "ជំងឺស្វិតបាក់តេរីប៉េងប៉ោះ",
    "Tomato Leaf Curl Virus": "មេរោគរមួលស្លឹកប៉េងប៉ោះ",
    "Tomato Fruit Borer Damage": "ការខូចខាតផ្លែប៉េងប៉ោះដោយដង្កូវ",
    "Cucumber Downy Mildew": "ជំងឺផ្សិតរោមក្រោមស្លឹកត្រសក់",
    "Cucumber Powdery Mildew": "ជំងឺផ្សិតម្សៅស្លឹកត្រសក់",
    "Cucumber Mosaic Virus": "មេរោគមូសៃត្រសក់",
    "Cucumber Root Rot": "ជំងឺរលួយឫសត្រសក់",
    "Chili Anthracnose Fruit Rot": "ជំងឺរលួយផ្លែម្ទេសអាន់ថ្រាកណូស",
    "Chili Bacterial Leaf Spot": "ជំងឺអុចស្លឹកបាក់តេរីម្ទេស",
    "Chili Leaf Curl Virus": "មេរោគរមួលស្លឹកម្ទេស",
    "Chili Thrips Damage": "ការខូចខាតដោយទ្រីបលើម្ទេស",
    "Banana Sigatoka Leaf Spot": "ជំងឺអុចស្លឹកស៊ីហ្គាតូកាចេក",
    "Banana Panama Wilt": "ជំងឺស្វិតប៉ាណាម៉ាចេក",
    "Banana Bunchy Top Virus": "មេរោគកំពូលកញ្ចុំចេក",
    "Banana Pseudostem Weevil Damage": "ការខូចខាតដោយសត្វល្អិតដើមក្លែងចេក",
    "Corn Northern Leaf Blight": "ជំងឺខូចស្លឹកពោតខាងជើង",
    "Corn Common Rust": "ជំងឺច្រែះទូទៅលើពោត",
    "Fall Armyworm Damage": "ការខូចខាតដោយដង្កូវ Fall Armyworm",
    "Corn Stalk Rot": "ជំងឺរលួយដើមពោត",
    "Cassava Mosaic Disease": "ជំងឺមូសៃដំឡូងមី",
    "Cassava Bacterial Blight": "ជំងឺខូចស្លឹកបាក់តេរីដំឡូងមី",
    "Cassava Mealybug Infestation": "ការរាតត្បាតមីលីបាក់លើដំឡូងមី",
    "Soybean Rust": "ជំងឺច្រេះលើសណ្តែកសៀង",
    "Soybean Bacterial Blight": "ជំងឺខូចស្លឹកបាក់តេរីលើសណ្តែកសៀង",
    "Sesame Leaf Spot": "ជំងឺអុចស្លឹកល្ង",
    "Sesame Phyllody": "ជំងឺផ្កាក្លែងល្ង",
}

PROFILES_KH = {
    "fungal": {
        "description": "ជំងឺផ្សិតប៉ះពាល់ដល់សុខភាពដំណាំ និងទិន្នផល។",
        "treatment": [
            "បាញ់ថ្នាំកម្ចាត់ផ្សិតដែលបានចុះបញ្ជី នៅដំណាក់កាលរោគសញ្ញាដំបូង។",
            "ដកចេញផ្នែកដំណាំដែលឆ្លងខ្លាំង ពីស្រែឬចម្ការ។",
            "បាញ់បន្ថែមតាមស្លាកថ្នាំ និងស្ថានភាពអាកាសធាតុ។",
        ],
        "prevention": [
            "ប្រើសម្ភារៈដាំស្អាត និងថែរក្សាអនាម័យក្នុងស្រែ។",
            "កាត់បន្ថយសំណើមក្នុងគម្របដំណាំ ដោយរកចម្ងាយដាំសមរម្យ។",
            "ជៀសវាងការស្រោចទឹកលើស្លឹកនៅពេលល្ងាចយប់។",
        ],
    },
    "bacterial": {
        "description": "ជំងឺបាក់តេរីបង្កការខូចខាតស្លឹក ឬប្រព័ន្ធសរសៃដើមយ៉ាងឆាប់។",
        "treatment": [
            "ដកចេញដើម ឬស្លឹកដែលឆ្លងខ្លាំងភ្លាមៗ។",
            "ប្រើថ្នាំបាក់តេរីដែលបានអនុញ្ញាតតាមតំបន់។",
            "សម្អាតឧបករណ៍ និងជៀសវាងប៉ះដំណាំពេលសើម។",
        ],
        "prevention": [
            "ប្រើគ្រាប់ពូជ ឬពូជដាំស្អាតពីប្រភពទុកចិត្តបាន។",
            "បន្ថយការបែកសាច់ទឹកដែលអាចនាំរោគចម្លង។",
            "បង្វិលដំណាំ និងកម្ទេចសំណល់ឆ្លងក្រោយប្រមូលផល។",
        ],
    },
    "viral": {
        "description": "ជំងឺវីរុសភាគច្រើនឆ្លងតាមសត្វល្អិតជាអ្នកផ្ទុករោគ។",
        "treatment": [
            "ដកដើមដែលឆ្លងចេញឱ្យបានឆាប់ ដើម្បីកាត់បន្ថយប្រភពរោគ។",
            "គ្រប់គ្រងសត្វល្អិតផ្ទុករោគ តាមវិធី IPM។",
            "ដាំឡើងវិញដោយប្រើពូជស្អាត បន្ទាប់ពីសម្ពាធសត្វល្អិតថយចុះ។",
        ],
        "prevention": [
            "ប្រើពូជធន់ជំងឺ ប្រសិនបើមាន។",
            "ចាប់ផ្តើមពីសំណាប ឬវត្ថុដាំដែលគ្មានវីរុស។",
            "គ្រប់គ្រងស្មៅជាអ្នកផ្ទុកសត្វល្អិតជុំវិញស្រែ។",
        ],
    },
    "pest": {
        "description": "ការខូចខាតដោយសត្វល្អិតប៉ះពាល់ដល់កំណើន និងទិន្នផល។",
        "treatment": [
            "តាមដានកម្រិតសត្វល្អិត និងអនុវត្តការគ្រប់គ្រងនៅកម្រិតគោលដៅ។",
            "ដកចេញផ្នែកដែលរងការវាយប្រហារខ្លាំង ហើយកម្ទេចចោល។",
            "ប្រើអន្ទាក់ និងថ្នាំគោលដៅនៅវគ្គដង្កូវដំបូង។",
        ],
        "prevention": [
            "ថែរក្សាអនាម័យស្រែ និងកាត់បន្ថយរុក្ខជាតិជាម្ចាស់ផ្ទុកសត្វល្អិត។",
            "អភិរក្សសត្វជួយស៊ីសត្វល្អិត និងជៀសវាងថ្នាំទូលំទូលាយលើសកម្រិត។",
            "ត្រួតពិនិត្យដំណាំជាប្រចាំ និងដោះស្រាយឱ្យបានឆាប់។",
        ],
    },
    "nutrient": {
        "description": "បញ្ហាកង្វះ/លើសជី បណ្ដាលឲ្យរោគសញ្ញាកំណើនមិនធម្មតា។",
        "treatment": [
            "កែតម្រូវអាហាររុក្ខជាតិតាមរោគសញ្ញាដែលសង្កេតឃើញ។",
            "បង្កើនសារធាតុសរីរាង្គ និងគ្រប់គ្រងសំណើមដី។",
            "បែងចែកការដាក់ជីជាចំនួនដង ដើម្បីបង្កើនការស្រូបយក។",
        ],
        "prevention": [
            "រៀបចំផែនការដាក់ជីសមតុល្យតាមដំណាក់កាលលូតលាស់។",
            "ពិនិត្យស្ថានភាពដី និងទឹក មុនកែប្រែជីធំៗ។",
            "ជៀសវាងស្រែស្ងួតខ្លាំង ឬជន់ទឹកយូរ។",
        ],
    },
}

KH_TOKEN_MAP = {
    "leaf": "ស្លឹក",
    "leaves": "ស្លឹក",
    "spots": "ចំណុច",
    "spot": "ចំណុច",
    "lesion": "ដំបៅ",
    "lesions": "ដំបៅ",
    "stem": "ដើម",
    "root": "ឫស",
    "fruit": "ផ្លែ",
    "fruits": "ផ្លែ",
    "yellow": "លឿង",
    "brown": "ត្នោត",
    "gray": "ប្រផេះ",
    "grey": "ប្រផេះ",
    "white": "ស",
    "black": "ខ្មៅ",
    "mold": "ផ្សិត",
    "fungal": "ផ្សិត",
    "viral": "វីរុស",
    "virus": "វីរុស",
    "bacterial": "បាក់តេរី",
    "rot": "រលួយ",
    "wilt": "ស្វិត",
    "wilting": "ស្វិត",
    "curl": "រមួល",
    "damage": "ខូចខាត",
    "infestation": "ការរាតត្បាត",
    "aphid": "អាហ្វីត",
    "whiteflies": "‫សត្វពណ៌ស‬",
    "hoppers": "ដង្កៀបលោត",
    "bore": "ខួង",
    "holes": "រន្ធ",
    "water": "ទឹក",
    "soaked": "ជ្រាប",
    "powdery": "ម្សៅ",
    "downy": "រោម",
    "mosaic": "មូសៃ",
    "stunted": "លូតលាស់យឺត",
    "dry": "ស្ងួត",
    "early": "ឆាប់",
    "late": "យឺត",
}


def to_kh_phrase(text: str | None) -> str | None:
    cleaned = norm(text or "")
    if not cleaned:
        return None
    translated = f" {cleaned} "
    for source, target in SYMPTOM_EXACT_KH_FALLBACK.items():
        translated = re.sub(
            rf"\b{re.escape(source)}\b",
            target,
            translated,
            flags=re.IGNORECASE,
        )
    for source, target in SYMPTOM_TOKEN_KH_FALLBACK.items():
        translated = re.sub(
            rf"\b{re.escape(source)}\b",
            target,
            translated,
            flags=re.IGNORECASE,
        )
    for token in sorted(KH_TOKEN_MAP.keys(), key=len, reverse=True):
        translated = re.sub(rf"\b{re.escape(token)}\b", KH_TOKEN_MAP[token], translated)
    translated = re.sub(r"[\u202a-\u202e]", "", translated)
    translated = re.sub(r"\s+", " ", translated).strip()
    if translated == cleaned:
        return None
    return normalize_display_text(translated, lang="km")


def is_placeholder_kh(text: str | None) -> bool:
    if not text or not isinstance(text, str):
        return False
    return "?" in text or "\ufffd" in text


def kh_symptom_fallback(text: str | None) -> str | None:
    cleaned = norm(text or "")
    if not cleaned:
        return None
    translated = to_kh_phrase(cleaned)
    if translated:
        return normalize_display_text(translated, lang="km")
    return normalize_display_text(f"រោគសញ្ញា៖ {cleaned}", lang="km")


def repair_kh_placeholders() -> dict[str, int]:
    counters = {
        "crop_repaired": 0,
        "disease_repaired": 0,
        "symptom_repaired": 0,
        "symptom_removed": 0,
    }

    for crop in Crop.query.all():
        changed = False
        current_name_kh = (crop.name_kh or "").strip()
        if not current_name_kh or is_placeholder_kh(crop.name_kh):
            mapped = CROP_NAME_KH.get(crop.name)
            candidate = normalize_display_text(mapped, lang="km") if mapped else None
            changed |= set_if_changed(crop, "name_kh", candidate)
        if is_placeholder_kh(crop.description_kh):
            changed |= set_if_changed(crop, "description_kh", None)
        if changed:
            counters["crop_repaired"] += 1

    for disease in Disease.query.all():
        changed = False
        current_name_kh = (disease.name_kh or "").strip()
        if not current_name_kh or is_placeholder_kh(disease.name_kh):
            mapped = DISEASE_NAME_KH.get(disease.name)
            candidate = normalize_display_text(mapped, lang="km") if mapped else None
            if candidate is None and is_placeholder_kh(disease.name_kh):
                candidate = None
            changed |= set_if_changed(disease, "name_kh", candidate)
        if is_placeholder_kh(disease.description_kh):
            changed |= set_if_changed(disease, "description_kh", None)
        if is_placeholder_kh(disease.treatment_kh):
            changed |= set_if_changed(disease, "treatment_kh", None)
        if changed:
            counters["disease_repaired"] += 1

    for symptom in Symptom.query.all():
        if not (symptom.name or "").strip():
            db.session.delete(symptom)
            counters["symptom_removed"] += 1
            continue

        changed = False
        current_name_kh = (symptom.name_kh or "").strip()
        if not current_name_kh or is_placeholder_kh(symptom.name_kh):
            candidate = kh_symptom_fallback(symptom.name)
            changed |= set_if_changed(symptom, "name_kh", candidate)
        if is_placeholder_kh(symptom.description_kh):
            description_source = symptom.description or symptom.name
            description_kh = (
                normalize_display_text(f"ការពិពណ៌នារោគសញ្ញា៖ {description_source}", lang="km")
                if description_source
                else None
            )
            changed |= set_if_changed(symptom, "description_kh", description_kh)
        if changed:
            counters["symptom_repaired"] += 1

    return counters


def d(name: str, kind: str, confidence: float, cause: str, symptoms: list[str], severity: str = "medium"):
    return {
        "name": name,
        "kind": kind,
        "confidence": confidence,
        "cause": cause,
        "symptoms": symptoms,
        "severity": severity,
    }


DATASET = [
    {
        "crop": "Rice",
        "description": "Staple cereal crop grown in lowland and upland systems.",
        "diseases": [
            d("Rice Blast", "fungal", 0.92, "Magnaporthe infection in humid canopy.", [
                "leaf has diamond shaped spots",
                "spots are gray in center and brown at edges",
                "lesions expand quickly after rain",
                "leaves dry and die early",
            ], "high"),
            d("Bacterial Leaf Blight", "bacterial", 0.86, "Xanthomonas spread by water splash.", [
                "leaf tips turn yellow then white",
                "leaf margins become wavy and dry",
                "milky bacterial ooze appears on cut leaf",
                "disease spreads fast in standing water",
            ], "high"),
            d("Rice Brown Spot", "fungal", 0.78, "Seed and nutrient stress with fungal infection.", [
                "small round brown spots on older leaves",
                "spots have yellow halo",
                "grain filling is poor",
                "seedlings are weak and stunted",
            ]),
            d("Rice Stem Borer Damage", "pest", 0.84, "Larvae feed inside stem and block nutrient flow.", [
                "dead heart in vegetative stage",
                "white head at panicle stage",
                "bore holes on stem",
                "frass found inside stem channel",
            ], "high"),
            d("Rice Tungro Virus", "viral", 0.82, "Leafhopper-transmitted viral complex.", [
                "leaves turn orange yellow",
                "plants are stunted with fewer tillers",
                "delayed flowering in infected hills",
                "hoppers are seen in the field",
            ], "high"),
        ],
    },
    {
        "crop": "Potato",
        "description": "Tuber crop sensitive to foliar and soil-borne diseases.",
        "diseases": [
            d("Potato Late Blight", "fungal", 0.9, "Phytophthora spread in cool wet weather.", [
                "water soaked lesions on leaves",
                "white mold on leaf underside in morning",
                "dark brown stem lesions",
                "tuber rot with brown granular flesh",
            ], "high"),
            d("Late Blight", "fungal", 0.88, "Legacy late blight label mapped to potato blight symptoms.", [
                "water soaked lesions on leaves",
                "white mold on leaf underside in morning",
                "dark brown stem lesions",
                "tuber rot with brown granular flesh",
            ], "high"),
            d("Potato Early Blight", "fungal", 0.82, "Alternaria leaf blight with target spots.", [
                "concentric target spots on older leaves",
                "lower leaves yellow and drop early",
                "dark lesions on stems",
                "plant vigor declines before maturity",
            ]),
            d("Potato Bacterial Wilt", "bacterial", 0.85, "Soil-borne vascular bacteria causing sudden wilt.", [
                "sudden wilting without yellowing",
                "brown ring in vascular tissue",
                "sticky ooze from cut stem in water",
                "entire plant collapses rapidly",
            ], "high"),
            d("Potato Aphid Infestation", "pest", 0.74, "Aphid pressure with sap-sucking and vector risk.", [
                "clusters of aphids under leaves",
                "leaves curl and become sticky",
                "honeydew and sooty mold present",
                "virus like mosaic appears later",
            ]),
        ],
    },
    {
        "crop": "Tomato",
        "description": "High-value vegetable prone to foliar, vascular, and fruit problems.",
        "diseases": [
            d("Tomato Late Blight", "fungal", 0.9, "Rapid blight infection under wet weather.", [
                "large greasy leaf lesions",
                "white fungal growth under lesions",
                "brown lesions on petiole and stem",
                "fruit shows firm brown rot",
            ], "high"),
            d("Tomato Early Blight", "fungal", 0.82, "Alternaria causing target-like lesions.", [
                "target like concentric leaf spots",
                "yellowing starts from lower leaves",
                "collar lesions on seedlings",
                "fruit near stem end gets dark spots",
            ]),
            d("Tomato Bacterial Wilt", "bacterial", 0.86, "Vascular bacterial wilt with sudden collapse.", [
                "plants wilt during hot daytime and fail to recover",
                "brown vascular streak in stem",
                "bacterial streaming in water test",
                "no major leaf spotting before wilt",
            ], "high"),
            d("Tomato Leaf Curl Virus", "viral", 0.83, "Whitefly-transmitted leaf curl infection.", [
                "upward curling of young leaves",
                "severe stunting of plants",
                "thickened veins and puckered leaves",
                "whiteflies abundant in field",
            ], "high"),
            d("Tomato Fruit Borer Damage", "pest", 0.79, "Larvae feed inside fruit.", [
                "bore holes on green fruit",
                "frass at fruit entry point",
                "damaged fruit rots secondarily",
                "larvae seen inside fruit",
            ]),
        ],
    },
    {
        "crop": "Cucumber",
        "description": "Vine crop vulnerable to foliar mildew and root diseases.",
        "diseases": [
            d("Cucumber Downy Mildew", "fungal", 0.87, "Humidity-driven angular leaf blight.", [
                "angular yellow spots between veins",
                "gray purple growth under leaves",
                "rapid defoliation after humid nights",
                "fruits remain small and pale",
            ], "high"),
            d("Cucumber Powdery Mildew", "fungal", 0.81, "Powdery fungal growth on leaves.", [
                "white powder patches on upper leaf",
                "patches spread to petiole and stem",
                "leaves dry prematurely",
                "reduced fruit set",
            ]),
            d("Cucumber Mosaic Virus", "viral", 0.8, "Aphid-borne mosaic virus.", [
                "mosaic mottling on leaves",
                "leaf distortion and shoestring symptom",
                "stunted vines",
                "fruits are malformed and mottled",
            ], "high"),
            d("Cucumber Root Rot", "fungal", 0.76, "Soil-borne root infection under wet beds.", [
                "root system turns brown and weak",
                "lower stem softens near soil",
                "plants wilt despite moist soil",
                "poor root branching",
            ]),
        ],
    },
    {
        "crop": "Chili Pepper",
        "description": "Spice crop with high pressure from fruit rot and vector-borne issues.",
        "diseases": [
            d("Chili Anthracnose Fruit Rot", "fungal", 0.88, "Colletotrichum fruit infection after rain.", [
                "circular sunken lesions on fruit",
                "orange spore rings on lesions",
                "fruit shrivels before harvest",
                "disease increases after rain",
            ], "high"),
            d("Chili Bacterial Leaf Spot", "bacterial", 0.8, "Leaf and stem spotting bacterial infection.", [
                "small water soaked leaf spots",
                "spots turn dark with yellow halo",
                "lesions on petiole and stem",
                "defoliation under severe attack",
            ]),
            d("Chili Leaf Curl Virus", "viral", 0.84, "Whitefly-transmitted leaf curl disease.", [
                "severe curling of young leaves",
                "shortened internodes and bushy top",
                "low flower and fruit set",
                "whiteflies present",
            ], "high"),
            d("Chili Thrips Damage", "pest", 0.77, "Thrips feeding on young canopy and flowers.", [
                "silvery streaks on young leaves",
                "leaf edges curl upward",
                "flower drop increases",
                "tiny slender thrips visible",
            ]),
        ],
    },
    {
        "crop": "Banana",
        "description": "Perennial fruit crop with foliar and vascular constraints.",
        "diseases": [
            d("Banana Sigatoka Leaf Spot", "fungal", 0.83, "Foliar spot complex in humid canopy.", [
                "narrow yellow streaks on leaves",
                "streaks turn brown black lesions",
                "large necrotic patches reduce leaf area",
                "bunch size declines",
            ], "high"),
            d("Banana Panama Wilt", "fungal", 0.88, "Soil-borne Fusarium vascular wilt.", [
                "older leaves yellow and collapse",
                "pseudostem vascular discoloration",
                "longitudinal split at stem base",
                "plant dies before bunch maturity",
            ], "high"),
            d("Banana Bunchy Top Virus", "viral", 0.85, "Aphid-transmitted severe bunchy top disease.", [
                "dark green streaks on midrib",
                "leaves become narrow upright bunchy",
                "severe stunting and no bunch",
                "aphid vector present",
            ], "high"),
            d("Banana Pseudostem Weevil Damage", "pest", 0.78, "Weevil tunneling in pseudostem tissue.", [
                "bore holes on pseudostem",
                "gummy ooze near tunnels",
                "leaf sheaths break easily",
                "plants topple under wind",
            ]),
        ],
    },
    {
        "crop": "Corn",
        "description": "Cereal crop affected by leaf blights and whorl pests.",
        "diseases": [
            d("Corn Northern Leaf Blight", "fungal", 0.82, "Long leaf lesions caused by foliar pathogen.", [
                "long cigar shaped gray lesions",
                "lesions merge and blight large area",
                "lower leaves affected first",
                "reduced grain filling",
            ]),
            d("Corn Common Rust", "fungal", 0.77, "Rust pustules reduce leaf photosynthesis.", [
                "cinnamon brown pustules on leaves",
                "pustules rupture and release spores",
                "chlorosis around pustules",
                "severe cases reduce photosynthesis",
            ]),
            d("Fall Armyworm Damage", "pest", 0.86, "Larvae feed in whorl and young leaves.", [
                "window pane feeding on young leaves",
                "ragged whorl leaves with holes",
                "frass in whorl funnel",
                "larvae hide deep in whorl",
            ], "high"),
            d("Corn Stalk Rot", "fungal", 0.75, "Stalk decay and lodging near maturity.", [
                "lower stalk internodes become soft",
                "lodging near maturity",
                "inner pith turns brown",
                "poor ear filling",
            ]),
        ],
    },
    {
        "crop": "Cassava",
        "description": "Root crop with major viral and bacterial yield constraints.",
        "diseases": [
            d("Cassava Mosaic Disease", "viral", 0.85, "Whitefly-transmitted mosaic virus.", [
                "mosaic chlorosis on leaves",
                "leaf distortion and narrowing",
                "stunted plant growth",
                "whiteflies frequently observed",
            ], "high"),
            d("Cassava Bacterial Blight", "bacterial", 0.81, "Rain-splashed bacterial blight on leaves and stems.", [
                "angular water soaked leaf spots",
                "leaf wilting and dieback",
                "gum exudate on stem lesions",
                "tip blight after rain splash",
            ], "high"),
            d("Cassava Mealybug Infestation", "pest", 0.76, "Sap-sucking mealybug colonies on shoots.", [
                "cottony masses on shoots",
                "leaf curling and stunting",
                "honeydew with sooty mold",
                "distorted shoot tips",
            ]),
        ],
    },
]


def set_if_changed(obj, field: str, value) -> bool:
    if getattr(obj, field) != value:
        setattr(obj, field, value)
        return True
    return False


def seed(dry_run: bool = False):
    counters = {
        "crop_created": 0,
        "crop_updated": 0,
        "disease_created": 0,
        "disease_updated": 0,
        "symptom_created": 0,
        "rule_created": 0,
        "rule_updated": 0,
        "rule_links_updated": 0,
    }

    crop_cache = {norm(row.name): row for row in Crop.query.all()}
    symptom_cache = {norm(row.name): row for row in Symptom.query.all()}
    disease_cache = {(row.crop_id, norm(row.name)): row for row in Disease.query.all()}
    rule_cache = {(row.disease_id, norm(row.name)): row for row in Rule.query.all()}

    for crop_payload in DATASET:
        crop_name = crop_payload["crop"]
        crop_name_kh = normalize_display_text(CROP_NAME_KH.get(crop_name), lang="km")
        crop = crop_cache.get(norm(crop_name))
        if crop is None:
            crop = Crop(name=crop_name)
            db.session.add(crop)
            db.session.flush()
            crop_cache[norm(crop_name)] = crop
            counters["crop_created"] += 1
        crop_changed = False
        crop_changed |= set_if_changed(crop, "name", crop_name)
        crop_changed |= set_if_changed(crop, "name_kh", crop_name_kh)
        crop_changed |= set_if_changed(crop, "description", crop_payload.get("description"))
        if crop_changed:
            counters["crop_updated"] += 1

        for disease_payload in crop_payload["diseases"]:
            disease_name = disease_payload["name"]
            disease_name_kh = normalize_display_text(DISEASE_NAME_KH.get(disease_name), lang="km")
            disease_key = (crop.id, norm(disease_name))
            disease = disease_cache.get(disease_key)
            profile = PROFILES[disease_payload["kind"]]
            profile_kh = PROFILES_KH[disease_payload["kind"]]
            profile_description_kh = normalize_display_text(profile_kh["description"], lang="km")
            profile_treatment_kh = [
                normalize_display_text(line, lang="km")
                for line in profile_kh["treatment"]
            ]

            if disease is None:
                disease = Disease(crop_id=crop.id, name=disease_name)
                db.session.add(disease)
                db.session.flush()
                disease_cache[disease_key] = disease
                counters["disease_created"] += 1

            changed = False
            changed |= set_if_changed(disease, "name_kh", disease_name_kh)
            changed |= set_if_changed(disease, "description", profile["description"])
            changed |= set_if_changed(disease, "description_kh", profile_description_kh)
            changed |= set_if_changed(disease, "cause_explanation", disease_payload["cause"])
            changed |= set_if_changed(disease, "treatment", lines_to_bullets(profile["treatment"]))
            changed |= set_if_changed(disease, "treatment_kh", lines_to_bullets(profile_treatment_kh))
            changed |= set_if_changed(disease, "prevention_tips", lines_to_bullets(profile["prevention"]))
            changed |= set_if_changed(disease, "severity_level", disease_payload["severity"])
            if changed:
                counters["disease_updated"] += 1

            symptom_rows: list[Symptom] = []
            for symptom_name in disease_payload["symptoms"]:
                key = norm(symptom_name)
                row = symptom_cache.get(key)
                if row is None:
                    row = Symptom(name=symptom_name)
                    db.session.add(row)
                    db.session.flush()
                    symptom_cache[key] = row
                    counters["symptom_created"] += 1
                symptom_name_kh = to_kh_phrase(symptom_name)
                if symptom_name_kh:
                    set_if_changed(row, "name_kh", normalize_display_text(symptom_name_kh, lang="km"))
                symptom_rows.append(row)

            rule_name = f"{disease_name} Rule"
            rule_key = (disease.id, norm(rule_name))
            rule = rule_cache.get(rule_key)
            if rule is None:
                rule = Rule(name=rule_name, disease_id=disease.id, confidence=disease_payload["confidence"])
                db.session.add(rule)
                db.session.flush()
                rule_cache[rule_key] = rule
                counters["rule_created"] += 1
            else:
                if set_if_changed(rule, "confidence", disease_payload["confidence"]):
                    counters["rule_updated"] += 1

            current_ids = {row.id for row in rule.symptoms}
            target_ids = {row.id for row in symptom_rows}
            if current_ids != target_ids:
                rule.symptoms = symptom_rows
                counters["rule_links_updated"] += 1

    counters.update(repair_kh_placeholders())

    if dry_run:
        db.session.rollback()
    else:
        db.session.commit()

    print("=== Rule-Based Seeding Summary ===")
    for key in sorted(counters):
        print(f"{key}: {counters[key]}")
    print(
        f"Totals -> crops={Crop.query.count()}, diseases={Disease.query.count()}, "
        f"symptoms={Symptom.query.count()}, rules={Rule.query.count()}"
    )
    if dry_run:
        print("Dry run complete. Nothing committed.")


def main():
    parser = argparse.ArgumentParser(description="Seed rule-based diagnosis knowledge data.")
    parser.add_argument("--dry-run", action="store_true", help="Preview without commit")
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        seed(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
