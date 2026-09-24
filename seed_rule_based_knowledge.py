from __future__ import annotations

import argparse
import re

from app import create_app
from app.extensions import db
from app.models import Crop, Disease, Rule, Symptom
from app.utils.i18n import normalize_display_text
from app.utils.khmer_agri_knowledge import (
    CROP_DESCRIPTION_KH,
    DISEASE_CAUSE_KH,
    SYMPTOM_CLEAN_KH,
    clean_khmer_text,
    has_english,
)


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
    "leaf has diamond shaped spots": "ស្លឹកមានចំណុចរាងពេជ្រ",
    "spots are gray in center and brown at edges": "ចំណុចមានពណ៌ប្រផេះនៅកណ្តាល និងពណ៌ត្នោតនៅគែម",
    "lesions expand quickly after rain": "ដំបៅរីករាលដាលយ៉ាងលឿនក្រោយពេលភ្លៀង",
    "leaves dry and die early": "ស្លឹកស្ងួត និងងាប់លឿន",
    "leaf tips turn yellow then white": "ចុងស្លឹកប្រែជាពណ៌លឿង រួចពណ៌ស",
    "leaf margins become wavy and dry": "គែមស្លឹកប្រែជាកោងនិងស្ងួត",
    "milky bacterial ooze appears on cut leaf": "មានទឹករំអិលបាក់តេរីពណ៌សចេញពីស្លឹកដែលកាត់",
    "disease spreads fast in standing water": "ជំងឺរីករាលដាលលឿននៅក្នុងទឹកដក់",
    "small round brown spots on older leaves": "ចំណុចពណ៌ត្នោតតូចៗមូលៗនៅលើស្លឹកចាស់",
    "spots have yellow halo": "ចំណុចមានរង្វង់ពណ៌លឿងព័ទ្ធជុំវិញ",
    "seedlings are weak and stunted": "កូនរុក្ខជាតិខ្សោយ និងក្រិន",
    "white head at panicle stage": "កួរស្រូវពណ៌ស",
    "bore holes on stem": "ស្នាមប្រហោងលើដើម",
    "frass found inside stem channel": "មានកាកសំណល់សត្វល្អិតក្នុងដើម",
    "leaves turn orange yellow": "ស្លឹកប្រែជាពណ៌លឿងទុំ",
    "plants are stunted with fewer tillers": "ដើមស្រូវក្រិន និងបែកគុម្ពតិច",
    "hoppers are seen in the field": "ឃើញមានមមាចនៅក្នុងស្រែ",
    "water soaked lesions on leaves": "ស្លឹកមានស្នាមដំបៅដូចជាំទឹក",
    "white mold on leaf underside in morning": "មានផ្សិតពណ៌សនៅក្រោមស្លឹកនៅពេលព្រឹក",
    "dark brown stem lesions": "ស្នាមដំបៅពណ៌ត្នោតចាស់លើដើម",
    "tuber rot with brown granular flesh": "មើមរលួយមានសាច់ពណ៌ត្នោត",
    "concentric target spots on older leaves": "ចំណុចរង្វង់ៗនៅលើស្លឹកចាស់",
    "lower leaves yellow and drop early": "ស្លឹកក្រោមប្រែពណ៌លឿង ហើយជ្រុះលឿន",
    "dark lesions on stems": "ស្នាមដំបៅពណ៌ខ្មៅលើដើម",
    "sudden wilting without yellowing": "ស្រពោនភ្លាមៗដោយមិនប្រែពណ៌លឿង",
    "brown ring in vascular tissue": "មានរង្វង់ពណ៌ត្នោតក្នុងជាលិកា",
    "sticky ooze from cut stem in water": "មានទឹករំអិលស្អិតចេញពីដើមដែលកាត់ដាក់ក្នុងទឹក",
    "clusters of aphids under leaves": "មានសត្វល្អិត(Aphid)ផ្តុំគ្នានៅក្រោមស្លឹក",
    "leaves curl and become sticky": "ស្លឹករមួលនិងប្រែជាស្អិត",
    "honeydew and sooty mold present": "មានទឹកដមស្អិតនិងផ្សិតខ្មៅ",
    "virus like mosaic appears later": "រោគសញ្ញាមូសៃលេចឡើងនៅពេលក្រោយ",
    "large greasy leaf lesions": "ស្នាមដំបៅធំៗមានជាតិខ្លាញ់លើស្លឹក",
    "white fungal growth under lesions": "មានដុះផ្សិតពណ៌សនៅក្រោមស្នាមដំបៅ",
    "brown lesions on petiole and stem": "ស្នាមដំបៅពណ៌ត្នោតលើទងស្លឹកនិងដើម",
    "fruit shows firm brown rot": "ផ្លែរលួយត្នោតតែរឹង",
    "target like concentric leaf spots": "ចំណុចស្លឹករាងដូចគោលដៅ",
    "yellowing starts from lower leaves": "ការប្រែពណ៌លឿងចាប់ផ្តើមពីស្លឹកខាងក្រោម",
    "collar lesions on seedlings": "ដំបៅគល់លើកូនរុក្ខជាតិ",
    "fruit near stem end gets dark spots": "ផ្លែនៅក្បែរទងមានចំណុចខ្មៅ",
    "plants wilt during hot daytime and fail to recover": "ដើមស្រពោននៅពេលថ្ងៃក្តៅ ហើយមិនងើបឡើងវិញ",
    "brown vascular streak in stem": "សរសៃពណ៌ត្នោតក្នុងដើម",
    "bacterial streaming in water test": "មានចេញទឹករំអិលបាក់តេរីពេលធ្វើតេស្តក្នុងទឹក",
    "no major leaf spotting before wilt": "មិនមានចំណុចស្លឹកធំដុំមុនពេលស្រពោន",
    "upward curling of young leaves": "ស្លឹកខ្ចីរមួលឡើងលើ",
    "thickened veins and puckered leaves": "សរសៃស្លឹកក្រាស់និងស្លឹកជ្រីវជ្រួញ",
    "whiteflies abundant in field": "មានរុយសច្រើននៅលើចម្ការ",
    "bore holes on green fruit": "ស្នាមប្រហោងលើផ្លែខៀវ",
    "frass at fruit entry point": "កាកសំណល់សត្វល្អិតនៅមាត់រន្ធផ្លែ",
    "damaged fruit rots secondarily": "ផ្លែដែលខូចខាតនឹងរលួយជាបន្ត",
    "larvae seen inside fruit": "ឃើញមានដង្កូវនៅក្នុងផ្លែ",
    "angular yellow spots between veins": "ចំណុចពណ៌លឿងជ្រុងៗរវាងសរសៃស្លឹក",
    "gray purple growth under leaves": "ការលូតលាស់ផ្សិតពណ៌ប្រផេះស្វាយក្រោមស្លឹក",
    "fruits remain small and pale": "ផ្លែនៅតូចនិងស្លេក",
    "white powder patches on upper leaf": "មានម្សៅសៗនៅលើផ្ទៃខាងលើស្លឹក",
    "patches spread to petiole and stem": "រាលដាលដល់ទងស្លឹកនិងដើម",
    "leaves dry prematurely": "ស្លឹកស្ងួតមុនអាយុ",
    "reduced fruit set": "ផ្លែចេញតិច",
    "mosaic mottling on leaves": "ស្លឹកមានស្នាមអុចៗរាងមូសៃ",
    "leaf distortion and shoestring symptom": "ស្លឹកខូចទ្រង់ទ្រាយនិងរួញតូច",
    "stunted vines": "ទងវល្លិ៍ក្រិន",
    "fruits are malformed and mottled": "ផ្លែខូចទ្រង់ទ្រាយនិងមានស្នាមអុចៗ",
    "root system turns brown and weak": "ប្រព័ន្ធឫសប្រែពណ៌ត្នោតនិងខ្សោយ",
    "lower stem softens near soil": "ដើមខាងក្រោមទន់ក្បែរដី",
    "plants wilt despite moist soil": "ដើមស្រពោនទោះបីជាដីមានសំណើម",
    "poor root branching": "ឫសបែកខ្សោយ",
    "circular sunken lesions on fruit": "ស្នាមដំបៅលិចរាងរង្វង់លើផ្លែ",
    "orange spore rings on lesions": "រង្វង់ស្ព័រពណ៌ទឹកក្រូចលើដំបៅ",
    "fruit shrivels before harvest": "ផ្លែស្វិតមុនពេលប្រមូលផល",
    "small water soaked leaf spots": "ចំណុចស្លឹកតូចៗដូចជាំទឹក",
    "spots turn dark with yellow halo": "ចំណុចប្រែជាខ្មៅមានរង្វង់លឿងព័ទ្ធ",
    "lesions on petiole and stem": "ស្នាមដំបៅលើទងស្លឹកនិងដើម",
    "severe curling of young leaves": "ស្លឹកខ្ចីរមួលខ្លាំង",
    "low flower and fruit set": "ផ្កានិងផ្លែតិច",
    "whiteflies present": "មានរុយស",
    "silvery streaks on young leaves": "ឆ្នូតពណ៌ប្រាក់លើស្លឹកខ្ចី",
    "leaf edges curl upward": "គែមស្លឹករមួលឡើងលើ",
    "narrow yellow streaks on leaves": "ឆ្នូតលឿងតូចៗលើស្លឹក",
    "streaks turn brown black lesions": "ឆ្នូតប្រែជាស្នាមដំបៅពណ៌ត្នោតខ្មៅ",
    "large necrotic patches reduce leaf area": "ស្នាមងាប់ធំៗធ្វើឱ្យខូចផ្ទៃស្លឹក",
    "older leaves yellow and collapse": "ស្លឹកចាស់លឿងហើយងាប់",
    "longitudinal split at stem base": "ស្នាមប្រេះបណ្តោយនៅគល់ដើម",
    "leaves become narrow upright bunchy": "ស្លឹកប្រែជាតូច ឈរ និងផ្តុំគ្នា",
    "aphid vector present": "មានភ្នាក់ងារចម្លងរោគ(Aphid)",
    "bore holes on pseudostem": "ស្នាមប្រហោងលើដើមក្លែងចេក",
    "leaf sheaths break easily": "ស្រទបស្លឹកងាយបាក់",
    "long cigar shaped gray lesions": "ស្នាមដំបៅពណ៌ប្រផេះរាងដូចស៊ីហ្គា",
    "lesions merge and blight large area": "ស្នាមដំបៅបញ្ចូលគ្នាធ្វើឱ្យខូចខាតផ្ទៃធំ",
    "lower leaves affected first": "ស្លឹកខាងក្រោមរងផលប៉ះពាល់មុន",
    "cinnamon brown pustules on leaves": "ពងទឹកពណ៌ត្នោតក្រហមលើស្លឹក",
    "window pane feeding on young leaves": "ស្លឹកខ្ចីមានស្នាមស៊ីជាទម្រង់បង្អួច",
    "ragged whorl leaves with holes": "ស្លឹកមានស្នាមប្រហោងរហែក",
    "inner pith turns brown": "បណ្ដូលខាងក្នុងប្រែជាពណ៌ត្នោត",
    "mosaic chlorosis on leaves": "ស្លឹកមានស្នាមមូសៃពណ៌លឿង",
    "leaf distortion and narrowing": "ស្លឹកខូចទ្រង់ទ្រាយនិងរួញតូច",
    "stunted plant growth": "ការលូតលាស់ក្រិន",
    "whiteflies frequently observed": "ឧស្សាហ៍ឃើញមានរុយស",
    "angular water soaked leaf spots": "ចំណុចស្លឹកជ្រុងៗដូចជាំទឹក",
    "leaf wilting and dieback": "ស្លឹកស្រពោននិងងាប់ពីចុង",
    "gum exudate on stem lesions": "មានជ័រចេញពីស្នាមដំបៅដើម",
    "leaf curling and stunting": "ស្លឹករមួលនិងក្រិន",
    "honeydew with sooty mold": "ទឹកដមស្អិតជាមួយផ្សិតខ្មៅ",
    "grain filling is poor": "ការដាក់គ្រាប់ខ្សោយ",
    "dead heart in vegetative stage": "ងាប់បណ្ដូលនៅដំណាក់កាលលូតលាស់",
    "delayed flowering in infected hills": "ពន្យារពេលចេញផ្កានៅគុម្ពដែលមានរោគ",
    "plant vigor declines before maturity": "ភាពរឹងមាំរុក្ខជាតិធ្លាក់ចុះមុនពេលទុំ",
    "entire plant collapses rapidly": "រុក្ខជាតិទាំងមូលងាប់យ៉ាងលឿន",
    "severe stunting of plants": "រុក្ខជាតិក្រិនខ្លាំង",
    "rapid defoliation after humid nights": "ការជ្រុះស្លឹករហ័សបន្ទាប់ពីយប់ដែលមានសំណើម",
    "disease increases after rain": "ជំងឺកើនឡើងក្រោយពេលភ្លៀង",
    "defoliation under severe attack": "ជ្រុះស្លឹកពេលមានការរាតត្បាតខ្លាំង",
    "shortened internodes and bushy top": "ថ្នាំងខ្លីនិងកំពូលផ្តុំគ្នា",
    "flower drop increases": "ការជ្រុះផ្កាកើនឡើង",
    "tiny slender thrips visible": "ឃើញមានទ្រីបតូចៗវែងៗ",
    "bunch size declines": "ទំហំស្ទងថយចុះ",
    "pseudostem vascular discoloration": "ប្តូរពណ៌សរសៃក្នុងដើមក្លែងចេក",
    "plant dies before bunch maturity": "ដើមងាប់មុនពេលស្ទងទុំ",
    "dark green streaks on midrib": "ឆ្នូតពណ៌បៃតងចាស់លើទ្រនុងស្លឹក",
    "severe stunting and no bunch": "ក្រិនខ្លាំងនិងមិនចេញស្ទង",
    "gummy ooze near tunnels": "មានជ័រស្អិតជិតរន្ធដង្កូវស៊ី",
    "plants topple under wind": "ដើមបាក់ពេលមានខ្យល់",
    "reduced grain filling": "ការដាក់គ្រាប់ថយចុះ",
    "pustules rupture and release spores": "ពងទឹកបែកចេញនិងបញ្ចេញស្ព័រ",
    "chlorosis around pustules": "ស្លេកពណ៌ជុំវិញពងទឹក",
    "severe cases reduce photosynthesis": "ករណីធ្ងន់ធ្ងរធ្វើឱ្យថយចុះការរស្មីសំយោគ",
    "frass in whorl funnel": "មានកាកសំណល់សត្វល្អិតក្នុងបណ្ដូល",
    "larvae hide deep in whorl": "ដង្កូវពួនជ្រៅក្នុងបណ្ដូល",
    "lower stalk internodes become soft": "ថ្នាំងដើមខាងក្រោមប្រែជាទន់",
    "lodging near maturity": "ដើមដួលជិតពេលទុំ",
    "poor ear filling": "ការដាក់គ្រាប់ពោតខ្សោយ",
    "tip blight after rain splash": "ជំងឺខូចចុងស្លឹកបន្ទាប់ពីភ្លៀង",
    "cottony masses on shoots": "ដុំសៗដូចកប្បាសលើត្រួយ",
    "distorted shoot tips": "ចុងត្រួយខូចទ្រង់ទ្រាយ",
    "oval water soaked spots on leaf sheath": "ចំណុចពងក្រពើដូចជាំទឹកលើស្រទបស្លឹក",
    "greenish gray lesions with dark brown margins": "ស្នាមដំបៅពណ៌ប្រផេះបៃតងមានគែមត្នោតចាស់",
    "lesions snake up the sheath to leaf blade": "ស្នាមដំបៅរាលដាលឡើងតាមស្រទបទៅផ្ទៃស្លឹក",
    "white fungal sclerotia form on lesions": "មានដុំផ្សិតស្ក្លេរ៉ូតពណ៌សដុះលើស្នាមដំបៅ",
    "lodging in dense canopy": "ដើមស្រូវដួលរាបក្នុងគុម្ពក្រាស់",
    "florets turn dark brown or black": "គ្រាប់ស្រូវក្នុងកួរប្រែជាពណ៌ត្នោតចាស់ឬខ្មៅ",
    "panicles remain upright due to empty grains": "កួរស្រូវនៅឈរត្រង់ដោយសារគ្រាប់ស្កក",
    "rotting grain husks after flowering": "សំបកគ្រាប់ស្រូវរលួយក្រោយពេលចេញផ្កា",
    "discolored grains on panicle": "គ្រាប់ស្រូវប្តូរពណ៌លើកួរ",
    "circular patches of yellowing and drying in field": "មានកន្លែងស្រូវលឿងនិងស្ងួតជារង្វង់ក្នុងស្រែ",
    "plants turn golden brown and dry (hopperburn)": "ដើមស្រូវប្រែពណ៌លឿងទុំហើយស្ងួតងាប់(Hopperburn)",
    "dense colonies of brown hoppers at stem base": "មានហ្វូងមមាចត្នោតច្រើននៅគល់ដើមស្រូវ",
    "sooty mold on lower stem from honeydew": "មានផ្សិតខ្មៅលើគល់ដើមដោយសារទឹកដមមមាច",
    "grains transform into velvety yellow green balls": "គ្រាប់ស្រូវក្លាយជាដុំម្សៅពណ៌លឿងបៃតង",
    "spore balls burst into greenish black powder": "ដុំស្ព័របែកចេញជាម្សៅខ្មៅបៃតង",
    "only few grains per panicle infected": "ឆ្លងតែប៉ុន្មានគ្រាប់ប៉ុណ្ណោះក្នុងមួយកួរ",
    "reduced grain quality and weight": "គុណភាពនិងទម្ងន់គ្រាប់ស្រូវធ្លាក់ចុះ",
    "black inky slimy rot at stem base": "រលួយរំអិលខ្មៅដូចទឹកថ្នាំនៅគល់ដើម",
    "foul smelling decaying mother tuber": "មើមដើមរលួយមានក្លិនស្អុយខ្លាំង",
    "stunted pale yellow upright foliage": "ស្លឹកដើមក្រិនស្លេកលឿងឈរត្រង់",
    "hollow and darkened lower stem": "ដើមខាងក្រោមប្រហោងក្នុងនិងប្រែពណ៌ខ្មៅ",
    "corky raised lesions on tuber skin": "ស្នាមដំបៅដុះគគ្រាតដូចឆ្នុកលើស្បែកមើម",
    "rough pitted scabs on potato surface": "ស្នាមស្រែងរដិបរដុបក្រហូងលើផ្ទៃដំឡូង",
    "superficial brown skin fissures on tubers": "ស្នាមប្រេះពណ៌ត្នោតលើស្រទាប់ស្បែកមើម",
    "tubers have unmarketable appearance": "មើមមានសភាពអាក្រក់មិនអាចលក់បាន",
    "upward rolling and leathery thickening of leaves": "ស្លឹករមៀលឡើងលើនិងក្រាស់ដូចស្បែក",
    "papery rattling sound when foliage is brushed": "ស្លឹកបន្លឺសំឡេងក្រោកៗដូចក្រដាសពេលប៉ះ",
    "net necrosis inside tuber flesh": "មានស្នាមសរសៃខ្មៅដូចសំណាញ់ក្នុងសាច់មើម",
    "stunted upright growth habit": "ដើមលូតលាស់ក្រិនឈរត្រង់",
    "hard black dirt like sclerotia on tuber skin": "មានដុំគ្រាប់ស្ព័រខ្មៅរឹងជាប់ស្បែកមើមដូចដី",
    "brown sunken cankers on underground stems": "ដំបៅលិចពណ៌ត្នោតលើដើមក្រោមដី",
    "aerial tubers forming in leaf axils": "កើតមានមើមតូចៗតាមប្រគាបស្លឹកលើអាកាស",
    "stunted growth with purplish top leaves": "លូតលាស់ក្រិនហើយស្លឹកកំពូលចេញពណ៌ស្វាយ",
    "water soaked dark sunken spot at blossom end of fruit": "ស្នាមលិចទឹកខ្មៅនៅគូទផ្លែប៉េងប៉ោះ",
    "leathery black depression on bottom of fruit": "ស្នាមផតខ្មៅស្វិតដូចស្បែកនៅបាតផ្លែ",
    "fruit ripens prematurely with flat black bottom": "ផ្លែទុំមុនអាយុនិងមានបាតខ្មៅរាបស្មើ",
    "calcium deficiency symptoms during dry spell": "រោគសញ្ញាកង្វះជាតិកាល់ស្យូមពេលរាំងស្ងួត",
    "numerous small circular spots with gray center and dark border": "ចំណុចមូលតូចៗជាច្រើនមានកណ្តាលប្រផេះនិងគែមខ្មៅ",
    "tiny black specks inside leaf spots": "មានគ្រាប់ខ្មៅល្អិតៗក្នុងស្នាមអុចស្លឹក",
    "severe lower leaf yellowing and shedding": "ស្លឹកក្រោមលឿងនិងជ្រុះរង្គោះខ្លាំង",
    "foliage loss exposes fruits to sunscald": "ជ្រុះស្លឹកអស់ធ្វើឱ្យផ្លែត្រូវកម្តៅថ្ងៃខ្លាំងរលាក",
    "white powdery patches on upper leaf surface": "មានកម្ទេចម្សៅសៗលើផ្ទៃស្លឹកប៉េងប៉ោះ",
    "bright yellow chlorotic spots opposite powdery patches": "ចំណុចលឿងភ្លឺទល់មុខនឹងកន្លែងមានម្សៅ",
    "leaves curl inward and scorch": "ស្លឹករមួលចូលក្នុងហើយឆេះស្ងួត",
    "premature foliage drying in dry seasons": "ស្លឹកស្ងួតជ្រុះមុនពេលកំណត់នៅរដូវប្រាំង",
    "fine yellow stippling and speckled foliage": "ស្លឹកមានស្នាមអុចលឿងល្អិតៗដូចម្សៅ",
    "delicate silken webbing on shoot tips and under leaves": "មានសរសៃសូត្រពីងពាងលើត្រួយនិងក្រោមស្លឹក",
    "bronzed or bleached dried leaves": "ស្លឹកប្រែជាពណ៌សំរឹទ្ធស្ងួតស្រពោន",
    "tiny red mites crawling on leaf underside": "ឃើញមានសត្វល្អិតល្អិតៗពណ៌ក្រហមវារក្រោមស្លឹក",
    "circular water soaked brown spots on leaves": "ចំណុចមូលៗពណ៌ត្នោតដូចជាំទឹកលើស្លឹក",
    "shot hole effect with dried spot centers falling out": "ស្លឹកធ្លុះធ្លាយដោយសារកណ្តាលចំណុចស្ងួតជ្រុះ",
    "sunken circular dark lesions on cucumber fruit": "ស្នាមដំបៅលិចរាងរង្វង់ខ្មៅលើផ្លែត្រសក់",
    "pinkish salmon gelatinous spore masses on fruit lesions": "មានដុំស្ព័រទន់ស្អិតពណ៌ផ្កាឈូកលើដំបៅផ្លែ",
    "tan water soaked lesions with dark brown borders on leaves": "ដំបៅពណ៌ត្នោតស្រាលមានគែមត្នោតចាស់លើស្លឹក",
    "gummy amber colored exudate oozing from stem cracks": "មានជ័រស្អិតពណ៌ទឹកឃ្មុំហូរចេញពីស្នាមប្រេះដើម",
    "tiny black fruiting dots on bleached stem lesions": "មានគ្រាប់ខ្មៅតូចៗលើស្នាមដំបៅដើមពណ៌ស",
    "collar rot causing sudden vine collapse": "រលួយគល់ដើមបណ្តាលឱ្យទងវល្លិ៍ងាប់ភ្លាមៗ",
    "progressive one sided wilting of runner vines": "ទងវល្លិ៍ស្រពោនម្ខាងមុនបន្តិចម្តងៗ",
    "yellowing of leaves starting near crown": "ស្លឹកប្រែពណ៌លឿងចាប់ផ្តើមពីគល់មក",
    "brown discoloration in vascular ring of taproot": "ប្រែពណ៌ត្នោតក្នុងសរសៃឫសកែវ",
    "sticky white pink fungal mycelium at vine base": "មានសរសៃផ្សិតពណ៌សផ្កាឈូកនៅគល់វល្លិ៍",
    "dense fine webbing covering shoot tips and flowers": "មានសំណាញ់ពីងពាងល្អិតៗគ្របលើត្រួយនិងផ្កា",
    "pale yellow stippling and bronzed foliage": "ស្លឹកមានស្នាមអុចលឿងស្លេកនិងពណ៌សំរឹទ្ធ",
    "crinkled dried leaves dropping off prematurely": "ស្លឹកជ្រីវជ្រួញស្ងួតជ្រុះមុនពេលកំណត់",
    "stunted vines with bitter small fruits": "វល្លិ៍ក្រិនផ្លែតូចៗមានរសជាតិល្វីង",
    "dark brown to black water soaked lesions at stem base": "ស្នាមដំបៅខ្មៅត្នោតដូចជាំទឹកនៅគល់ដើម",
    "rapid wilting of entire green plant without leaf yellowing": "ដើមស្រពោនភ្លាមៗទាំងនៅបៃតងដោយមិនទាន់លឿង",
    "constriction and girdling of lower stem near soil": "ដើមរួញស្វិតនិងរឹតគល់ក្បែរដី",
    "white mold growth on dark fruit lesions after rain": "មានផ្សិតពណ៌សដុះលើដំបៅផ្លែខ្មៅក្រោយភ្លៀង",
    "white powdery fungal coating on leaf underside": "កម្ទេចម្សៅសៗគ្របដណ្តប់នៅផ្ទៃក្រោមស្លឹក",
    "bright yellow chlorotic patches on upper leaf surface": "ចំណុចលឿងភ្លឺលេចឡើងលើផ្ទៃខាងលើស្លឹក",
    "severe upward curling and premature leaf shedding": "ស្លឹករមួលឡើងលើខ្លាំងនិងជ្រុះរង្គោះ",
    "bare branches with few exposed sunburnt fruits": "មែកទទេស្អាតសល់តែផ្លែរលាកថ្ងៃតិចតួច",
    "downward curling and cupping of young leaves": "ស្លឹកខ្ចីរមួលកោងចុះក្រោមរាងដូចពែង",
    "brittle and leathery leaf texture with glossy sheen": "ស្លឹកផុយស្រួយស្វិតនិងមានពន្លឺរលោង",
    "bronzed and distorted growing tips": "ត្រួយលូតលាស់ប្រែពណ៌សំរឹទ្ធនិងខូចទ្រង់ទ្រាយ",
    "cracked and corky fruit skin": "ស្បែកផ្លែម្ទេសប្រេះនិងឡើងគគ្រាត",
    "bleached papery white patches on fruit side exposed to sun": "ស្នាមពណ៌សស្ងួតដូចក្រដាសលើចំហៀងផ្លែត្រូវថ្ងៃ",
    "water soaked sunken spot at blossom end of chili": "ស្នាមលិចទឹកផតនៅចុងគូទផ្លែម្ទេស",
    "soft secondary rot on sunburnt fruit tissue": "រលួយទន់ជាបន្តបន្ទាប់លើសាច់ផ្លែដែលរលាកថ្ងៃ",
    "misshapen bent pods with dry tip": "ផ្លែម្ទេសកោងខូចទ្រង់ទ្រាយមានចុងស្ងួត",
    "black sunken spots on banana peel": "ចំណុចផតខ្មៅនៅលើសំបកផ្លែចេក",
    "orange to salmon pink spore masses on ripening fruit": "ដុំស្ព័រពណ៌ទឹកក្រូចផ្កាឈូកលើផ្លែទុំ",
    "fruit finger rot causing premature dropping": "ផ្លែចេកក្នុងស្និតរលួយជ្រុះមុនពេលកំណត់",
    "peel blemishes reducing market quality": "ស្នាមជាំអុចលើសំបកបន្ថយតម្លៃលក់លើទីផ្សារ",
    "wilting and yellowing of inner young leaves": "ស្លឹកខ្ចីខាងក្នុងស្រពោននិងប្រែពណ៌លឿង",
    "reddish brown internal vascular discoloration in pseudostem": "ប្តូរពណ៌សរសៃខាងក្នុងដើមក្លែងចេកទៅពណ៌ត្នោតក្រហម",
    "bacterial ooze droplets from cut flower stalk": "មានទឹករំអិលបាក់តេរីហូរចេញពីទងត្រយ៉ូងដែលកាត់",
    "fruit flesh with dry reddish brown rot pockets": "សាច់ផ្លែចេកមានដុំរលួយស្ងួតពណ៌ត្នោតក្រហម",
    "dark reddish brown rusty streaks on underside of leaf": "ឆ្នូតពណ៌ត្នោតក្រហមដូចច្រែះនៅផ្ទៃក្រោមស្លឹក",
    "sunken black elliptical spots with gray dry center": "ចំណុចរាងពងក្រពើខ្មៅលិចមានកណ្តាលប្រផេះស្ងួត",
    "rapid blighting and burning of mature leaves": "ស្លឹកចាស់ឆេះរលាកនិងងាប់យ៉ាងឆាប់រហ័ស",
    "premature fruit ripening on the plant": "ផ្លែចេកទុំមុនអាយុទាំងនៅលើដើម",
    "rusty reddish brown stains along fruit peel ridges": "ស្នាមប្រឡាក់ពណ៌ច្រែះក្រហមតាមគែមផ្លែចេក",
    "rough sandpapery texture on fruit skin": "ស្បែកផ្លែចេកឡើងគ្រើមដូចក្រដាសខ្សាច់",
    "cracking of banana fruit peel during filling": "សំបកផ្លែចេកប្រេះស្រាំពេលកំពុងដាក់គ្រាប់",
    "tiny yellow insects in flower bracts": "ឃើញមានសត្វល្អិតតូចៗពណ៌លឿងក្នុងស្រទាប់ត្រយ៉ូង",
    "rectangular narrow tan lesions delimited by leaf veins": "ដំបៅចតុកោណទ្រវែងពណ៌ត្នោតខ្ចីតាមបណ្តោយសរសៃស្លឹក",
    "blighted and prematurely dried lower leaves": "ស្លឹកខាងក្រោមខូចរលាកនិងស្ងួតមុនអាយុ",
    "lesions turn grayish brown under high humidity": "ស្នាមដំបៅប្រែពណ៌ប្រផេះត្នោតពេលមានសំណើមខ្ពស់",
    "severe leaf loss during grain filling stage": "ជ្រុះបាត់បង់ស្លឹកធ្ងន់ធ្ងរពេលកំពុងដាក់គ្រាប់",
    "large swollen spongy galls on ears tassels or stalk": "ដុំពកធំៗទន់ដូចអេប៉ុងលើត្រយ៉ូង កួរផ្កា ឬដើម",
    "galls rupture revealing powdery black spore masses": "ដុំពកធ្លាយចេញនូវម្សៅស្ព័រពណ៌ខ្មៅ",
    "distorted and malformed corn ears": "ត្រយ៉ូងពោតខូចទ្រង់ទ្រាយនិងរួញក្រញង់",
    "stunted plants with abnormal tassel growth": "ដើមក្រិនផ្កាឈ្មោលលូតលាស់មិនប្រក្រតី",
    "chlorotic yellow white striping from leaf base to tip": "ឆ្នូតឆ្នូតពណ៌សលឿងពីគល់ដល់ចុងស្លឹក",
    "downy white fungal growth on leaf underside in morning": "មានដុះផ្សិតរោមពណ៌សក្រោមស្លឹកនៅពេលព្រឹក",
    "crazy top symptom with leafy tassel proliferation": "កំពូលពោតចេញស្លឹកញឹកញុំារញ៉េរញ៉ៃ(Crazy top)",
    "stunted plants with barren ears or poor seed set": "ដើមក្រិនត្រយ៉ូងគ្មានគ្រាប់ឬគ្រាប់តិចតួច",
    "chewed corn silks preventing pollination": "សរសៃសូត្រពោតត្រូវដង្កូវកាត់ដាច់រារាំងការបង្កកំណើត",
    "entry holes and tunneling at the tip of corn ear": "មានរន្ធនិងផ្លូវខួងនៅចុងត្រយ៉ូងពោត",
    "frass and kernel damage at ear tip": "កាកសំណល់សត្វល្អិតនិងគ្រាប់ខូចខាតនៅចុងត្រយ៉ូង",
    "secondary mold infection inside corn husk": "មានឆ្លងផ្សិតជាបន្តបន្ទាប់ក្នុងស្រទាប់ស្រោមពោត",
    "feathery yellow chlorosis along secondary leaf veins": "ស្នាមលឿងដូចរោមសត្វតាមសរសៃស្លឹកតូចៗ",
    "brown necrotic streaks on green stem bark": "ឆ្នូតងាប់ពណ៌ត្នោតលើសំបកដើមបៃតង",
    "radial constriction and dark brown corky dry rot in root flesh": "មើមរួញស្វិតនិងមានរលួយស្ងួតពណ៌ត្នោតក្នុងសាច់មើម",
    "unusable woody root tubers at harvest": "មើមរឹងក្លាយជាឈើមិនអាចបរិភោគបានពេលប្រមូលផល",
    "cankers and lesions on green stems and petiole axils": "ដំបៅនិងដំបៅលើដើមបៃតងនិងប្រគាបទងស្លឹក",
    "tip dieback and wilting of young shoot branches": "ត្រួយមែកខ្ចីងាប់ពីចុងនិងស្រពោន",
    "deep cracks and gum exudation on mature stems": "ស្នាមប្រេះជ្រៅនិងមានជ័រស្អិតលើដើមចាស់",
    "weak brittle stems easily snapping in wind": "ដើមស្រួយងាយបាក់ពេលមានខ្យល់បោកបក់",
    "foul smelling soft watery rot of storage roots": "មើមដំឡូងមីរលួយជ្រាយទឹកមានក្លិនស្អុយខ្លាំង",
    "root skin sloughs off easily revealing decayed pulp": "ស្បែកមើមរបកងាយស្រួលបង្ហាញសាច់រលួយខាងក្នុង",
    "wilting and yellowing of canopy despite moist soil": "ស្លឹកស្រពោនលឿងទោះបីជាដីមានសំណើម",
    "complete collapse of tuberous root system": "ប្រព័ន្ធមើមដំឡូងមីរលួយខូចខាតទាំងស្រុង",
    "pinpoint yellow chlorotic spots on young apical leaves": "ចំណុចអុចលឿងល្អិតៗលើស្លឹកត្រួយខាងលើ",
    "bronzed and stunted growing shoot tip": "ចុងត្រួយលូតលាស់ប្រែពណ៌សំរឹទ្ធនិងក្រិន",
    "leaf drop from top of plant leaving candle stick appearance": "ស្លឹកខាងលើជ្រុះអស់សល់តែដើមដូចដើមទៀន",
    "reduced canopy density and root yield": "កម្រាស់ស្លឹកស្តើងនិងទិន្នផលមើមធ្លាក់ចុះ",
    "leaf edges folded and fastened with silk": "គែមស្លឹកត្រូវបានមូរនិងចងភ្ជាប់ដោយសរសៃសូត្រ",
    "long white transparent streaks on damaged leaves": "ឆ្នូតសថ្លាវែងៗលើស្លឹកដែលរងការបំផ្លាញ",
    "green caterpillars feeding inside folded leaves": "ដង្កូវពណ៌បៃតងស៊ីស៊ីសាច់ស្លឹកក្នុងបំពង់មូរ",
    "papery bleached leaf canopy": "ផ្ទៃស្លឹកប្រែជាសស្លេកស្ដើងដូចក្រដាស",
    "general pale green to yellow foliage": "ស្លឹកដំណាំទាំងមូលប្រែជាពណ៌បៃតងស្លេកទៅលឿង",
    "stunted tillering and reduced plant height": "ការបែកគុម្ពក្រិននិងកម្ពស់ដើមទាប",
    "lower leaves turn yellow and die prematurely": "ស្លឹកខាងក្រោមប្រែជាលឿងហើយងាប់មុនអាយុ",
    "short panicles with light grains": "កួរស្រូវខ្លីហើយគ្រាប់ស្រាលមិនពេញ",
    "wrinkled sunken brown rot on tuber surface": "ស្នាមរលួយពណ៌ត្នោតផតជ្រួញលើស្បែកមើម",
    "internal cavities lined with white or blue-pink mold": "ប្រហោងក្នុងមើមមានដុះផ្សិតពណ៌សឬខៀវផ្កាឈូក",
    "tuber becomes light, dry and shriveled like stone": "មើមស្រាល ស្ងួត និងស្វិតរឹងដូចថ្ម",
    "narrow round puncture holes bored into tubers": "រន្ធខួងតូចៗមូលៗចាក់ចូលក្នុងមើម",
    "dark tunnels bored through potato flesh": "រូងងងឹតខួងកាត់សាច់ដំឡូងបារាំង",
    "wilted young plants severed beneath soil line": "កូនដំឡូងស្រពោនដោយសារដាច់គល់ក្រោមដី",
    "fuzzy grayish brown mold on flowers and fruit stems": "ផ្សិតពណ៌ប្រផេះត្នោតដុះដូចរោមលើផ្កានិងទងផ្លែ",
    "pale water-soaked spots on green fruit (ghost spots)": "ចំណុចស្លេកដូចជាំទឹកលើផ្លែខៀវ(Ghost spots)",
    "soft rot of flowers causing heavy flower drop": "រលួយទន់លើកញ្ចុំផ្កាធ្វើឱ្យជ្រុះផ្កាយ៉ាងខ្លាំង",
    "sunken water-soaked circular lesions on ripe fruit": "ដំបៅលិចទឹកមូលៗផតលើផ្លែទុំ",
    "concentric rings of salmon pink spores on fruit": "រង្វង់ស្ព័រពណ៌ផ្កាឈូកជាជួរៗលើផ្លែ",
    "soft rotting depressions on ripe tomatoes": "ស្នាមផตรលួយទន់លើផ្លែប៉េងប៉ោះទុំ",
    "water-soaked sunken spots on fruit exuding amber gum": "ចំណុចលិចទឹកផតលើផ្លែមានហូរជ័រពណ៌ទឹកឃ្មុំ",
    "crater-like scabs with olive-green velvety mold on fruit": "ស្នាមស្រែងដូចរណ្តៅមានផ្សិតរលោងពណ៌បៃតងចាស់លើផ្លែ",
    "ragged angular holes in young leaves": "រន្ធរហែកជ្រុងៗលើស្លឹកខ្ចី",
    "bright yellow chlorotic mottling on mature leaves": "ស្នាមអុចៗពណ៌លឿងភ្លឺលើស្លឹកចាស់",
    "green veins contrasting with yellow blade": "សរសៃស្លឹកពណ៌បៃតងផ្ទុយពីផ្ទៃស្លឹកពណ៌លឿង",
    "thickened brittle leaves rolling downward": "ស្លឹកក្រាស់ស្រួយរមៀលកោងចុះក្រោម",
    "water-soaked lesions on stems near soil line": "ដំបៅដូចជាំទឹកលើដើមក្បែរផ្ទៃដី",
    "cottony fluffy white mold covering infected branches": "ផ្សិតសទន់ដូចកប្បាសគ្របលើមែកដែលឆ្លង",
    "large hard black sclerotia inside hollow stems": "ដុំស្ព័រខ្មៅរឹងធំៗក្នុងប្រហោងដើម",
    "sudden wilting and branch collapse": "ស្រពោនភ្លាមៗនិងបាក់មែកស្រុតចុះ",
    "tip dieback of branches turning brown to black": "ចុងមែកងាប់ស្ងួតប្រែពីពណ៌ត្នោតទៅខ្មៅ",
    "sunken dark lesions along stems and twigs": "ដំបៅផតពណ៌ខ្មៅតាមបណ្តោយដើមនិងមែកតូចៗ",
    "shriveled brown leaves clinging to dead branches": "ស្លឹកស្វិតពណ៌ត្នោតជាប់នឹងមែកងាប់មិនព្រមជ្រុះ",
    "blackening and rotting of fruit crown tissues": "ជាលិកាក្បាលស្និតផ្លែចេកប្រែជាខ្មៅនិងរលួយ",
    "white or gray fungal mold on severed hand cushions": "ផ្សិតពណ៌សឬប្រផេះដុះលើកន្លែងកាត់ស្និតចេក",
    "fruit fingers separating and dropping from crown": "ផ្លែចេករបូតនិងជ្រុះធ្លាក់ពីស្និត",
    "larval tunnels riddling root corm and bulb": "រូងដង្កូវខួងញេចញ៉ៃក្នុងមើមនិងគល់ចេក",
    "jelly-like sap exudation from base of plant": "មានហូរជ័រថ្លាដូចចាហួយចេញពីគល់ដើម",
    "jelly like sap exudation from base of plant": "មានហូរជ័រថ្លាដូចចាហួយចេញពីគល់ដើម",
    "goosenecking and curved stalks at base lodging": "ដើមពោតកោងដូចកក្ងាននៅគល់(Lodging)",

    "yellowing and dying of outer leaf canopy": "ស្លឹកខាងក្រៅប្រែពណ៌លឿងនិងងាប់ជាបន្តបន្ទាប់",
    "plants easily pushed over by hand": "ដើមចេកងាយនឹងរុញដួលដោយដៃទទេ",
    "reddish pink mold growing from ear tip downward": "ផ្សិតពណ៌ផ្កាឈូកក្រហមដុះពីចុងត្រយ៉ូងចុះក្រោម",
    "husks tightly glued to ear by fungal mycelium": "ស្រោមពោតស្អិតជាប់នឹងត្រយ៉ូងដោយសារសរសៃផ្សិត",
    "brittle kernels covered in pinkish white mycelium": "គ្រាប់ពោតស្រួយបាក់បែកមានគ្របដណ្តប់ដោយផ្សិតសផ្កាឈូក",
    "goosenecking and curved stalks at base (lodging)": "ដើមពោតកោងដូចកក្ងាននៅគល់(Lodging)",
    "roots pruned back to stalk node": "ឫសពោតត្រូវដង្កូវកាត់ដាច់ដល់ថ្នាំងដើម",
    "poor root anchoring in windy weather": "ឫសទប់ដីមិនជាប់ពេលមានខ្យល់បក់",
    "abnormal elongation of young internodes": "ថ្នាំងដើមខ្ចីលូតវែងខុសប្រក្រតី",
    "cankers on leaf veins and petioles": "ស្នាមដំបៅលើសរសៃស្លឹកនិងទងស្លឹក",
    "distorted curled leaves with necrotic spots": "ស្លឹកខូចទ្រង់ទ្រាយរមួលមានចំណុចងាប់",
    "fragile spindly stems": "ដើមស្តើងវែងងាយបាក់",
    "interveinal yellowing with prominent green veins": "ផ្ទៃស្លឹកចន្លោះសរសៃប្រែពណ៌លឿងដោយសរសៃនៅបៃតង",
    "purplish red tint on older leaf margins": "គែមស្លឹកចាស់មានពណ៌ស្វាយក្រហម",
    "stunted umbrella-like canopy": "គុម្ពស្លឹកខាងលើក្រិនរាងដូចឆ័ត្រ",
    "seedlings grow exceptionally tall and slender": "កូនស្រូវដុះលូតកម្ពស់ខ្ពស់វែងខុសធម្មតានិងស្គមស្តើង",
    "pale yellow green leaves with elongated internodes": "ស្លឹកពណ៌បៃតងលឿងស្លេកមានថ្នាំងដើមវែងៗ",
    "adventitious roots developing on lower stem nodes": "ឫសខ្យល់ដុះចេញពីថ្នាំងដើមខាងក្រោម",
    "whitish pink fungal coating at base of dying plants": "កម្ទេចផ្សិតពណ៌សផ្កាឈូកដុះនៅគល់ស្រូវជិតងាប់",
    "sterile panicles or empty grains on infected tillers": "កួរស្រូវស្កកគ្មានគ្រាប់លើគុម្ពដែលឆ្លងជំងឺ",
    "large chevron shaped zonate lesions on leaf tips": "ដំបៅធំៗរាងដូចព្រួញមានឆ្នូតៗនៅចុងស្លឹក",
    "alternating bands of dark brown and bleached light tan on leaves": "ឆ្នូតពណ៌ត្នោតចាស់ឆ្លាស់គ្នាជាមួយពណ៌ត្នោតខ្ចីលើស្លឹក",
    "leaf tips dry out and split in wind": "ចុងស្លឹកស្ងួតហើយបែករហែកពេលមានខ្យល់បោក",
    "blighting of upper leaf canopy after flowering": "ស្លឹកផ្នែកខាងលើស្ងួតឆេះក្រោយពេលស្រូវចេញផ្កា",
    "short narrow linear brown spots parallel to leaf veins": "ចំណុចត្នោតឆ្នូតៗខ្លីតូចស្របតាមសរសៃស្លឹក",
    "spots turn dark reddish brown on mature leaves": "ចំណុចប្រែពណ៌ត្នោតក្រហមចាស់លើស្លឹកចាស់",
    "premature leaf drying and canopy lodging": "ស្លឹកស្ងួតមុនអាយុហើយគុម្ពស្រូវដួលរាប",
    "discoloration of leaf sheaths and glumes": "ស្រទបស្លឹកនិងសំបកគ្រាប់ប្តូរពណ៌ខុសប្រក្រតី",
    "tubular hollow onion leaf gall silver shoot": "ស្លឹកស្រូវក្លាយជាបំពង់ប្រហោងដូចស្លឹកខ្ទឹម(Silver shoot)",
    "suppression of panicle emergence on infested tillers": "កួរស្រូវមិនអាចចេញរួចលើគុម្ពដែលមានរុយពក",
    "excessive stunted tillering with bushy appearance": "បែកគុម្ពក្រិនច្រើនខុសប្រក្រតីរាងដូចគុម្ពស្មៅ",
    "spongy swollen tiller bases": "គល់គុម្ពស្រូវហើមទន់ដូចអេប៉ុង",
    "cut leaf tips floating on water surface": "ចុងស្លឹកត្រូវកាត់ដាច់អណ្តែតលើផ្ទៃទឹក",
    "ladder like transparent patches eaten on leaf blade": "ស្នាមស៊ីសាច់ស្លឹកថ្លាដូចកាំជណ្ដើរលើផ្ទៃស្លឹក",
    "leaf tubes cases attached to rice stems near water level": "សំបុកស្លឹកមូរជាប់ដើមស្រូវក្បែរផ្ទៃទឹក",
    "defoliation of young transplanted seedlings": "កូនសំណាបទើបស្ទូងជ្រុះបាត់បង់ស្លឹក",
    "orange brown scorching and drying of leaf margins": "គែមស្លឹកឆេះក្រហមទឹកក្រូចនិងស្ងួត",
    "roots turn dark brown or black with foul sulfur odor": "ឫសស្រូវប្រែពណ៌ខ្មៅមានក្លិនស្អុយស្ពាន់ធ័រ",
    "stunted hill growth with poor root penetration": "គុម្ពស្រូវក្រិនឫសចាក់ចូលដីមិនបានល្អ",
    "uneven patchy growth across depression areas in field": "ស្រូវលូតលាស់មិនស្មើគ្នាតាមកន្លែងទំនាបក្នុងស្រែ",
    "brown rusty blotches appearing on middle leaves": "ស្នាមអុចៗពណ៌ច្រែះត្នោតលេចឡើងលើស្លឹកកណ្តាល",
    "slow tillering with narrow erect dark green leaves": "បែកគុម្ពយឺតស្លឹកតូចឈរត្រង់ពណ៌បៃតងចាស់",
    "delayed maturity by several weeks": "ស្រូវពន្យារពេលទុំយឺតជាងធម្មតាជាច្រើនសប្តាហ៍",
    "leaf midrib chlorosis near base of young leaves": "ទ្រនុងស្លឹកស្លេកពណ៌លឿងក្បែរគល់ស្លឹកខ្ចី",
    "sunken brown rot with concentric skin wrinkles on tubers": "ដំបៅរលួយផតពណ៌ត្នោតមានស្បែកជ្រួញជារង្វង់លើមើម",
    "white yellow fungal tufts in internal tuber cavities": "ដុំផ្សិតពណ៌សលឿងដុះក្នុងប្រហោងសាច់មើម",
    "tuber flesh collapses into dry powdery dry rot": "សាច់មើមដំឡូងស្រុតចុះក្លាយជារលួយស្ងួតដូចម្សៅ",
    "yellowing and wilting of lower vines": "វល្លិ៍ផ្នែកខាងក្រោមប្រែជាលឿងនិងស្រពោន",
    "silvery glistening sheen patches on washed tuber skin": "ស្នាមពណ៌ប្រាក់រលោងភ្លឺលើស្បែកមើមពេលលាងទឹក",
    "loss of skin moisture causing tuber shrinkage in storage": "បាត់បង់សំណើមស្បែកធ្វើឱ្យមើមស្វិតពេលទុកដាក់",
    "dark brown smudgy lesions with indistinct margins on skin": "ស្នាមប្រឡាក់ពណ៌ត្នោតចាស់ព្រិលៗលើស្បែកមើម",
    "slight flakiness of tuber periderm": "ស្រទាប់ស្បែកខាងក្រៅមើមរបករបៀបកម្ទេចៗ",
    "internal water soaked rot exuding brownish watery liquid": "រលួយជោកជាំទឹកខាងក្នុងហូរទឹករាវពណ៌ត្នោត",
    "tuber skin remains intact while flesh liquefies inside": "ស្បែកមើមនៅល្អតែក្លាយជារាវរលួយខាងក្នុង",
    "decayed flesh turns dark brown to black when exposed to air": "សាច់រលួយប្រែពណ៌ខ្មៅពេលត្រូវខ្យល់",
    "rotting tubers in warm moist harvest conditions": "មើមរលួយពេលប្រមូលផលក្នុងអាកាសធាតុក្តៅសើម",
    "young potato stems clipped cleanly at soil surface": "ដើមដំឡូងខ្ចីត្រូវកាត់ដាច់ស្មើត្រឹមផ្ទៃដី",
    "deep irregular gouge holes eaten into maturing tubers": "រន្ធចោះស៊ីជ្រៅៗរដិបរដុបលើមើមដំឡូងជិតទុំ",
    "wilting of healthy looking plants due to severed feeder roots": "ដើមស្រពោនភ្លាមៗដោយសារដាច់ឫសបឺតចំណី",
    "fat white c-shaped grubs discovered in soil ridge": "ឃើញមានដង្កូវកោងពណ៌សធំៗក្នុងរងដី",
    "concentric brown necrotic rings and arcs in tuber flesh": "រង្វង់និងធ្នូស្នាមងាប់ពណ៌ត្នោតក្នុងសាច់មើម",
    "bright yellow chevron or v-shaped markings on leaves": "ស្នាមឆ្នូតពណ៌លឿងភ្លឺរាងអក្សរ V លើស្លឹក",
    "shortened internodes causing bunchy top foliage": "ថ្នាំងដើមខ្លីធ្វើឱ្យស្លឹកកំពូលកញ្ចុំញឹក",
    "cracked and deformed harvest tubers": "មើមប្រេះស្រាំនិងខូចទ្រង់ទ្រាយពេលប្រមូលផល",
    "marginal leaf scorch and bronze curling on older leaves": "គែមស្លឹកចាស់ឆេះរលាកពណ៌សំរឹទ្ធនិងរមួល",
    "uniform chlorosis of lower foliage progressing upward": "ស្លឹកក្រោមលឿងស្មើគ្នារាលដាលឡើងលើ",
    "leaves become dull dark green with necrotic edges": "ស្លឹកប្រែជាពណ៌បៃតងស្រអាប់មានគែមងាប់",
    "premature vine death and small tubers": "ដើមដំឡូងងាប់មុនអាយុហើយមើមនៅតូចៗ",
    "swollen galls and knotty beads on entire root system": "ដុំពកហើមនិងគ្រាប់ពកដូចអង្កាំពាសពេញប្រព័ន្ធឫស",
    "stunted yellowing plants with poor nutrient uptake": "ដើមក្រិនលឿងដោយសារស្រូបជីវជាតិមិនបាន",
    "midday temporary wilting with slow evening recovery": "ស្រពោនពេលថ្ងៃត្រង់ហើយងើបឡើងវិញយឺតនៅពេលល្ងាច",
    "sparse flowering and drastically reduced fruit yield": "ចេញផ្កាតិចតួចហើយទិន្នផលផ្លែធ្លាក់ចុះខ្លាំង",
    "shallow distorted root branching": "ឫសបែកខ្នែងរាក់ៗនិងខូចទ្រង់ទ្រាយ",
    "brown necrotic streaks and open cankers on stems": "ឆ្នូតងាប់ពណ៌ត្នោតនិងដំបៅប្រេះលើដើម",
    "small white blister spots with dark centers on fruit": "ចំណុចពងទឹកសតូចៗមានកណ្តាលខ្មៅលើផ្លែ(ភ្នែកសត្វ)",
    "marginal leaf scorch with white yellow halo": "គែមស្លឹកឆេះមានរង្វង់ពណ៌លឿងសព័ទ្ធជុំវិញ",
    "yellowish pith breakdown inside split stem": "បណ្ដូលខាងក្នុងដើមរលួយប្រែពណ៌លឿងពេលពុះមើល",
    "dark brown rot on taproot and main root crown": "រលួយពណ៌ត្នោតចាស់លើឫសកែវនិងគល់ឫសធំ",
    "chocolate brown vascular discoloration limited to lower stem": "សរសៃដើមខាងក្រោមប្តូរពណ៌ត្នោតដូចសូកូឡា",
    "yellowing of lower leaves progressing slowly upward": "ស្លឹកខាងក្រោមលឿងរាលដាលឡើងលើបន្តិចម្តងៗ",
    "gradual wilting and collapse of mature fruiting vines": "ដើមប៉េងប៉ោះមានផ្លែស្រពោនបន្តិចម្តងៗរហូតងាប់",
    "blistered dark green and light green mosaic on leaves": "ស្នាមពងប៉ោងមូសៃបៃតងចាស់ឆ្លាស់បៃតងខ្ចីលើស្លឹក",
    "fern leaf symptom with extremely narrow distorted leaflets": "ស្លឹកប៉េងប៉ោះរួញតូចដូចស្លឹកបន្លាស្អិត(Fern leaf)",
    "internal brown browning of fruit wall": "សាច់ជញ្ជាំងផ្លែប៉េងប៉ោះខាងក្នុងប្រែពណ៌ត្នោត",
    "uneven ripening with mottled yellow green patches on fruit": "ផ្លែទុំមិនស្មើគ្នាមានចំណុចអុចៗលឿងបៃតងលើផ្លែ",
    "clouds of small white insects flying when canopy is shaken": "ហ្វូងរុយសតូចៗហើរចេញពេលរលាក់គុម្ពដើម",
    "thick sticky shiny honeydew covering foliage": "ទឹកដមស្អិតរលោងគ្របដណ្តប់ពេញផ្ទៃស្លឹក",
    "black soot like mold layer blocking sunlight on leaves": "ស្រទាប់ផ្សិតខ្មៅដូចធ្យូងបាំងពន្លឺថ្ងៃលើស្លឹក",
    "premature leaf yellowing and dropping": "ស្លឹកប្រែជាលឿងនិងជ្រុះមុនពេលកំណត់",
    "deep scars, crevices, and convolutions at blossom end of fruit": "ស្នាមឆ្នូតជ្រៅៗប្រេះស្រាំខូចទ្រង់ទ្រាយនៅគូទផ្លែ",
    "large leathery bleached white patches on sun exposed fruit shoulder": "ស្នាមពណ៌សស្ងួតដូចស្បែកលើស្មាផ្លែត្រូវកម្តៅថ្ងៃ",
    "fruit cracking in concentric rings around stem scar": "ផ្លែប្រេះជារង្វង់ព័ទ្ធជុំវិញទងផ្លែ",
    "pulp breakdown beneath sunburnt fruit surface": "សាច់ផ្លែខូចរលួយនៅក្រោមស្បែកដែលរលាកថ្ងៃ",
    "individual leaves wilt during hot day, recover at night, then wilt permanently": "ស្លឹកស្រពោនពេលថ្ងៃក្តៅ ងើបវិញពេលយប់ រួចស្រពោនងាប់រហូត",
    "viscous white bacterial strands stringing when cut stem ends are pulled apart": "ទឹករំអិលបាក់តេរីស្អិតយឺតជាសរសៃពេលទាញកាត់ដើមចេញពីគ្នា",
    "dull dark green color of wilted foliage without initial yellowing": "ស្លឹកស្រពោនមានពណ៌បៃតងស្រអាប់ដោយមិនទាន់លឿង",
    "cucumber beetles feeding on foliage in field": "មានសត្វល្អិតកញ្ចែស៊ីស្លឹកត្រសក់ក្នុងចម្ការ",
    "water-soaked yellow brown sunken lesions on underside of fruit touching soil": "ដំបៅលិចទឹកពណ៌ត្នោតលឿងលើផ្ទៃផ្លែត្រសក់ប៉ះដី",
    "crusty brown rot on fruit side resting on wet ground": "ស្នាមរលួយរឹងពណ៌ត្នោតលើចំហៀងផ្លែដេកលើដីសើម",
    "brown webbing and fungal threads clinging to rotted fruit rind": "សរសៃផ្សិតពណ៌ត្នោតតោងជាប់សំបកផ្លែដែលរលួយ",
    "decayed fruit becomes soft, watery and unmarketable": "ផ្លែរលួយប្រែជាទន់ជ្រាយទឹកមិនអាចលក់បាន",
    "heavy bead-like galls on roots causing clubbed appearance": "ដុំពកដូចគ្រាប់អង្កាំច្រើនលើឫសធ្វើឱ្យឫសឡើងដុំៗ",
    "stunted vines with pale green to yellowish foliage": "ទងវល្លិ៍ក្រិនស្លឹកពណ៌បៃតងស្លេកទៅលឿង",
    "flaccid wilting during sunny afternoons": "ស្រពោនទន់ដៃជើងនៅពេលថ្ងៃក្តៅខ្លាំង",
    "reduced vine length and aborted female flowers": "ប្រវែងវល្លិ៍ខ្លីផ្កាញីស្វិតជ្រុះមិនចេញផ្លែ",
    "curled downward leaf margins with crinkled puckered blade": "គែមស្លឹករមួលចុះក្រោមផ្ទៃស្លឹកជ្រីវជ្រួញ",
    "silvery flecks and bronze discoloration on leaf underside": "ស្នាមអុចពណ៌ប្រាក់និងពណ៌សំរឹទ្ធនៅផ្ទៃក្រោមស្លឹក",
    "distorted hooked cucumbers with pale yellow streaks": "ផ្លែត្រសក់កោងខូចទ្រង់ទ្រាយមានឆ្នូតលឿងស្លេក",
    "black sooty mold coating on leaves from insect honeydew": "ស្រទាប់ផ្សិតខ្មៅស្រោបលើស្លឹកដោយសារទឹកដមសត្វល្អិត",
    "interveinal chlorosis on older leaves with green veins remaining": "ផ្ទៃស្លឹកចាស់លឿងចន្លោះសរសៃដោយសរសៃនៅបៃតង",
    "yellowing and scorch along outer leaf perimeter": "លឿងនិងឆេះរលាកតាមគែមបរិវេណស្លឹកខាងក្រៅ",
    "tapered pointed stem end of cucumber fruits": "ផ្លែត្រសក់រួញស្រួចក្បាលខាងទង",
    "brittle leaves that shatter when handled": "ស្លឹកស្រួយងាយបាក់បែកពេលចាប់កាន់",
    "rapid daytime wilting of entire green canopy with no prior yellowing": "ដើមម្ទេសទាំងមូលស្រពោនភ្លាមៗនៅពេលថ្ងៃដោយមិនទាន់លឿង",
    "leaves remain green while hanging limp and dry on branches": "ស្លឹកនៅតែពណ៌បៃតងតែទន់ស្វិតធ្លាក់ចុះលើមែក",
    "dark brown vascular discoloration in lower stem xylem": "សរសៃដើមខាងក្រោមប្រែជាពណ៌ត្នោតចាស់",
    "milky white bacterial streaming in water glass test": "មានទឹករំអិលបាក់តេរីហូរចេញដូចផ្សែងពេលដាក់ក្នុងកែវទឹក",
    "swollen irregular galls and knots on feeder roots": "ដុំពករដិបរដុបលើឫសបឺតចំណីរបស់ម្ទេស",
    "chlorotic pale yellow stunted bushy plants": "ដើមម្ទេសក្រិនលឿងស្លេករាងដូចកញ្ចុំស្មៅ",
    "premature flower drop and small unmarketable chili pods": "ផ្កាជ្រុះមុនពេលកំណត់ផ្លែម្ទេសតូចៗលក់មិនកើត",
    "wilting of branches during dry sunny periods": "មែកម្ទេសស្រពោនពេលមានអាកាសធាតុក្តៅហួតហែង",
    "dense clusters of green and black aphids under tender leaves": "ហ្វូងសត្វល្អិតអាហ្វីតបៃតងខ្មៅផ្តុំគ្នាក្រោមត្រួយខ្ចី",
    "distorted wrinkled leaves with blistered yellow green mosaic": "ស្លឹកខូចទ្រង់ទ្រាយជ្រីវជ្រួញមានស្នាមមូសៃពងប៉ោង",
    "sticky honeydew attracting black sooty mold on foliage": "ទឹកដមស្អិតទាក់ទាញផ្សិតខ្មៅដុះលើស្លឹក",
    "stunted bushy growth with shortened internodes": "ការលូតលាស់ក្រិនថ្នាំងដើមខ្លីៗ",
    "circular spots with bleached white center and prominent dark brown ring": "ចំណុចមូលមានកណ្តាលសស្លេកនិងរង្វង់ត្នោតចាស់ព័ទ្ធ(ភ្នែកកង្កែប)",
    "frogeye like spots scattered across upper leaves": "ស្នាមអុចដូចភ្នែកកង្កែបរាយប៉ាយលើស្លឹកខាងលើ",
    "severe defoliation leaving bare twigs with hanging fruits": "ជ្រុះស្លឹកខ្លាំងសល់តែមែកទទេជាមួយផ្លែយោល",
    "cankers on fruit stalks causing premature pod drop": "ដំបៅលើទងផ្លែធ្វើឱ្យផ្លែម្ទេសជ្រុះមុនអាយុ",
    "neat circular entry holes bored into chili pods": "រន្ធមូលស្អាតចោះចូលក្នុងផ្លែម្ទេស",
    "frass pellets pushed out of fruit borehole": "កាកសំណល់ដង្កូវច្រានចេញពីមាត់រន្ធផ្លែ",
    "watery decay and internal rotting of chili core": "រលួយជ្រាយទឹកនិងខូចសាច់ខាងក្នុងផ្លែម្ទេស",
    "damaged chili pods turn pale yellow and drop early": "ផ្លែម្ទេសខូចប្រែពណ៌លឿងស្លេកហើយជ្រុះឆាប់រហ័ស",
    "yellowing and breakdown of petiole near stem on young leaves": "ទងស្លឹកខ្ចីលឿងហើយបាក់នៅជិតដើម",
    "central leaves break and collapse like an umbrella": "ស្លឹកកណ្តាលបាក់ស្រុតចុះដូចឆ័ត្របត់",
    "brown to black vascular bundles inside cut pseudostem": "បាច់សរសៃក្នុងដើមក្លែងចេកប្រែពណ៌ត្នោតខ្មៅពេលកាត់មើល",
    "internal dark dry rotting of fruit pulp with premature yellowing": "សាច់ផ្លែចេករលួយស្ងួតពណ៌ខ្មៅខាងក្នុងហើយទុំមុនអាយុ",
    "large oval to diamond shaped lesions with zigzag yellow borders": "ដំបៅធំៗរាងពងក្រពើមានគែមលឿងរាងហ្ស៊ីកហ្សាក់",
    "grayish brown concentric zones within leaf spots": "ឆ្នូតរង្វង់ពណ៌ប្រផេះត្នោតក្នុងស្នាមអុចស្លឹក",
    "lesions coalesce causing large blighted leaf sections": "ស្នាមដំបៅរួមគ្នាធ្វើឱ្យខូចផ្ទៃស្លឹកធំៗ",
    "drying and shredding of older leaf blades": "ផ្ទៃស្លឹកចាស់ៗស្ងួតហើយរហែកជាបន្ទះៗ",
    "reddish purple to black lesions on primary cord roots": "ដំបៅពណ៌ស្វាយក្រហមទៅខ្មៅលើឫសធំៗរបស់ចេក",
    "extensive rotting and death of anchor root system": "ឫសទប់ដើមចេករលួយខូចខាតយ៉ាងទូលំទូលាយ",
    "entire mature banana mat uproots and topples in light wind": "គុម្ពចេកទាំងមូលរបើកឫសដួលរលំពេលមានខ្យល់បន្តិចបន្តួច",
    "small stunted bunches with thin fingers": "ស្ទងចេកតូចក្រិនផ្លែស្គមស្តើងៗ",
    "dense colonies of dark brown aphids around pseudostem base and throat": "ហ្វូងអាហ្វីតពណ៌ត្នោតចាស់នៅគល់និងបំពង់កដើមចេក",
    "aphids hidden under leaf sheaths and beneath bracts": "អាហ្វីតពួនក្រោមស្រទបស្លឹកនិងក្រោមស្រទាប់ត្រយ៉ូង",
    "sticky honeydew secretion with black sooty mold coating": "ការបញ្ចេញទឹកដមស្អិតមានស្រទាប់ផ្សិតខ្មៅស្រោប",
    "vector transmitting bunchy top virus symptoms": "ភ្នាក់ងារចម្លងរោគបង្កឱ្យចេញរោគសញ្ញាកំពូលកញ្ចុំចេក",
    "rapid yellowing and orange necrosis of leaf margins curling inward": "គែមស្លឹកប្រែពណ៌លឿងទឹកក្រូចយ៉ាងលឿនហើយរមួលចូលក្នុង",
    "premature drying and folding of older leaf canopy": "ស្លឹកចាស់ស្ងួតនិងបត់ចុះមុនពេលកំណត់",
    "slender weak pseudostems that buckle under bunch weight": "ដើមក្លែងចេកស្គមទន់ងាយបាក់ទ្រទម្ងន់ស្ទងមិនរួច",
    "small poorly filled banana fingers with brittle skin": "ផ្លែចេកតូចៗដាក់សាច់មិនពេញមានសំបកស្រួយ",
    "dark water soaked soft rot on middle stalk internodes": "រលួយទន់ដូចជាំទឹកពណ៌ខ្មៅលើថ្នាំងដើមកណ្តាល",
    "foul fermenting odor emitted from decaying stalk": "មានក្លិនស្អុយជូរផ្អូមភាយចេញពីដើមពោតរលួយ",
    "stalk collapses and twists at rot point while top leaves remain green": "ដើមបាក់ស្រុតនិងរមួលត្រង់កន្លែងរលួយដោយស្លឹកលើនៅបៃតង",
    "slime and bacterial decay in inner nodal tissue": "មានទឹករំអិលបាក់តេរីរលួយក្នុងជាលិកាថ្នាំងដើម",
    "oval to spindle shaped tan leaf spots with dark reddish borders": "ចំណុចស្លឹកពណ៌ត្នោតខ្ចីរាងទ្រវែងមានគែមក្រហមចាស់",
    "shiny black streaks and spots on outer stalk surface": "ឆ្នូតនិងចំណុចខ្មៅរលោងលើផ្ទៃខាងក្រៅដើមពោត",
    "top dieback symptom with upper leaves dying prematurely": "ស្លឹកផ្នែកខាងលើងាប់ស្ងួតមុនអាយុ(Top dieback)",
    "black rotted pith inside lower stalk causing late lodging": "បណ្ដូលក្នុងដើមផ្នែកក្រោមរលួយខ្មៅបណ្តាលឱ្យដួលរាប",
    "dense clusters of bluish green aphids inside whorl and on tassels": "ហ្វូងអាហ្វីតពណ៌បៃតងខៀវផ្តុំគ្នាក្នុងបណ្ដូលនិងលើកួរផ្កា",
    "tassels and silks coated in sticky glistening honeydew": "កួរផ្កានិងសរសៃសូត្រពោតប្រឡាក់ទឹកដមស្អិតរលោង",
    "black sooty mold covering ear husks and leaves": "ផ្សិតខ្មៅគ្របលើស្រោមត្រយ៉ូងនិងស្លឹកពោត",
    "interfered pollination resulting in incomplete ear kernel fill": "រារាំងការបង្កកំណើតធ្វើឱ្យគ្រាប់ពោតមិនពេញត្រយ៉ូង",
    "entire ear or tassel converted into mass of powdery black spores": "ត្រយ៉ូងឬកួរផ្កាទាំងមូលក្លាយជាដុំម្សៅស្ព័រខ្មៅ",
    "tassel proliferation into leafy vegetative structures": "ផ្កាឈ្មោលពោតដុះបែកចេញជាស្លឹកតូចៗ",
    "absence of normal ear development with floral teardrop galls": "គ្មានការលូតលាស់ត្រយ៉ូងធម្មតាដោយកើតជាដុំពកដំណក់ទឹក",
    "vascular fiber remnants left standing in ruptured spore mass": "សល់តែសរសៃសរសៃឈរត្រង់ក្នុងដុំម្សៅស្ព័រដែលបែក",
    "v-shaped yellowing starting from leaf tip along midrib": "ស្លឹកប្រែពណ៌លឿងរាងអក្សរ V ចាប់ពីចុងស្លឹកតាមទ្រនុង",
    "broad white or yellow bands on either side of leaf midrib": "ឆ្នូតធំៗពណ៌សឬលឿងសងខាងទ្រនុងស្លឹកពោត(White bud)",
    "severely stunted plants with shortened internodes": "ដើមពោតក្រិនខ្លាំងមានថ្នាំងខ្លីៗ",
    "lower leaves dry up and turn brown early": "ស្លឹកខាងក្រោមស្ងួតនិងប្រែពណ៌ត្នោតលឿន",
    "excessive proliferation of short thin branches at shoot apex": "ការបែកមែកខ្លីៗតូចៗច្រើនខុសប្រក្រតីនៅចុងត្រួយ(អំបោសធ្មប់)",
    "tiny narrow yellowed leaves on apical clusters": "ស្លឹកតូចៗចង្អៀតពណ៌លឿងលើកញ្ចុំត្រួយ",
    "severe stunting of plant with bushy broom-like canopy": "ដើមដំឡូងមីក្រិនខ្លាំងគុម្ពខាងលើដូចអំបោស",
    "reduced root tuber size and high fiber content": "មើមដំឡូងមីតូចៗមានសរសៃឈើច្រើន",
    "water soaked dark brown rot on stems and branch forks": "រលួយដូចជាំទឹកពណ៌ត្នោតចាស់លើដើមនិងប្រគាបមែក",
    "foul smelling brownish liquid exuding from stem lesions": "មានទឹករាវពណ៌ត្នោតក្លិនស្អុយហូរចេញពីដំបៅដើម",
    "wilting of individual branches above infection point": "មែកដំឡូងមីស្រពោនចាប់ពីកន្លែងឆ្លងឡើងលើ",
    "internal vascular browning and pith breakdown": "ប្តូរពណ៌សរសៃខាងក្នុងនិងរលួយបណ្ដូលដើម",
    "swarms of whiteflies fluttering from leaf underside when disturbed": "ហ្វូងរុយសហើរចេញពីក្រោមស្លឹកពេលមានអ្វីប៉ះពាល់",
    "dense nymph scales encrusting lower leaf surface": "កូនដង្កូវរុយសតោងជាប់ណែននៅផ្ទៃក្រោមស្លឹក",
    "sticky honeydew attracting heavy black sooty mold on canopy": "ទឹកដមស្អិតទាក់ទាញផ្សិតខ្មៅដុះយ៉ាងក្រាស់លើស្លឹក",
    "chlorotic yellow mosaic patterns on emerging young leaves": "ស្នាមមូសៃលឿងលើស្លឹកខ្ចីដែលទើបលាស់",
    "circular to angular brown spots delimited by small leaf veins": "ចំណុចមូលទៅជ្រុងៗពណ៌ត្នោតខណ្ឌដោយសរសៃស្លឹកតូចៗ",
    "yellow halo surrounding brown spots on upper leaf surface": "រង្វង់លឿងព័ទ្ធជុំវិញចំណុចត្នោតលើផ្ទៃស្លឹកខាងលើ",
    "premature defoliation of lower and middle leaves": "ស្លឹកផ្នែកក្រោមនិងកណ្តាលជ្រុះមុនពេលកំណត់",
    "spots turn dark grayish brown with velvety fungal centers": "ចំណុចប្រែពណ៌ប្រផេះត្នោតចាស់មានកណ្តាលផ្សិតរលោង",
    "round entrance holes bored in woody mature stems": "រន្ធមូលចោះចូលក្នុងដើមដំឡូងមីចាស់",
    "sawdust-like frass ejected around stem boreholes": "កាកសំណល់ដូចកម្ទេចឈើហៀរចេញជុំវិញមាត់រន្ធ",
    "branches easily snap in wind at boring sites": "មែកដំឡូងមីងាយបាក់ត្រង់កន្លែងដែលដង្កូវខួង",
    "wilting of branches above bored tunnels": "មែកផ្នែកខាងលើរូងដង្កូវស្រពោនស្វិត",

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
    "Rice Sheath Blight": "ជំងឺរលួយស្រទបស្លឹកស្រូវ",
    "Bacterial Panicle Blight": "ជំងឺខូចកួរស្រូវបាក់តេរី",
    "Brown Planthopper Hopperburn": "ការបំផ្លាញដោយមមាចត្នោតលើស្រូវ",
    "Rice False Smut": "ជំងឺផ្សិតដុំម្សៅលឿងលើកួរស្រូវ",
    "Potato Blackleg": "ជំងឺរលួយគល់ខ្មៅដំឡូងបារាំង",
    "Potato Common Scab": "ជំងឺស្រែងមើមដំឡូងបារាំង",
    "Potato Leafroll Virus": "មេរោគរមៀលស្លឹកដំឡូងបារាំង",
    "Potato Rhizoctonia Canker": "ជំងឺស្រែងខ្មៅនិងដំបៅឫសដំឡូងបារាំង",
    "Tomato Blossom End Rot": "ជំងឺរលួយគូទផ្លែប៉េងប៉ោះ",
    "Tomato Septoria Leaf Spot": "ជំងឺអុចស្លឹកសិបតូរីយ៉ាប៉េងប៉ោះ",
    "Tomato Powdery Mildew": "ជំងឺផ្សិតម្សៅប៉េងប៉ោះ",
    "Tomato Spider Mite Damage": "ការបំផ្លាញដោយពីងពាងក្រហមលើប៉េងប៉ោះ",
    "Cucumber Anthracnose": "ជំងឺអាន់ថ្រាកណូសត្រសក់",
    "Cucumber Gummy Stem Blight": "ជំងឺរលួយដើមចេញជ័រត្រសក់",
    "Cucumber Fusarium Wilt": "ជំងឺស្វិតផ្សិតហ្វូសារីយ៉ូមត្រសក់",
    "Cucumber Two-Spotted Spider Mite": "ការបំផ្លាញដោយពីងពាងពីរបំណះលើត្រសក់",
    "Chili Phytophthora Blight": "ជំងឺខូចរលួយដើមនិងផ្លែម្ទេស",
    "Chili Powdery Mildew": "ជំងឺផ្សិតម្សៅម្ទេស",
    "Chili Broad Mite Infestation": "ការបំផ្លាញដោយមៃទូលាយលើម្ទេស",
    "Chili Sunscald and Blossom Rot": "ជំងឺរលួយគូទនិងរលាកថ្ងៃលើម្ទេស",
    "Banana Anthracnose Fruit Rot": "ជំងឺអាន់ថ្រាកណូសផ្លែចេក",
    "Banana Bacterial Wilt Blood Disease": "ជំងឺស្វិតឈាមបាក់តេរីចេក",
    "Banana Black Sigatoka": "ជំងឺអុចខ្មៅស៊ីហ្គាតូកាចេក",
    "Banana Rust Thrips Damage": "ការខូចខាតដោយទ្រីបច្រែះលើចេក",
    "Corn Gray Leaf Spot": "ជំងឺអុចប្រផេះស្លឹកពោត",
    "Corn Smut": "ជំងឺផ្សិតដុំពកខ្មៅលើពោត",
    "Corn Downy Mildew": "ជំងឺផ្សិតរោមសលើពោត",
    "Corn Earworm Damage": "ការខូចខាតដោយដង្កូវស៊ីត្រយ៉ូងពោត",
    "Cassava Brown Streak Disease": "ជំងឺឆ្នូតត្នោតដំឡូងមី",
    "Cassava Anthracnose Disease": "ជំងឺអាន់ថ្រាកណូសដំឡូងមី",
    "Cassava Root Rot": "ជំងឺរលួយមើមដំឡូងមី",
    "Cassava Green Mite Damage": "ការបំផ្លាញដោយមៃបៃតងលើដំឡូងមី",
    "Rice Leaf Folder Damage": "ការខូចខាតដោយដង្កូវមូរខ្ចប់ស្លឹកស្រូវ",
    "Rice Nutrient Deficiency": "កង្វះជីជាតិលើដំណាំស្រូវ",
    "Potato Dry Rot": "ជំងឺរលួយស្ងួតមើមដំឡូងបារាំង",
    "Potato Wireworm Damage": "ការខូចខាតដោយដង្កូវលួសលើដំឡូងបារាំង",
    "Tomato Gray Mold Blight": "ជំងឺផ្សិតប្រផេះលើផ្កានិងផ្លែប៉េងប៉ោះ",
    "Tomato Anthracnose Fruit Spot": "ជំងឺអុចផ្លែអាន់ថ្រាកណូសប៉េងប៉ោះ",
    "Cucumber Scab Spot": "ជំងឺស្រែងផ្លែត្រសក់",
    "Cucumber Yellow Stunting Disorder": "ជំងឺស្លឹកលឿងក្រិនត្រសក់",
    "Chili White Mold Rot": "ជំងឺផ្សិតកប្បាសសលើដើមម្ទេស",
    "Chili Twig Dieback": "ជំងឺងាប់ចុងមែកម្ទេស",
    "Banana Crown Rot": "ជំងឺរលួយក្បាលស្ទងចេក",
    "Banana Corm Borer Weevil": "ការខូចខាតដោយដង្កូវខួងមើមចេក",
    "Corn Gibberella Ear Rot": "ជំងឺរលួយត្រយ៉ូងពណ៌ផ្កាឈូកលើពោត",
    "Corn Rootworm Damage": "ការខូចខាតឫសដោយដង្កូវឫសពោត",
    "Cassava Superelongation Disease": "ជំងឺលូតវែងខុសប្រក្រតីដំឡូងមី",
    "Cassava Nutrient Deficiency": "កង្វះជីវជាតិលើដំឡូងមី",
    "Rice Bakanae Disease": "ជំងឺកូនស្រូវលូតវែងខុសប្រក្រតី(បាកាណេ)",
    "Rice Leaf Scald": "ជំងឺរលាកគែមស្លឹកស្រូវ",
    "Rice Narrow Brown Leaf Spot": "ជំងឺអុចត្នោតឆ្នូតតូចៗលើស្លឹកស្រូវ",
    "Rice Gall Midge Damage": "ការបំផ្លាញដោយសត្វរុយពកស្រូវ",
    "Rice Caseworm Damage": "ការបំផ្លាញដោយដង្កូវកាត់ស្លឹកស្រូវធ្វើសំបុក",
    "Rice Salinity Toxicity": "ការពុលជាតិប្រៃលើដំណាំស្រូវ",
    "Rice Zinc Deficiency": "កង្វះជាតិស័ង្កសីលើដំណាំស្រូវ",
    "Potato Fusarium Dry Rot": "ជំងឺរលួយស្ងួតហ្វូសារីយ៉ូមដំឡូងបារាំង",
    "Potato Silver Scurf": "ជំងឺស្រែងប្រាក់លើស្បែកដំឡូងបារាំង",
    "Potato Leak Tuber Rot": "ជំងឺរលួយហៀរទឹកមើមដំឡូងបារាំង",
    "Potato White Grub Damage": "ការបំផ្លាញដោយដង្កូវស៊ីឫសដំឡូងបារាំង",
    "Potato Mop Top Virus": "មេរោគម៉ប់ថបដំឡូងបារាំង",
    "Potato Potassium Deficiency": "កង្វះជីប៉ូតាស្យូមលើដំឡូងបារាំង",
    "Tomato Root Knot Nematode": "ជំងឺដង្កូវពកឫសប៉េងប៉ោះ",
    "Tomato Bacterial Canker": "ជំងឺដំបៅបាក់តេរីដើមនិងផ្លែប៉េងប៉ោះ",
    "Tomato Fusarium Crown Rot": "ជំងឺរលួយគល់និងឫសហ្វូសារីយ៉ូមប៉េងប៉ោះ",
    "Tomato Tobacco Mosaic Virus": "មេរោគមូសៃថ្នាំជក់លើប៉េងប៉ោះ",
    "Tomato Whitefly Sooty Mold": "ការរាតត្បាតរុយសនិងផ្សិតខ្មៅលើប៉េងប៉ោះ",
    "Tomato Catfacing Disorder": "ជំងឺផ្លែប៉េងប៉ោះប្រេះខូចទ្រង់ទ្រាយ",
    "Cucumber Bacterial Wilt": "ជំងឺស្វិតបាក់តេរីត្រសក់",
    "Cucumber Belly Rot": "ជំងឺរលួយពោះផ្លែត្រសក់",
    "Cucumber Root Knot Nematode": "ជំងឺដង្កូវពកឫសត្រសក់",
    "Cucumber Thrips Infestation": "ការខូចខាតដោយទ្រីបលើត្រសក់",
    "Cucumber Magnesium Deficiency": "កង្វះម៉ាញ៉េស្យូមលើត្រសក់",
    "Chili Bacterial Wilt": "ជំងឺស្វិតបាក់តេរីម្ទេស",
    "Chili Root Knot Nematode": "ជំងឺដង្កូវពកឫសម្ទេស",
    "Chili Aphid Mosaic Complex": "ការរាតត្បាតអាហ្វីតនិងមេរោគមូសៃម្ទេស",
    "Chili Cercospora Leaf Spot": "ជំងឺអុចភ្នែកកង្កែបលើស្លឹកម្ទេស",
    "Chili Fruit Caterpillar Damage": "ការបំផ្លាញដោយដង្កូវចោះផ្លែម្ទេស",
    "Banana Moko Bacterial Wilt": "ជំងឺម៉ូកូបាក់តេរីចេក",
    "Banana Cordana Leaf Spot": "ជំងឺអុចស្លឹកក័រដាណាចេក",
    "Banana Nematode Toppling Disease": "ជំងឺដង្កូវរលួយឫសចេកដួលរលំ",
    "Banana Aphid Infestation": "ការរាតត្បាតសត្វល្អិតអាហ្វីតចេក",
    "Banana Potassium Deficiency": "កង្វះប៉ូតាស្យូមលើដំណាំចេក",
    "Corn Bacterial Stalk Rot": "ជំងឺរលួយដើមបាក់តេរីពោត",
    "Corn Anthracnose Leaf Blight": "ជំងឺអាន់ថ្រាកណូសស្លឹកនិងដើមពោត",
    "Corn Aphid Infestation": "ការរាតត្បាតអាហ្វីតលើពោត",
    "Corn Head Smut": "ជំងឺផ្សិតខ្មៅលើផ្កានិងត្រយ៉ូងពោត",
    "Corn Zinc Deficiency": "កង្វះស័ង្កសីលើដំណាំពោត",
    "Cassava Witches Broom Disease": "ជំងឺអំបោសធ្មប់ដំឡូងមី",
    "Cassava Bacterial Stem Rot": "ជំងឺរលួយដើមបាក់តេរីដំឡូងមី",
    "Cassava Whitefly Vector Pressure": "ការរាតត្បាតរុយសលើដំឡូងមី",
    "Cassava Brown Leaf Spot": "ជំងឺអុចត្នោតស្លឹកដំឡូងមី",
    "Cassava Stem Borer Damage": "ការបំផ្លាញដោយដង្កូវខួងដើមដំឡូងមី",

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
            "គ្រប់គ្រងសត្វល្អិតផ្ទុករោគតាមវិធានការការពារចម្រុះ។",
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

    # Check direct clean mapping first
    raw_clean = (text or "").strip().lower()
    if raw_clean in SYMPTOM_CLEAN_KH:
        return normalize_display_text(SYMPTOM_CLEAN_KH[raw_clean], lang="km")
    for s_clean, t_clean in SYMPTOM_CLEAN_KH.items():
        if norm(s_clean) == cleaned:
            return normalize_display_text(t_clean, lang="km")

    # Check normalized fallback
    for source, target in SYMPTOM_EXACT_KH_FALLBACK.items():
        if norm(source) == cleaned:
            if not has_english(target):
                return normalize_display_text(target, lang="km")
            for s_k, t_k in SYMPTOM_CLEAN_KH.items():
                if norm(s_k) == cleaned:
                    return normalize_display_text(t_k, lang="km")

    translated = f" {cleaned} "
    for source, target in SYMPTOM_EXACT_KH_FALLBACK.items():
        s_norm = norm(source)
        if s_norm:
            translated = re.sub(
                rf"\b{re.escape(s_norm)}\b",
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
    if translated == cleaned or has_english(translated):
        for s_k, t_k in SYMPTOM_CLEAN_KH.items():
            if norm(s_k) == cleaned:
                return normalize_display_text(t_k, lang="km")
        if has_english(translated):
            kh_only = re.sub(r"[a-zA-Z\(\)\/]+", "", translated).strip()
            kh_only = re.sub(r"\s+", " ", kh_only).strip()
            if kh_only:
                return normalize_display_text(kh_only, lang="km")
        return None
    return normalize_display_text(translated, lang="km")


def is_placeholder_kh(text: str | None) -> bool:
    if not text or not isinstance(text, str):
        return True
    return "?" in text or "\ufffd" in text or has_english(text)


def kh_symptom_fallback(text: str | None) -> str | None:
    cleaned = norm(text or "")
    if not cleaned:
        return None
    translated = to_kh_phrase(text) or to_kh_phrase(cleaned)
    if translated:
        return normalize_display_text(translated, lang="km")
    for s_clean, t_clean in SYMPTOM_CLEAN_KH.items():
        if norm(s_clean) == cleaned:
            return normalize_display_text(t_clean, lang="km")
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
        desc_kh = CROP_DESCRIPTION_KH.get(crop.name)
        if desc_kh and (not crop.description_kh or is_placeholder_kh(crop.description_kh)):
            changed |= set_if_changed(crop, "description_kh", normalize_display_text(desc_kh, lang="km"))
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

        cause_kh = DISEASE_CAUSE_KH.get(disease.name)
        if cause_kh and (not getattr(disease, "cause_explanation_kh", None) or is_placeholder_kh(disease.cause_explanation_kh)):
            changed |= set_if_changed(disease, "cause_explanation_kh", normalize_display_text(cause_kh, lang="km"))

        for cp in DATASET:
            for dp in cp["diseases"]:
                if dp["name"] == disease.name:
                    p_kh = PROFILES_KH[dp["kind"]]
                    if not disease.description_kh or is_placeholder_kh(disease.description_kh):
                        changed |= set_if_changed(disease, "description_kh", normalize_display_text(p_kh["description"], lang="km"))
                    if not disease.treatment_kh or is_placeholder_kh(disease.treatment_kh):
                        changed |= set_if_changed(disease, "treatment_kh", lines_to_bullets([normalize_display_text(l, lang="km") for l in p_kh["treatment"]]))
                    if not getattr(disease, "prevention_tips_kh", None) or is_placeholder_kh(disease.prevention_tips_kh):
                        changed |= set_if_changed(disease, "prevention_tips_kh", lines_to_bullets([normalize_display_text(l, lang="km") for l in p_kh["prevention"]]))

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
            candidate = to_kh_phrase(symptom.name) or kh_symptom_fallback(symptom.name)
            changed |= set_if_changed(symptom, "name_kh", candidate)
        if is_placeholder_kh(symptom.description_kh):
            changed |= set_if_changed(symptom, "description_kh", None)
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
                    d("Rice Sheath Blight", "fungal", 0.88, "Rhizoctonia solani infection in warm, humid canopy.", [
                "oval water soaked spots on leaf sheath",
                "greenish gray lesions with dark brown margins",
                "lesions snake up the sheath to leaf blade",
                "white fungal sclerotia form on lesions",
                "lodging in dense canopy",
            ], "high"),
            d("Bacterial Panicle Blight", "bacterial", 0.84, "Burkholderia glumae bacterial panicle rot during grain filling.", [
                "florets turn dark brown or black",
                "panicles remain upright due to empty grains",
                "rotting grain husks after flowering",
                "discolored grains on panicle",
            ], "high"),
            d("Brown Planthopper Hopperburn", "pest", 0.89, "Nilaparvata lugens sap-sucking hopper colonies causing field burn.", [
                "circular patches of yellowing and drying in field",
                "plants turn golden brown and dry (hopperburn)",
                "dense colonies of brown hoppers at stem base",
                "sooty mold on lower stem from honeydew",
            ], "high"),
            d("Rice False Smut", "fungal", 0.79, "Ustilaginoidea virens transforming floral ovaries into spore balls.", [
                "grains transform into velvety yellow green balls",
                "spore balls burst into greenish black powder",
                "only few grains per panicle infected",
                "reduced grain quality and weight",
            ], "medium"),
                    d("Rice Leaf Folder Damage", "pest", 0.83, "Cnaphalocrocis medinalis larvae folding leaves and scraping green tissue.", [
                "leaf edges folded and fastened with silk",
                "long white transparent streaks on damaged leaves",
                "green caterpillars feeding inside folded leaves",
                "papery bleached leaf canopy",
            ], "medium"),
            d("Rice Nutrient Deficiency", "nutrient", 0.76, "Imbalanced nitrogen or potassium supply in flooded soil.", [
                "general pale green to yellow foliage",
                "stunted tillering and reduced plant height",
                "lower leaves turn yellow and die prematurely",
                "short panicles with light grains",
            ], "medium"),
                    d("Rice Bakanae Disease", "fungal", 0.86, "Gibberella fujikuroi seed-borne elongation fungus.", [
                "seedlings grow exceptionally tall and slender",
                "pale yellow green leaves with elongated internodes",
                "adventitious roots developing on lower stem nodes",
                "whitish pink fungal coating at base of dying plants",
                "sterile panicles or empty grains on infected tillers",
            ], "high"),
            d("Rice Leaf Scald", "fungal", 0.82, "Microdochium oryzae causing chevron leaf tip blighting.", [
                "large chevron shaped zonate lesions on leaf tips",
                "alternating bands of dark brown and bleached light tan on leaves",
                "leaf tips dry out and split in wind",
                "blighting of upper leaf canopy after flowering",
            ], "medium"),
            d("Rice Narrow Brown Leaf Spot", "fungal", 0.8, "Cercospora janseana linear foliar spotting in potassium deficient soils.", [
                "short narrow linear brown spots parallel to leaf veins",
                "spots turn dark reddish brown on mature leaves",
                "premature leaf drying and canopy lodging",
                "discoloration of leaf sheaths and glumes",
            ], "medium"),
            d("Rice Gall Midge Damage", "pest", 0.85, "Orseolia oryzae larvae galling vegetative tillers.", [
                "tubular hollow onion leaf gall silver shoot",
                "suppression of panicle emergence on infested tillers",
                "excessive stunted tillering with bushy appearance",
                "spongy swollen tiller bases",
            ], "high"),
            d("Rice Caseworm Damage", "pest", 0.81, "Parapoynx stagnalis aquatic larvae scraping young rice leaves.", [
                "cut leaf tips floating on water surface",
                "ladder like transparent patches eaten on leaf blade",
                "leaf tubes cases attached to rice stems near water level",
                "defoliation of young transplanted seedlings",
            ], "medium"),
            d("Rice Salinity Toxicity", "nutrient", 0.78, "Saline water intrusion and root osmotic stress.", [
                "orange brown scorching and drying of leaf margins",
                "roots turn dark brown or black with foul sulfur odor",
                "stunted hill growth with poor root penetration",
                "uneven patchy growth across depression areas in field",
            ], "high"),
            d("Rice Zinc Deficiency", "nutrient", 0.77, "Zinc immobilization in continuously submerged neutral-alkaline soils.", [
                "brown rusty blotches appearing on middle leaves",
                "slow tillering with narrow erect dark green leaves",
                "delayed maturity by several weeks",
                "leaf midrib chlorosis near base of young leaves",
            ], "medium"),
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
                    d("Potato Blackleg", "bacterial", 0.86, "Pectobacterium infection causing vascular and tuber soft decay.", [
                "black inky slimy rot at stem base",
                "foul smelling decaying mother tuber",
                "stunted pale yellow upright foliage",
                "hollow and darkened lower stem",
            ], "high"),
            d("Potato Common Scab", "bacterial", 0.78, "Streptomyces scabies causing rough corky skin eruptions.", [
                "corky raised lesions on tuber skin",
                "rough pitted scabs on potato surface",
                "superficial brown skin fissures on tubers",
                "tubers have unmarketable appearance",
            ], "medium"),
            d("Potato Leafroll Virus", "viral", 0.83, "Aphid-transmitted Polerovirus causing phloem necrosis.", [
                "upward rolling and leathery thickening of leaves",
                "papery rattling sound when foliage is brushed",
                "net necrosis inside tuber flesh",
                "stunted upright growth habit",
            ], "high"),
            d("Potato Rhizoctonia Canker", "fungal", 0.8, "Rhizoctonia solani causing stem cankers and black scurf on tubers.", [
                "hard black dirt like sclerotia on tuber skin",
                "brown sunken cankers on underground stems",
                "aerial tubers forming in leaf axils",
                "stunted growth with purplish top leaves",
            ], "medium"),
                    d("Potato Dry Rot", "fungal", 0.82, "Fusarium sambucinum tuber rot during storage and seed handling.", [
                "wrinkled sunken brown rot on tuber surface",
                "internal cavities lined with white or blue-pink mold",
                "tuber becomes light, dry and shriveled like stone",
            ], "medium"),
            d("Potato Wireworm Damage", "pest", 0.79, "Agriotes click beetle larvae boring into roots and tubers.", [
                "narrow round puncture holes bored into tubers",
                "dark tunnels bored through potato flesh",
                "wilted young plants severed beneath soil line",
            ], "medium"),
                    d("Potato Fusarium Dry Rot", "fungal", 0.83, "Fusarium species causing tuber dry rot during storage and postharvest.", [
                "sunken brown rot with concentric skin wrinkles on tubers",
                "white yellow fungal tufts in internal tuber cavities",
                "tuber flesh collapses into dry powdery dry rot",
                "yellowing and wilting of lower vines",
            ], "medium"),
            d("Potato Silver Scurf", "fungal", 0.78, "Helminthosporium solani blemish disease on tuber periderm.", [
                "silvery glistening sheen patches on washed tuber skin",
                "loss of skin moisture causing tuber shrinkage in storage",
                "dark brown smudgy lesions with indistinct margins on skin",
                "slight flakiness of tuber periderm",
            ], "low"),
            d("Potato Leak Tuber Rot", "fungal", 0.85, "Pythium ultimum water mold infecting tubers through harvest wounds.", [
                "internal water soaked rot exuding brownish watery liquid",
                "tuber skin remains intact while flesh liquefies inside",
                "decayed flesh turns dark brown to black when exposed to air",
                "rotting tubers in warm moist harvest conditions",
            ], "high"),
            d("Potato White Grub Damage", "pest", 0.82, "Scarabaeid beetle larvae chewing roots and gouging potato tubers.", [
                "young potato stems clipped cleanly at soil surface",
                "deep irregular gouge holes eaten into maturing tubers",
                "wilting of healthy looking plants due to severed feeder roots",
                "fat white c-shaped grubs discovered in soil ridge",
            ], "high"),
            d("Potato Mop Top Virus", "viral", 0.8, "Spongospora subterranea transmitted Pomovirus causing spraing in tubers.", [
                "concentric brown necrotic rings and arcs in tuber flesh",
                "bright yellow chevron or v-shaped markings on leaves",
                "shortened internodes causing bunchy top foliage",
                "cracked and deformed harvest tubers",
            ], "high"),
            d("Potato Potassium Deficiency", "nutrient", 0.76, "Potassium deficiency causing foliar marginal scorch and small tubers.", [
                "marginal leaf scorch and bronze curling on older leaves",
                "uniform chlorosis of lower foliage progressing upward",
                "leaves become dull dark green with necrotic edges",
                "premature vine death and small tubers",
            ], "medium"),
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
                    d("Tomato Blossom End Rot", "nutrient", 0.85, "Localized calcium deficiency combined with irregular watering.", [
                "water soaked dark sunken spot at blossom end of fruit",
                "leathery black depression on bottom of fruit",
                "fruit ripens prematurely with flat black bottom",
                "calcium deficiency symptoms during dry spell",
            ], "medium"),
            d("Tomato Septoria Leaf Spot", "fungal", 0.82, "Septoria lycopersici causing dense lower foliage spotting.", [
                "numerous small circular spots with gray center and dark border",
                "tiny black specks inside leaf spots",
                "severe lower leaf yellowing and shedding",
                "foliage loss exposes fruits to sunscald",
            ], "medium"),
            d("Tomato Powdery Mildew", "fungal", 0.81, "Oidium / Leveillula fungal coating on tomato foliage.", [
                "white powdery patches on upper leaf surface",
                "bright yellow chlorotic spots opposite powdery patches",
                "leaves curl inward and scorch",
                "premature foliage drying in dry seasons",
            ], "medium"),
            d("Tomato Spider Mite Damage", "pest", 0.79, "Tetranychus urticae colonies feeding on sap under dry warm weather.", [
                "fine yellow stippling and speckled foliage",
                "delicate silken webbing on shoot tips and under leaves",
                "bronzed or bleached dried leaves",
                "tiny red mites crawling on leaf underside",
            ], "medium"),
                    d("Tomato Gray Mold Blight", "fungal", 0.84, "Botrytis cinerea infection in humid greenhouse and field beds.", [
                "fuzzy grayish brown mold on flowers and fruit stems",
                "pale water-soaked spots on green fruit (ghost spots)",
                "soft rot of flowers causing heavy flower drop",
            ], "high"),
            d("Tomato Anthracnose Fruit Spot", "fungal", 0.81, "Colletotrichum coccodes circular rot on ripe fruit.", [
                "sunken water-soaked circular lesions on ripe fruit",
                "concentric rings of salmon pink spores on fruit",
                "soft rotting depressions on ripe tomatoes",
            ], "medium"),
                    d("Tomato Root Knot Nematode", "pest", 0.87, "Meloidogyne incognita microscopic root endoparasites.", [
                "swollen galls and knotty beads on entire root system",
                "stunted yellowing plants with poor nutrient uptake",
                "midday temporary wilting with slow evening recovery",
                "sparse flowering and drastically reduced fruit yield",
                "shallow distorted root branching",
            ], "high"),
            d("Tomato Bacterial Canker", "bacterial", 0.86, "Clavibacter michiganensis systemic bacterial vascular infection.", [
                "brown necrotic streaks and open cankers on stems",
                "small white blister spots with dark centers on fruit",
                "marginal leaf scorch with white yellow halo",
                "yellowish pith breakdown inside split stem",
            ], "high"),
            d("Tomato Fusarium Crown Rot", "fungal", 0.83, "Fusarium oxysporum f. sp. radicis-lycopersici root collar decay.", [
                "dark brown rot on taproot and main root crown",
                "chocolate brown vascular discoloration limited to lower stem",
                "yellowing of lower leaves progressing slowly upward",
                "gradual wilting and collapse of mature fruiting vines",
            ], "high"),
            d("Tomato Tobacco Mosaic Virus", "viral", 0.84, "Tobamovirus mechanically transmitted through contact and tools.", [
                "blistered dark green and light green mosaic on leaves",
                "fern leaf symptom with extremely narrow distorted leaflets",
                "internal brown browning of fruit wall",
                "uneven ripening with mottled yellow green patches on fruit",
            ], "high"),
            d("Tomato Whitefly Sooty Mold", "pest", 0.82, "Bemisia tabaci whitefly colonies producing honeydew.", [
                "clouds of small white insects flying when canopy is shaken",
                "thick sticky shiny honeydew covering foliage",
                "black soot like mold layer blocking sunlight on leaves",
                "premature leaf yellowing and dropping",
            ], "medium"),
            d("Tomato Catfacing Disorder", "nutrient", 0.77, "Cold temperatures during floral initiation causing carpel malformation.", [
                "deep scars, crevices, and convolutions at blossom end of fruit",
                "large leathery bleached white patches on sun exposed fruit shoulder",
                "fruit cracking in concentric rings around stem scar",
                "pulp breakdown beneath sunburnt fruit surface",
            ], "medium"),
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
                    d("Cucumber Anthracnose", "fungal", 0.85, "Colletotrichum orbiculare foliar and fruit rot after rainfall.", [
                "circular water soaked brown spots on leaves",
                "shot hole effect with dried spot centers falling out",
                "sunken circular dark lesions on cucumber fruit",
                "pinkish salmon gelatinous spore masses on fruit lesions",
            ], "high"),
            d("Cucumber Gummy Stem Blight", "fungal", 0.83, "Stagonosporopsis cucurbitacearum causing vine blight and amber ooze.", [
                "tan water soaked lesions with dark brown borders on leaves",
                "gummy amber colored exudate oozing from stem cracks",
                "tiny black fruiting dots on bleached stem lesions",
                "collar rot causing sudden vine collapse",
            ], "high"),
            d("Cucumber Fusarium Wilt", "fungal", 0.84, "Fusarium oxysporum f. sp. cucumerinum vascular root infection.", [
                "progressive one sided wilting of runner vines",
                "yellowing of leaves starting near crown",
                "brown discoloration in vascular ring of taproot",
                "sticky white pink fungal mycelium at vine base",
            ], "high"),
            d("Cucumber Two-Spotted Spider Mite", "pest", 0.78, "Two-spotted spider mites feeding on cucurbit foliage under hot dry conditions.", [
                "dense fine webbing covering shoot tips and flowers",
                "pale yellow stippling and bronzed foliage",
                "crinkled dried leaves dropping off prematurely",
                "stunted vines with bitter small fruits",
            ], "medium"),
                    d("Cucumber Scab Spot", "fungal", 0.8, "Cladosporium cucumerinum crater-like lesions on fruit and leaves.", [
                "water-soaked sunken spots on fruit exuding amber gum",
                "crater-like scabs with olive-green velvety mold on fruit",
                "ragged angular holes in young leaves",
            ], "medium"),
            d("Cucumber Yellow Stunting Disorder", "viral", 0.83, "Whitefly-transmitted Crinivirus causing interveinal yellowing.", [
                "bright yellow chlorotic mottling on mature leaves",
                "green veins contrasting with yellow blade",
                "thickened brittle leaves rolling downward",
            ], "high"),
                    d("Cucumber Bacterial Wilt", "bacterial", 0.87, "Erwinia tracheiphila vascular bacterium transmitted by cucumber beetles.", [
                "individual leaves wilt during hot day, recover at night, then wilt permanently",
                "viscous white bacterial strands stringing when cut stem ends are pulled apart",
                "dull dark green color of wilted foliage without initial yellowing",
                "cucumber beetles feeding on foliage in field",
            ], "high"),
            d("Cucumber Belly Rot", "fungal", 0.81, "Rhizoctonia solani soil-contact fruit decay in wet beds.", [
                "water-soaked yellow brown sunken lesions on underside of fruit touching soil",
                "crusty brown rot on fruit side resting on wet ground",
                "brown webbing and fungal threads clinging to rotted fruit rind",
                "decayed fruit becomes soft, watery and unmarketable",
            ], "medium"),
            d("Cucumber Root Knot Nematode", "pest", 0.84, "Meloidogyne species causing root galling on cucurbits.", [
                "heavy bead-like galls on roots causing clubbed appearance",
                "stunted vines with pale green to yellowish foliage",
                "flaccid wilting during sunny afternoons",
                "reduced vine length and aborted female flowers",
            ], "high"),
            d("Cucumber Thrips Infestation", "pest", 0.8, "Thrips palmi rasping sap-sucking feeding on foliage and small fruits.", [
                "curled downward leaf margins with crinkled puckered blade",
                "silvery flecks and bronze discoloration on leaf underside",
                "distorted hooked cucumbers with pale yellow streaks",
                "black sooty mold coating on leaves from insect honeydew",
            ], "medium"),
            d("Cucumber Magnesium Deficiency", "nutrient", 0.76, "Magnesium deficiency in sandy leached soils under heavy fruit load.", [
                "interveinal chlorosis on older leaves with green veins remaining",
                "yellowing and scorch along outer leaf perimeter",
                "tapered pointed stem end of cucumber fruits",
                "brittle leaves that shatter when handled",
            ], "medium"),
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
                    d("Chili Phytophthora Blight", "fungal", 0.87, "Phytophthora capsici crown and fruit rot under saturated soil.", [
                "dark brown to black water soaked lesions at stem base",
                "rapid wilting of entire green plant without leaf yellowing",
                "constriction and girdling of lower stem near soil",
                "white mold growth on dark fruit lesions after rain",
            ], "high"),
            d("Chili Powdery Mildew", "fungal", 0.81, "Leveillula taurica endophytic powdery mildew on solanaceous crops.", [
                "white powdery fungal coating on leaf underside",
                "bright yellow chlorotic patches on upper leaf surface",
                "severe upward curling and premature leaf shedding",
                "bare branches with few exposed sunburnt fruits",
            ], "medium"),
            d("Chili Broad Mite Infestation", "pest", 0.82, "Polyphagotarsonemus latus feeding on chili growing tips and flower buds.", [
                "downward curling and cupping of young leaves",
                "brittle and leathery leaf texture with glossy sheen",
                "bronzed and distorted growing tips",
                "cracked and corky fruit skin",
            ], "high"),
            d("Chili Sunscald and Blossom Rot", "nutrient", 0.77, "Sunscald damage compounded by moisture fluctuations and calcium transport stress.", [
                "bleached papery white patches on fruit side exposed to sun",
                "water soaked sunken spot at blossom end of chili",
                "soft secondary rot on sunburnt fruit tissue",
                "misshapen bent pods with dry tip",
            ], "medium"),
                    d("Chili White Mold Rot", "fungal", 0.84, "Sclerotinia sclerotiorum white cottony stem rot.", [
                "water-soaked lesions on stems near soil line",
                "cottony fluffy white mold covering infected branches",
                "large hard black sclerotia inside hollow stems",
                "sudden wilting and branch collapse",
            ], "high"),
            d("Chili Twig Dieback", "fungal", 0.79, "Colletotrichum / Phomopsis branch necrosis progressing from shoot tips.", [
                "tip dieback of branches turning brown to black",
                "sunken dark lesions along stems and twigs",
                "shriveled brown leaves clinging to dead branches",
            ], "medium"),
                    d("Chili Bacterial Wilt", "bacterial", 0.88, "Ralstonia solanacearum vascular xylem wilt.", [
                "rapid daytime wilting of entire green canopy with no prior yellowing",
                "leaves remain green while hanging limp and dry on branches",
                "dark brown vascular discoloration in lower stem xylem",
                "milky white bacterial streaming in water glass test",
            ], "high"),
            d("Chili Root Knot Nematode", "pest", 0.83, "Meloidogyne root galling causing stunting and nutrient block.", [
                "swollen irregular galls and knots on feeder roots",
                "chlorotic pale yellow stunted bushy plants",
                "premature flower drop and small unmarketable chili pods",
                "wilting of branches during dry sunny periods",
            ], "high"),
            d("Chili Aphid Mosaic Complex", "viral", 0.82, "Potyvirus complex transmitted by Aphis gossypii.", [
                "dense clusters of green and black aphids under tender leaves",
                "distorted wrinkled leaves with blistered yellow green mosaic",
                "sticky honeydew attracting black sooty mold on foliage",
                "stunted bushy growth with shortened internodes",
            ], "high"),
            d("Chili Cercospora Leaf Spot", "fungal", 0.8, "Cercospora capsici frogeye spotting causing extensive defoliation.", [
                "circular spots with bleached white center and prominent dark brown ring",
                "frogeye like spots scattered across upper leaves",
                "severe defoliation leaving bare twigs with hanging fruits",
                "cankers on fruit stalks causing premature pod drop",
            ], "medium"),
            d("Chili Fruit Caterpillar Damage", "pest", 0.81, "Spodoptera / Helicoverpa larvae boring into developing chili pods.", [
                "neat circular entry holes bored into chili pods",
                "frass pellets pushed out of fruit borehole",
                "watery decay and internal rotting of chili core",
                "damaged chili pods turn pale yellow and drop early",
            ], "medium"),
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
                    d("Banana Anthracnose Fruit Rot", "fungal", 0.83, "Colletotrichum musae fruit rot on maturing banana fingers.", [
                "black sunken spots on banana peel",
                "orange to salmon pink spore masses on ripening fruit",
                "fruit finger rot causing premature dropping",
                "peel blemishes reducing market quality",
            ], "medium"),
            d("Banana Bacterial Wilt Blood Disease", "bacterial", 0.87, "Ralstonia / Blood disease bacterium vascular infection.", [
                "wilting and yellowing of inner young leaves",
                "reddish brown internal vascular discoloration in pseudostem",
                "bacterial ooze droplets from cut flower stalk",
                "fruit flesh with dry reddish brown rot pockets",
            ], "high"),
            d("Banana Black Sigatoka", "fungal", 0.89, "Pseudocercospora fijiensis causing destructive foliar leaf necrosis.", [
                "dark reddish brown rusty streaks on underside of leaf",
                "sunken black elliptical spots with gray dry center",
                "rapid blighting and burning of mature leaves",
                "premature fruit ripening on the plant",
            ], "high"),
            d("Banana Rust Thrips Damage", "pest", 0.79, "Chaetanaphothrips signipennis rust staining on banana peel.", [
                "rusty reddish brown stains along fruit peel ridges",
                "rough sandpapery texture on fruit skin",
                "cracking of banana fruit peel during filling",
                "tiny yellow insects in flower bracts",
            ], "medium"),
                    d("Banana Crown Rot", "fungal", 0.81, "Colletotrichum and Fusarium complex decaying cushion tissue.", [
                "blackening and rotting of fruit crown tissues",
                "white or gray fungal mold on severed hand cushions",
                "fruit fingers separating and dropping from crown",
            ], "medium"),
            d("Banana Corm Borer Weevil", "pest", 0.86, "Cosmopolites sordidus larvae tunneling in underground corm.", [
                "larval tunnels riddling root corm and bulb",
                "jelly-like sap exudation from base of plant",
                "yellowing and dying of outer leaf canopy",
                "plants easily pushed over by hand",
            ], "high"),
                    d("Banana Moko Bacterial Wilt", "bacterial", 0.88, "Ralstonia solanacearum race 2 bacterial wilt transmitted by insects and machetes.", [
                "yellowing and breakdown of petiole near stem on young leaves",
                "central leaves break and collapse like an umbrella",
                "brown to black vascular bundles inside cut pseudostem",
                "internal dark dry rotting of fruit pulp with premature yellowing",
            ], "high"),
            d("Banana Cordana Leaf Spot", "fungal", 0.8, "Cordana musae large oval leaf spotting.", [
                "large oval to diamond shaped lesions with zigzag yellow borders",
                "grayish brown concentric zones within leaf spots",
                "lesions coalesce causing large blighted leaf sections",
                "drying and shredding of older leaf blades",
            ], "medium"),
            d("Banana Nematode Toppling Disease", "pest", 0.87, "Radopholus similis burrowing nematode decaying anchor roots.", [
                "reddish purple to black lesions on primary cord roots",
                "extensive rotting and death of anchor root system",
                "entire mature banana mat uproots and topples in light wind",
                "small stunted bunches with thin fingers",
            ], "high"),
            d("Banana Aphid Infestation", "pest", 0.82, "Pentalonia nigronervosa aphid colonies transmitting bunchy top virus.", [
                "dense colonies of dark brown aphids around pseudostem base and throat",
                "aphids hidden under leaf sheaths and beneath bracts",
                "sticky honeydew secretion with black sooty mold coating",
                "vector transmitting bunchy top virus symptoms",
            ], "high"),
            d("Banana Potassium Deficiency", "nutrient", 0.78, "Severe potassium depletion under rapid fruit filling demand.", [
                "rapid yellowing and orange necrosis of leaf margins curling inward",
                "premature drying and folding of older leaf canopy",
                "slender weak pseudostems that buckle under bunch weight",
                "small poorly filled banana fingers with brittle skin",
            ], "medium"),
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
                    d("Corn Gray Leaf Spot", "fungal", 0.83, "Cercospora zeae-maydis causing rectangular interveinal blights.", [
                "rectangular narrow tan lesions delimited by leaf veins",
                "blighted and prematurely dried lower leaves",
                "lesions turn grayish brown under high humidity",
                "severe leaf loss during grain filling stage",
            ], "medium"),
            d("Corn Smut", "fungal", 0.85, "Ustilago maydis gall formation on ears, tassels, and stalks.", [
                "large swollen spongy galls on ears tassels or stalk",
                "galls rupture revealing powdery black spore masses",
                "distorted and malformed corn ears",
                "stunted plants with abnormal tassel growth",
            ], "medium"),
            d("Corn Downy Mildew", "fungal", 0.84, "Peronosclerospora species causing systemic chlorotic striping.", [
                "chlorotic yellow white striping from leaf base to tip",
                "downy white fungal growth on leaf underside in morning",
                "crazy top symptom with leafy tassel proliferation",
                "stunted plants with barren ears or poor seed set",
            ], "high"),
            d("Corn Earworm Damage", "pest", 0.82, "Helicoverpa zea larvae feeding on silks and ear kernels.", [
                "chewed corn silks preventing pollination",
                "entry holes and tunneling at the tip of corn ear",
                "frass and kernel damage at ear tip",
                "secondary mold infection inside corn husk",
            ], "medium"),
                    d("Corn Gibberella Ear Rot", "fungal", 0.83, "Fusarium graminearum pink ear rot under cool wet conditions.", [
                "reddish pink mold growing from ear tip downward",
                "husks tightly glued to ear by fungal mycelium",
                "brittle kernels covered in pinkish white mycelium",
            ], "high"),
            d("Corn Rootworm Damage", "pest", 0.81, "Diabrotica larvae feeding on root nodes causing stalk goosenecking.", [
                "goosenecking and curved stalks at base (lodging)",
                "roots pruned back to stalk node",
                "poor root anchoring in windy weather",
            ], "medium"),
                    d("Corn Bacterial Stalk Rot", "bacterial", 0.85, "Dickeya zeae / Pectobacterium soft rotting bacterium under flooded warm conditions.", [
                "dark water soaked soft rot on middle stalk internodes",
                "foul fermenting odor emitted from decaying stalk",
                "stalk collapses and twists at rot point while top leaves remain green",
                "slime and bacterial decay in inner nodal tissue",
            ], "high"),
            d("Corn Anthracnose Leaf Blight", "fungal", 0.82, "Colletotrichum graminicola causing leaf blight and stalk rot.", [
                "oval to spindle shaped tan leaf spots with dark reddish borders",
                "shiny black streaks and spots on outer stalk surface",
                "top dieback symptom with upper leaves dying prematurely",
                "black rotted pith inside lower stalk causing late lodging",
            ], "medium"),
            d("Corn Aphid Infestation", "pest", 0.8, "Rhopalosiphum maidis corn leaf aphids infesting whorl and tassels.", [
                "dense clusters of bluish green aphids inside whorl and on tassels",
                "tassels and silks coated in sticky glistening honeydew",
                "black sooty mold covering ear husks and leaves",
                "interfered pollination resulting in incomplete ear kernel fill",
            ], "medium"),
            d("Corn Head Smut", "fungal", 0.86, "Sphacelotheca reiliana systemic floral smut fungus.", [
                "entire ear or tassel converted into mass of powdery black spores",
                "tassel proliferation into leafy vegetative structures",
                "absence of normal ear development with floral teardrop galls",
                "vascular fiber remnants left standing in ruptured spore mass",
            ], "high"),
            d("Corn Zinc Deficiency", "nutrient", 0.77, "Zinc deficiency in high pH or high phosphorus soils.", [
                "v-shaped yellowing starting from leaf tip along midrib",
                "broad white or yellow bands on either side of leaf midrib",
                "severely stunted plants with shortened internodes",
                "lower leaves dry up and turn brown early",
            ], "medium"),
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
                    d("Cassava Brown Streak Disease", "viral", 0.88, "Ipomovirus causing feathery chlorosis and tuberous root necrosis.", [
                "feathery yellow chlorosis along secondary leaf veins",
                "brown necrotic streaks on green stem bark",
                "radial constriction and dark brown corky dry rot in root flesh",
                "unusable woody root tubers at harvest",
            ], "high"),
            d("Cassava Anthracnose Disease", "fungal", 0.81, "Colletotrichum gloeosporioides causing stem cankers and branch dieback.", [
                "cankers and lesions on green stems and petiole axils",
                "tip dieback and wilting of young shoot branches",
                "deep cracks and gum exudation on mature stems",
                "weak brittle stems easily snapping in wind",
            ], "medium"),
            d("Cassava Root Rot", "fungal", 0.85, "Soil-borne Phytophthora and Fusarium waterlogged root rot.", [
                "foul smelling soft watery rot of storage roots",
                "root skin sloughs off easily revealing decayed pulp",
                "wilting and yellowing of canopy despite moist soil",
                "complete collapse of tuberous root system",
            ], "high"),
            d("Cassava Green Mite Damage", "pest", 0.79, "Mononychellus tanajoa mite feeding on tender apical foliage.", [
                "pinpoint yellow chlorotic spots on young apical leaves",
                "bronzed and stunted growing shoot tip",
                "leaf drop from top of plant leaving candle stick appearance",
                "reduced canopy density and root yield",
            ], "medium"),
                    d("Cassava Superelongation Disease", "fungal", 0.82, "Sphaceloma manihoticola causing gibberellin-driven shoot stretching.", [
                "abnormal elongation of young internodes",
                "cankers on leaf veins and petioles",
                "distorted curled leaves with necrotic spots",
                "fragile spindly stems",
            ], "medium"),
            d("Cassava Nutrient Deficiency", "nutrient", 0.77, "Magnesium and potassium depletion in sandy acidic soils.", [
                "interveinal yellowing with prominent green veins",
                "purplish red tint on older leaf margins",
                "stunted umbrella-like canopy",
            ], "medium"),
                    d("Cassava Witches Broom Disease", "viral", 0.85, "Phytoplasma systemic infection causing proliferation of shoots.", [
                "excessive proliferation of short thin branches at shoot apex",
                "tiny narrow yellowed leaves on apical clusters",
                "severe stunting of plant with bushy broom-like canopy",
                "reduced root tuber size and high fiber content",
            ], "high"),
            d("Cassava Bacterial Stem Rot", "bacterial", 0.83, "Pectobacterium carotovorum stem and pith rot.", [
                "water soaked dark brown rot on stems and branch forks",
                "foul smelling brownish liquid exuding from stem lesions",
                "wilting of individual branches above infection point",
                "internal vascular browning and pith breakdown",
            ], "high"),
            d("Cassava Whitefly Vector Pressure", "pest", 0.82, "High population density of Bemisia tabaci vectoring viruses.", [
                "swarms of whiteflies fluttering from leaf underside when disturbed",
                "dense nymph scales encrusting lower leaf surface",
                "sticky honeydew attracting heavy black sooty mold on canopy",
                "chlorotic yellow mosaic patterns on emerging young leaves",
            ], "medium"),
            d("Cassava Brown Leaf Spot", "fungal", 0.79, "Passalora henningsii brown leaf spotting in humid canopy.", [
                "circular to angular brown spots delimited by small leaf veins",
                "yellow halo surrounding brown spots on upper leaf surface",
                "premature defoliation of lower and middle leaves",
                "spots turn dark grayish brown with velvety fungal centers",
            ], "low"),
            d("Cassava Stem Borer Damage", "pest", 0.81, "Coleopterous stem borer larvae tunneling in woody cassava stems.", [
                "round entrance holes bored in woody mature stems",
                "sawdust-like frass ejected around stem boreholes",
                "branches easily snap in wind at boring sites",
                "wilting of branches above bored tunnels",
            ], "medium"),
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
        crop_desc_kh = CROP_DESCRIPTION_KH.get(crop_name)
        if crop_desc_kh:
            crop_changed |= set_if_changed(crop, "description_kh", normalize_display_text(crop_desc_kh, lang="km"))
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
            profile_prevention_kh = [
                normalize_display_text(line, lang="km")
                for line in profile_kh["prevention"]
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
            cause_kh = DISEASE_CAUSE_KH.get(disease_name)
            if cause_kh:
                changed |= set_if_changed(disease, "cause_explanation_kh", normalize_display_text(cause_kh, lang="km"))
            changed |= set_if_changed(disease, "treatment", lines_to_bullets(profile["treatment"]))
            changed |= set_if_changed(disease, "treatment_kh", lines_to_bullets(profile_treatment_kh))
            changed |= set_if_changed(disease, "prevention_tips", lines_to_bullets(profile["prevention"]))
            changed |= set_if_changed(disease, "prevention_tips_kh", lines_to_bullets(profile_prevention_kh))
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
                symptom_name_kh = to_kh_phrase(symptom_name) or kh_symptom_fallback(symptom_name)
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
