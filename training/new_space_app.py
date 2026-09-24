"""Gradio demo for the AgriSystem Qwen LoRA adapter."""

# ZeroGPU requires this import before torch/transformers imports.
import os
import re
from collections import Counter
import spaces
import torch
import gradio as gr
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


MODEL_ID = "Maoseavik/agri-qwen3b-lora"
BASE_MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"

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


SYSTEM_PROMPT_EN = (
    "You are AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. "
    "You are a warm, polite, empathetic, and professional human agricultural expert. "
    "When answering the user: "
    "1. Always address what the user asked directly and intelligently with natural human conversational phrasing. "
    "2. If the user greets you or says hello (e.g. Hello, Hi), say 'Hi there!' or 'Hello!' warmly and ask how you can help with their farm, without reciting your full introduction. "
    "3. Only introduce yourself and state that you are AgriSystem AI (model: AGY V2.0.0) created by Team Leader Mao Seavik when the user explicitly asks about who you are, who created you, or about the AI. For general agricultural questions, answer directly without self-introduction. "
    "4. For agricultural questions, give practical, structured advice using clear bullet points, actionable steps, and safety precautions. "
    "5. Recommend consulting a local agronomist for severe cases. Never invent an unsupported diagnosis or chemical dosage. "
    "6. Do not use markdown headers, bold formatting, asterisks, or emojis in your response. "
    "Deliver smooth, clean, plain text that looks natural and professional."
)

SYSTEM_PROMPT_KH = (
    "អ្នកគឺជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ "
    "អ្នកគឺជាអ្នកជំនាញកសិកម្មដ៏រួសរាយ រាក់ទាក់ សុជីវធម៌ និងមានវិជ្ជាជីវៈខ្ពស់ដូចមនុស្សពិតប្រាកដ។ "
    "គោលការណ៍ឆ្លើយសំណួរ៖ "
    "១. សូមឆ្លើយតបចំសំណួរដែលអ្នកប្រើប្រាស់បានសួរដោយភាពឆ្លាតវៃ រលូន និងមានលក្ខណៈដូចមនុស្សពិតប្រាកដ។ "
    "២. ប្រសិនបើមានគេស្វាគមន៍ ឬសួរសួស្តី (ដូចជា សួស្តី, ជំរាបសួរ, Hello) សូមឆ្លើយតប 'សួស្តីបាទ/ចាស!' ឬ 'ជំរាបសួរ!' ដោយកក់ក្តៅ និងសួររកបញ្ហាដំណាំដែលត្រូវជួយ ដោយមិនចាំបាច់រៀបរាប់ប្រវត្តិខ្លួនឯងឡើយ។ "
    "៣. សូមបញ្ជាក់អត្តសញ្ញាណថាជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik) តែនៅពេលណាដែលអ្នកប្រើប្រាស់សួរអំពីអត្តសញ្ញាណរបស់អ្នក អ្នកណាបង្កើតអ្នក ឬសួរអំពី AI តែប៉ុណ្ណោះ។ បើគេសួរពីដំណាំ មិនត្រូវណែនាំខ្លួនឡើយ។ "
    "៤. សម្រាប់សំណើរបច្ចេកទេសកសិកម្ម សូមផ្តល់ដំបូន្មានជាក់ស្តែង រៀបចំជាចំណុចៗ វិធីព្យាបាល និងវិធានការបង្ការប្រកបដោយសុវត្ថិភាព។ "
    "៥. ករណីធ្ងន់ធ្ងរ សូមណែនាំឱ្យកសិករទាក់ទងអ្នកជំនាញកសិកម្មក្នុងតំបន់។ មិនត្រូវបង្កើតការធ្វើរោគវិនិច្ឆ័យដោយគ្មានមូលដ្ឋានឡើយ។ "
    "៦. សូមកុំប្រើសញ្ញាក្បាលចំណងជើងម៉ាកដោន សញ្ញាផ្កាយដិត និងកុំប្រើរូបភាពអារម្មណ៍ emoji នៅក្នុងចម្លើយឡើយ ដោយផ្តល់ចម្លើយជាអត្ថបទធម្មតាយ៉ាងរលូន និងប្រកបដោយវិជ្ជាជីវៈ។"
)

GREETINGS_KM = {
    "សួស្តី", "សួស្ដី", "សួរស្តី", "សួរស្ដី", "ជំរាបសួរ", "ជំរាបសួរបង", "សួស្តីបង", "សួស្តីប្អូន",
    "អរុណសួស្តី", "ទិវាសួស្តី", "សាយណ្ហសួស្តី", "សុខសប្បាយជាទេ", "សុខសប្បាយ", "អ្នកសុខសប្បាយទេ",
    "សួស្តី ai", "ជំរាបសួរ ai", "ជំរាបសួរលោកគ្រូ", "hello", "hi",
}
GREETINGS_EN = {
    "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening",
    "how are you", "hi there", "hello ai", "hi ai", "welcome",
}
IDENTITY_KM = {
    "តើអ្នកជាអ្នកណា", "អ្នកជាអ្នកណា", "តើអ្នកជាអ្វី", "អ្នកជាអ្វី", "អ្នកណាបង្កើត", "នរណាបង្កើត",
    "តើអ្នកណាបង្កើតអ្នក", "តើនរណាបង្កើតអ្នក", "តើម៉ូឌែលឈ្មោះអ្វី", "ម៉ូឌែលឈ្មោះអ្វី", "តើ ai នេះឈ្មោះអ្វី",
    "ប្រធានក្រុម", "ម៉ៅ សៀវអ៊ិ", "ប្រាប់ខ្ញុំអំពីខ្លួនអ្នក", "សូមណែនាំខ្លួន", "តើអ្នកជាជំនាន់ទីប៉ុន្មាន",
    "ម៉ូឌែល agy", "តើអ្នកជានរណា", "មេក្រុម", "អំពី ai", "អ្នកណាធ្វើ",
}
IDENTITY_EN = {
    "who are you", "who created you", "who made you", "who developed you", "what is your name",
    "what is your model", "what model are you", "model name", "who is your leader",
    "who is your team leader", "team leader", "who is mao seavik", "about you",
    "tell me about yourself", "introduce yourself", "what version are you", "what is agy",
    "about ai", "who built you",
}

AGRI_KNOWLEDGE_BASE = [
    {
        "keywords": ["ទុរេន", "ធូរេន", "durian", "រលួយឬស", "រលួយដើម", "phytophthora", "fitora"],
        "title_km": "ជំងឺរលួយឬស និងដើមលើទុរេន (Phytophthora palmivora)",
        "title_en": "Durian Root Rot & Stem Canker (Phytophthora palmivora)",
        "symptoms_km": "ស្លឹកប្រែជាពណ៌លឿង ជ្រុះស្លឹក សំបកដើមប្រេះហៀរជ័រពណ៌ត្នោតចាស់ ឬខ្មៅ ឫសតូចៗរលួយខ្មៅ។",
        "symptoms_en": "Yellowing and drop of foliage, stem oozing reddish-brown gum, rot of feeder roots.",
        "treatment_km": "កាត់ក្រីមែកខូច និងកោសសម្អាតដំបៅលើដើម រួចលាបថ្នាំ Metalaxyl ឬ Copper Oxychloride។ ស្រោចគល់ដោយ Fosetyl-Al (៣០-៤០ក្រាម/ទឹក ២០លីត្រ) ឬចាក់ថ្នាំ Phosphorous acid ចូលដើម។",
        "treatment_en": "Scrape stem lesions and apply Metalaxyl or Copper paste. Drench root zone with Fosetyl-Aluminium (30-40g/20L) or trunk injection with Phosphorous acid.",
        "prevention_km": "ដាំលើរងខ្ពស់រៀបចំប្រព័ន្ធបង្ហូរទឹកកុំឱ្យជាំទឹក កែតម្រូវកម្រិត pH ដីឱ្យបាន ៥.៥-៦.៥ ដោយប្រើកំបោរកសិកម្ម និងប្រើផ្សិត Trichoderma ស្រោចការពារគល់រៀងរាល់ ២-៣ខែ។",
        "prevention_en": "Plant on raised mounds, ensure excellent field drainage, maintain soil pH 5.5-6.5 using agricultural lime, and apply Trichoderma as a preventative soil drench.",
    },
    {
        "keywords": ["ស្រូវ", "rice", "ប្លាស់", "blast", "ខ្លោចស្លឹក"],
        "title_km": "ជំងឺប្លាស់ស្រូវ (Rice Blast - Magnaporthe oryzae)",
        "title_en": "Rice Blast Disease (Magnaporthe oryzae)",
        "symptoms_km": "ស្នាមដំបៅរាងដូចកូនទូក កណ្តាលពណ៌ប្រផេះ គែមពណ៌ត្នោតចាស់លើស្លឹក និងអាចរលួយកួរស្រូវ (Neck blast)។",
        "symptoms_en": "Spindle-shaped elliptical lesions with grey centers and brown margins on leaves; rotting of panicle neck.",
        "treatment_km": "បាញ់ថ្នាំ Tricyclazole 75% WP (១៥-២០ក្រាម/ធុង ១៦-២០លីត្រ) ឬ Azoxystrobin + Difenoconazole។ បញ្ឈប់ការដាក់ជីអ៊ុយរ៉េ (N) បន្ថែមជាបន្ទាន់។",
        "treatment_en": "Spray Tricyclazole 75% WP (15-20g per 16-20L water) or Azoxystrobin + Difenoconazole. Stop all nitrogen top-dressing immediately.",
        "prevention_km": "ប្រើពូជស្រូវធន់នឹងជំងឺ កុំសាបព្រោះញឹកពេក រក្សាកម្រិតទឹកក្នុងស្រែឱ្យបានត្រឹមត្រូវ និងដាក់ជី NPK ឱ្យមានតុល្យភាព (ជីបាត DAP, បំប៉ន Urea + Potassium)។",
        "prevention_en": "Use resistant rice varieties, avoid dense sowing, balance NPK fertilizers with split potassium, and maintain proper water levels.",
    },
    {
        "keywords": ["ដំឡូងមី", "cassava", "ម៉ូសេក", "mosaic", "រួញស្លឹក"],
        "title_km": "ជំងឺម៉ូសេកដំឡូងមី (Cassava Mosaic Disease - CMD)",
        "title_en": "Cassava Mosaic Disease (CMD)",
        "symptoms_km": "ស្លឹកមានស្នាមអុចពណ៌លឿងលាយបៃតង ស្លឹកកោងរួញខូចទ្រង់ទ្រាយ ដើមក្រិនទិន្នផលមើមថយចុះយ៉ាងខ្លាំង។",
        "symptoms_en": "Mottled yellow-green patches, asymmetric leaf curling, severe stunting, and root yield collapse.",
        "treatment_km": "គ្មានថ្នាំគីមីព្យាបាលមេរោគវីរុសនេះទេ។ ត្រូវដកដើមដែលកើតជំងឺដុតកម្ទេចចោលជាបន្ទាន់ និងបាញ់កម្ចាត់សត្វល្អិតមមាចស (Whitefly) ដែលជាភ្នាក់ងារចម្លងដោយប្រើ Dinotefuran ឬ Thiamethoxam។",
        "treatment_en": "No chemical cure exists for viral CMD. Rogue and burn infected plants immediately. Control whitefly insect vectors using Dinotefuran or Thiamethoxam.",
        "prevention_km": "ជ្រើសរើសដើមពូជស្អាតគ្មានមេរោគ (ដូចជា KU50, Rayong 9) និងមិនត្រូវកាត់ដើមពូជពីចម្ការដែលមានជំងឺមកដាំបន្តឡើយ។",
        "prevention_en": "Plant only certified virus-free stem cuttings (e.g. KU50, Rayong 9). Never take cuttings from infected fields.",
    },
    {
        "keywords": ["ពោត", "corn", "maize", "ដង្កូវហ្វូង", "armyworm", "ចោះដើម"],
        "title_km": "ដង្កូវហ្វូងរដូវស្លឹកឈើជ្រុះលើពោត (Fall Armyworm - Spodoptera frugiperda)",
        "title_en": "Fall Armyworm in Corn (Spodoptera frugiperda)",
        "symptoms_km": "ស្លឹកធ្លុះធ្លាយរហែកធំៗ មានកាកលាមកដូចកំទេចអាចម៍រណាលើត្រួយ និងដង្កូវស៊ីបំផ្លាញកួរពោតខ្ចី។",
        "symptoms_en": "Windowpane damage on young leaves, large ragged holes, heavy sawdust-like frass inside whorls, feeding on tassels and ears.",
        "treatment_km": "វិធានការជីវសាស្រ្ត៖ ប្រើបាក់តេរី Bacillus thuringiensis (Bt) ឬផ្សិត Beauveria bassiana។ វិធានការគីមី៖ បាញ់ថ្នាំ Emamectin benzoate (៥-១០ក្រាម/២០លីត្រ) ឬ Chlorantraniliprole ចូលត្រួយពោតនៅពេលល្ងាច។",
        "treatment_en": "Bio-control: Bacillus thuringiensis (Bt) or Beauveria bassiana. Chemical control: Spray Emamectin benzoate (5-10g/20L) or Chlorantraniliprole directly into whorls late in the afternoon.",
        "prevention_km": "ភ្ជួរដីហាលឱ្យបានយូរដើម្បីកម្ទេចដុកឌឿ ដាក់អន្ទាក់ស្អិត និងដាំដំណាំចម្រុះដើម្បីកាត់ផ្តាច់វដ្តជីវិតសត្វល្អិត។",
        "prevention_en": "Deep plowing to expose pupae, pheromone monitoring traps, and intercropping to break the pest cycle.",
    },
    {
        "keywords": ["ម្រេច", "pepper", "ងាប់រហ័ស", "ងាប់យឺត", "quick wilt"],
        "title_km": "ជំងឺងាប់រហ័សលើម្រេច (Quick Wilt - Phytophthora capsici)",
        "title_en": "Pepper Quick Wilt (Phytophthora capsici)",
        "symptoms_km": "ស្លឹកប្រែជាពណ៌បៃតងចាស់ ស្រពោន និងជ្រុះយ៉ាងលឿនក្នុងរយៈពេល ២-៣ថ្ងៃ ដើមនិងឬសប្រែពណ៌ខ្មៅរលួយ។",
        "symptoms_en": "Rapid wilting and drop of leaves within 2-3 days while retaining dark color; collar and underground roots rot black.",
        "treatment_km": "កាត់មែកដែលងាប់ចោល ដកដើមងាប់ដុតបំផ្លាញ ស្រោចថ្នាំ Metalaxyl ឬ Fosetyl-Al ជុំវិញគល់។",
        "treatment_en": "Prune and destroy infected branches; drench root zones with Metalaxyl or Fosetyl-Al immediately.",
        "prevention_km": "រៀបចំប្រព័ន្ធបង្ហូរទឹកកុំឱ្យដក់ជាំ កាត់ក្រីមែកទាបៗកុំឱ្យប៉ះដី និងស្រោចផ្សិត Trichoderma ជុំវិញគល់រៀងរាល់ ២-៣ខែម្តង។",
        "prevention_en": "Ensure rapid drainage away from vines, prune lower foliage off soil contact, and drench with Trichoderma bio-fungicide every 2-3 months.",
    },
    {
        "keywords": ["កំបោរ", "lime", "ដីជូរ", "acidic soil", "pH", "ជីកំប៉ុស", "compost"],
        "title_km": "ការគ្រប់គ្រងដី និងកំបោរកសិកម្ម (Soil Management & Liming)",
        "title_en": "Soil Management & Agricultural Liming",
        "symptoms_km": "ដីជូរខ្លាំង (pH < 5.0) ដំណាំលូតលាស់យឺត ឫសមិនដើរ ស្លឹកលឿង និងខ្វះជីវជាតិ។",
        "symptoms_en": "Acidic soil (pH < 5.0), stunted root development, phosphorus tie-up, leaf chlorosis.",
        "treatment_km": "បាចកំបោរកសិកម្ម (Dolomite ឬ Calcite) ក្នុងកម្រិត ៥០០-១០០០គីឡូក្រាម/ហិកតា រួចភ្ជួរលុបមុនដាំដុះ ២-៣សប្តាហ៍។",
        "treatment_en": "Apply agricultural lime (Dolomite or Calcite) at 500-1000 kg/ha, incorporate into soil 2-3 weeks prior to planting.",
        "prevention_km": "បន្ថែមជីកំប៉ុស និងជីលាមកសត្វពុកផុយដើម្បីបង្កើនសារធាតុសរីរាង្គក្នុងដី និងធ្វើតេស្ត pH ដីជារៀងរាល់ឆ្នាំ។",
        "prevention_en": "Incorporate mature organic compost regularly to buffer soil pH and test soil acidity annually.",
    }
]


def _hf_token() -> str | None:
    return os.getenv("HF_TOKEN") or None


tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_ID, token=_hf_token())
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL_ID,
    token=_hf_token(),
    torch_dtype=torch.bfloat16,
)
model = PeftModel.from_pretrained(
    base_model,
    MODEL_ID,
    token=_hf_token(),
    torch_device="cpu",
).to("cuda")
model.eval()


def _clean_text(text: str) -> str:
    if not text:
        return ""
    # Remove excessive repeated characters (e.g. ០០០០០០ or .....)
    text = re.sub(r"(.)\1{4,}", r"\1\1", text)
    # Remove template placeholders
    text = re.sub(r"\[(List|Action|Crop|Location|Your|Insert|Date)[^\]]*\]", "", text, flags=re.IGNORECASE)
    # Remove prompt echo markers
    for marker in ("\nAnswer:\n", "\nចម្លើយ៖\n", "\nចម្លើយ:\n", "Answer:\n", "ចម្លើយ៖\n", "ចម្លើយ:\n"):
        if marker in text:
            text = text.rsplit(marker, 1)[-1]
    return clean_professional_text(text)


def _is_valid_output(text: str, is_khmer: bool) -> bool:
    cleaned = text.strip()
    if len(cleaned) < 25:
        return False
    # Reject broken unicode replacement chars, raw template leftovers, and hybrid artifacts
    if "\ufffd" in cleaned or "example_video_id" in cleaned or "ជំ-ngឺ" in cleaned or "ngឺ" in cleaned:
        return False
    # Reject Japanese kana or Cyrillic characters
    if bool(re.search(r"[\u3040-\u30ff\u0400-\u04ff]", cleaned)):
        return False
    # Reject Chinese character leakage
    if bool(re.search(r"[\u4e00-\u9fff]", cleaned)):
        return False
    # Check if a single character dominates >35% of the text
    counts = Counter(cleaned)
    if counts:
        most_common_char, count = counts.most_common(1)[0]
        if count / len(cleaned) > 0.35 and most_common_char not in {" ", "\n", "-"}:
            return False
    # If query is Khmer, verify response has Khmer characters
    if is_khmer and not bool(re.search(r"[\u1780-\u17ff]", cleaned)):
        return False
    return True


def _match_knowledge(question: str) -> dict | None:
    q_norm = question.lower()
    for item in AGRI_KNOWLEDGE_BASE:
        if any(k in q_norm for k in item["keywords"]):
            return item
    return None


@spaces.GPU(duration=180)
def answer(
    question: str,
    temperature: float = 0.2,
    max_new_tokens: int = 768,
    context: str = "",
) -> str:
    """Answer an agricultural question with the fine-tuned AgriSystem model."""
    question = (question or "").strip()
    if not question:
        return "Please enter an agricultural question. / សូមបញ្ចូលសំណួរកសិកម្មរបស់អ្នក។"

    q_norm = re.sub(r"[!?,.។៕\s]+", " ", question.lower()).strip()
    is_khmer = bool(re.search(r"[\u1780-\u17ff]", question))

    # Fast responses for language greeting questions
    if "hello in khmer" in q_norm or "say hello in khmer" in q_norm:
        if is_khmer:
            return clean_professional_text(
                "សួស្តីបាទ/ចាស! ជាភាសាខ្មែរយើងប្រើពាក្យ 'សួស្តី' (សម្រាប់ភាពស្និទ្ធស្នាល ឬទូទៅ) ឬ 'ជំរាបសួរ' (ប្រកបដោយការគួរសម និងការគោរព)។ "
                "តើដំណាំ ឬការងារកសិកម្មរបស់អ្នកមានបញ្ហាអ្វីដែលខ្ញុំអាចជួយបានដែរទេបាទ/ចាស?"
            )
        return clean_professional_text(
            "In Khmer, you can say 'សួស្តី' (Suosdei - casual hello) or 'ជំរាបសួរ' (Choumreabsour - polite/respectful greeting)! "
            "How can I help you with your farming needs today?"
        )

    if "hello in english" in q_norm or "say hello in english" in q_norm:
        return clean_professional_text(
            "Hi there! In English, we greet with 'Hello' or 'Hi'! "
            "How can I assist you with your crops or farm today?"
        )

    if len(q_norm) <= 120:
        # Identity query: ONLY here do we show the creator and AI model identity
        identity_set = IDENTITY_KM if is_khmer else (IDENTITY_KM | IDENTITY_EN)
        if any(phrase in q_norm for phrase in identity_set):
            if is_khmer:
                return clean_professional_text(
                    "ជំរាបសួរលោកអ្នក! ខ្ញុំគឺជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ "
                    "ខ្ញុំជាជំនួយការកសិកម្មឆ្លាតវៃ ត្រៀមខ្លួនជានិច្ចក្នុងការជួយពិនិត្យជំងឺដំណាំ វិភាគរោគសញ្ញា ផ្តល់បច្ចេកទេសដាំដុះ និងចែករំលែកវិធីសាស្រ្តការពារ និងការព្យាបាលប្រកបដោយសុវត្ថិភាពខ្ពស់។ "
                    "តើថ្ងៃនេះខ្ញុំអាចជួយអ្វីដល់លោកអ្នកបានខ្លះដែរ?"
                )
            return clean_professional_text(
                "Hello! I am AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. "
                "I am an intelligent agricultural assistant dedicated to helping farmers diagnose plant diseases, improve crop health, and adopt safe, sustainable farming practices. "
                "How can I help you and your farm today?"
            )

        # Standard greeting: warm and polite, without self-introduction recitation
        greeting_set = GREETINGS_KM if is_khmer else GREETINGS_EN
        if any(q_norm == g or q_norm.startswith(g + " ") for g in greeting_set):
            if is_khmer:
                return clean_professional_text(
                    "សួស្តីបាទ/ចាស! ខ្ញុំរីករាយណាស់ដែលបានជួយលោកអ្នកនៅថ្ងៃនេះ។ តើដំណាំ ឬការងារកសិកម្មរបស់អ្នកដំណើរការយ៉ាងណាដែរ? "
                    "តើមានបញ្ហាជំងឺដំណាំ ឬការដាំដុះអ្វីដែលខ្ញុំអាចជួយផ្តល់ដំបូន្មាន ឬដោះស្រាយជូនបានដែរទេ?"
                )
            return clean_professional_text(
                "Hello! Warm greetings to you! It's a pleasure to assist you. How are your crops doing today, and how can I help you with your farming needs?"
            )

    matched_kb = _match_knowledge(question)
    kb_context = context.strip() if context else ""
    if matched_kb and not kb_context:
        if is_khmer:
            kb_context = (
                f"ប្រធានបទ៖ {matched_kb['title_km']}\n"
                f"រោគសញ្ញា៖ {matched_kb['symptoms_km']}\n"
                f"វិធីព្យាបាល៖ {matched_kb['treatment_km']}\n"
                f"វិធានការបង្ការ៖ {matched_kb['prevention_km']}"
            )
        else:
            kb_context = (
                f"Topic: {matched_kb['title_en']}\n"
                f"Symptoms: {matched_kb['symptoms_en']}\n"
                f"Treatment: {matched_kb['treatment_en']}\n"
                f"Prevention: {matched_kb['prevention_en']}"
            )

    sys_prompt = SYSTEM_PROMPT_KH if is_khmer else SYSTEM_PROMPT_EN
    if kb_context:
        if is_khmer:
            sys_prompt += f"\n\nព័ត៌មានបច្ចេកទេសយោង៖\n{kb_context}"
        else:
            sys_prompt += f"\n\nTechnical reference context:\n{kb_context}"

    max_new_tokens = max(32, min(int(max_new_tokens), 1024))
    temperature = max(0.05, min(float(temperature), 0.8))

    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": question},
    ]
    prompt = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    encoded = tokenizer(prompt, return_tensors="pt")
    device = next(model.parameters()).device
    encoded = {key: value.to(device) for key, value in encoded.items()}

    raw_output = ""
    try:
        with torch.inference_mode():
            generated = model.generate(
                **encoded,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                top_p=0.9,
                do_sample=temperature > 0.05,
                repetition_penalty=1.2,
                no_repeat_ngram_size=4,
                pad_token_id=tokenizer.eos_token_id,
            )
        new_tokens = generated[0][encoded["input_ids"].shape[-1]:]
        raw_output = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
    except Exception:
        raw_output = ""

    cleaned_reply = _clean_text(raw_output)

    if _is_valid_output(cleaned_reply, is_khmer):
        return clean_professional_text(cleaned_reply)

    # Fallback to structured knowledge synthesis if model generated degenerate output
    if matched_kb:
        if is_khmer:
            return clean_professional_text(
                f"{matched_kb['title_km']}\n\n"
                f"ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព! "
                f"ខាងក្រោមនេះជាការណែនាំបច្ចេកទេស និងវិធានការដោះស្រាយ៖\n\n"
                f"១. រោគសញ្ញាសម្គាល់ (Symptoms)\n- {matched_kb['symptoms_km']}\n\n"
                f"២. វិធានការព្យាបាល (Treatment)\n- {matched_kb['treatment_km']}\n\n"
                f"៣. វិធានការការពារ និងថែទាំ (Prevention & Soil Care)\n- {matched_kb['prevention_km']}\n\n"
                f"ចំណាំ៖ សូមពាក់សម្ភារៈការពារខ្លួន (ម៉ាស់ ស្រោមដៃ) ពេលប្រើប្រាស់ថ្នាំកសិកម្ម និងគោរពតាមការណែនាំលើស្លាកផលិតផលជានិច្ច។"
            )
        else:
            return clean_professional_text(
                f"{matched_kb['title_en']}\n\n"
                f"Greetings! "
                f"Here is the recommended technical guidance for your crops:\n\n"
                f"1. Observable Symptoms\n- {matched_kb['symptoms_en']}\n\n"
                f"2. Treatment Strategy\n- {matched_kb['treatment_en']}\n\n"
                f"3. Preventative Management & Soil Care\n- {matched_kb['prevention_en']}\n\n"
                f"Safety Notice: Always wear PPE (gloves, mask) and strictly observe pre-harvest intervals (PHI) indicated on product labels."
            )

    if is_khmer:
        return clean_professional_text(
            "ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព! "
            "ដើម្បីជួយវិភាគ និងផ្តល់ដំបូន្មានបច្ចេកទេសឱ្យបានច្បាស់លាស់ សូមបញ្ជាក់បន្ថែមអំពីឈ្មោះដំណាំ រោគសញ្ញាជាក់ស្តែងលើស្លឹក ដើម ឬផ្លែ និងទីតាំងដាំដុះរបស់អ្នក។"
        )
    return clean_professional_text(
        "Greetings! "
        "To provide you with the most precise diagnosis and agronomic guidance, please describe your crop name, specific leaf/stem symptoms, and current soil or field conditions."
    )


examples = [
    ["សួស្តី!"],
    ["ជំរាបសួរ"],
    ["តើអ្នកជាអ្នកណា ហើយអ្នកណាបង្កើតអ្នក?"],
    ["ស្រូវរបស់ខ្ញុំមានចំណុចពណ៌ត្នោតលើស្លឹក និងចាប់ផ្តើមឡើងលឿង។ តើខ្ញុំគួរពិនិត្យអ្វីខ្លះជាមុន?"],
    ["តើជំងឺរលួយឬស និងដើមលើទុរេនត្រូវព្យាបាលយ៉ាងដូចម្តេច?"],
    ["Hello! Who created you and what is your model name?"],
    ["My rice leaves have brown spots and are turning yellow. What should I check first?"],
    ["How do I treat fall armyworm on sweet corn organically and chemically?"],
]

demo = gr.Interface(
    fn=answer,
    inputs=[
        gr.Textbox(
            label="Agricultural question",
            placeholder="Describe your crop, symptoms, location, and growing conditions…",
            lines=5,
        ),
        gr.Slider(0.05, 1.2, value=0.2, step=0.05, label="Creativity"),
        gr.Slider(32, 1024, value=768, step=16, label="Maximum answer tokens"),
    ],
    outputs=gr.Markdown(label="AgriSystem answer"),
    examples=examples,
    title="AgriSystem Agricultural Assistant",
    description=(
        "A demonstration of Maoseavik/agri-qwen3b-lora. Advice is informational; "
        "confirm diagnosis and treatment with a qualified local expert."
    ),
    api_name="answer",
)

if __name__ == "__main__":
    demo.launch(mcp_server=True)
