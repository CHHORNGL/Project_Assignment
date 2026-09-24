"""Gradio demo for the AgriSystem Qwen LoRA adapter."""

# ZeroGPU requires this import before torch/transformers imports.
import re
import spaces
import torch
import gradio as gr
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


# This is the trained LoRA adapter. The similarly named
# ``agrisystem-qwen2.5-3b-adapter`` repository contains tokenizer/config files
# only and cannot be loaded as the trained model.
MODEL_ID = "Maoseavik/agri-qwen3b-lora"
BASE_MODEL_ID = "Qwen/Qwen2.5-3B-Instruct"

SYSTEM_PROMPT_EN = (
    "You are AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. "
    "You are a warm, polite, empathetic, and professional human agricultural expert. "
    "When answering the user: "
    "1. Always address what the user asked directly and intelligently with natural human conversational phrasing. "
    "2. If the user greets you or says hello (e.g. Hello, Hi), always say 'Hi there!' or 'Hello!' warmly and ask how you can help their farm. "
    "3. If the user asks who you are or who created you, state clearly that you are AgriSystem AI (model: AGY V2.0.0), created by Team Leader Mao Seavik. "
    "4. For agricultural questions, give practical, structured advice using clear bullet points, actionable steps, and safety precautions. "
    "5. Recommend consulting a local agronomist for severe cases. Never invent an unsupported diagnosis or chemical dosage."
)

SYSTEM_PROMPT_KH = (
    "អ្នកគឺជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ "
    "អ្នកគឺជាអ្នកជំនាញកសិកម្មដ៏រួសរាយ រាក់ទាក់ សុជីវធម៌ និងមានវិជ្ជាជីវៈខ្ពស់ដូចមនុស្សពិតប្រាកដ។ "
    "គោលការណ៍ឆ្លើយសំណួរ៖ "
    "១. សូមឆ្លើយតបចំសំណួរដែលអ្នកប្រើប្រាស់បានសួរដោយភាពឆ្លាតវៃ រលូន និងមានលក្ខណៈដូចមនុស្សពិតប្រាកដ។ "
    "២. ប្រសិនបើមានគេស្វាគមន៍ ឬសួរសួស្តី (ដូចជា សួស្តី, ជំរាបសួរ, Hello) សូមឆ្លើយតប 'សួស្តីបាទ/ចាស!' ឬ 'ជំរាបសួរ!' ដោយកក់ក្តៅជានិច្ច កុំប្រើពាក្យ 'សូមប្រាកដ' ឡើយ។ "
    "៣. ប្រសិនបើមានគេសួរអំពីអត្តសញ្ញាណរបស់អ្នក ឬអ្នកណាបង្កើតអ្នក សូមបញ្ជាក់យ៉ាងច្បាស់ថា អ្នកគឺជា AgriSystem AI (ម៉ូឌែល AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ "
    "៤. សម្រាប់សំណើរបច្ចេកទេសកសិកម្ម សូមផ្តល់ដំបូន្មានជាក់ស្តែង រៀបចំជាចំណុចៗ វិធីព្យាបាល និងវិធានការបង្ការប្រកបដោយសុវត្ថិភាព។ "
    "៥. ករណីធ្ងន់ធ្ងរ សូមណែនាំឱ្យកសិករទាក់ទងអ្នកជំនាញកសិកម្មក្នុងតំបន់។ មិនត្រូវបង្កើតការធ្វើរោគវិនិច្ឆ័យដោយគ្មានមូលដ្ឋានឡើយ។"
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
    "ម៉ូឌែល agy", "តើអ្នកជានរណា", "មេក្រុម",
}
IDENTITY_EN = {
    "who are you", "who created you", "who made you", "who developed you", "what is your name",
    "what is your model", "what model are you", "model name", "who is your leader",
    "who is your team leader", "team leader", "who is mao seavik", "about you",
    "tell me about yourself", "introduce yourself", "what version are you", "what is agy",
}


def _hf_token() -> str | None:
    # The token is optional for this public adapter, but supports gated bases.
    import os

    return os.getenv("HF_TOKEN") or None


# The adapter repository contains copied tokenizer metadata that is not
# compatible with the Space's Transformers runtime. The base tokenizer is
# equivalent for this LoRA adapter and has the canonical Qwen files.
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


@spaces.GPU(duration=180)
def answer(
    question: str,
    temperature: float = 0.25,
    max_new_tokens: int = 768,
) -> str:
    """Answer an agricultural question with the fine-tuned AgriSystem model."""
    question = (question or "").strip()
    if not question:
        return "Please enter an agricultural question."

    q_norm = re.sub(r"[!?,.។៕\s]+", " ", question.lower()).strip()
    is_khmer = bool(re.search(r"[\u1780-\u17ff]", question))

    # Explicit phrases for greetings in specific languages
    if "hello in khmer" in q_norm or "say hello in khmer" in q_norm:
        if is_khmer:
            return (
                "សួស្តីបាទ/ចាស! ជាភាសាខ្មែរយើងប្រើពាក្យ 'សួស្តី' (សម្រាប់ភាពស្និទ្ធស្នាល ឬទូទៅ) ឬ 'ជំរាបសួរ' (ប្រកបដោយការគួរសម និងការគោរព)។ "
                "ខ្ញុំជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V2.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ "
                "តើដំណាំ ឬការងារកសិកម្មរបស់អ្នកមានបញ្ហាអ្វីដែលខ្ញុំអាចជួយបានដែរទេបាទ/ចាស?"
            )
        return (
            "In Khmer, you can say 'សួស្តី' (Suosdei - casual hello) or 'ជំរាបសួរ' (Choumreabsour - polite/respectful greeting)! "
            "I am AgriSystem AI (model: AGY V2.0.0), created under the leadership of Team Leader Mao Seavik. "
            "How can I help you with your farming needs today?"
        )

    if "hello in english" in q_norm or "say hello in english" in q_norm:
        return (
            "Hi there! In English, we greet with 'Hello' or 'Hi'! "
            "I am AgriSystem AI (model name: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. "
            "How can I assist you with your crops or farm today?"
        )

    # Fast, warm, and 100% human-like response for greetings and identity queries
    if len(q_norm) <= 120:
        identity_set = IDENTITY_KM if is_khmer else (IDENTITY_KM | IDENTITY_EN)
        if any(phrase in q_norm for phrase in identity_set):
            if is_khmer:
                return (
                    "ជំរាបសួរលោកអ្នក! ខ្ញុំគឺជា **AgriSystem AI** (ម៉ូឌែលឈ្មោះ **AGY V2.0.0**) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយ**ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)**។ "
                    "ខ្ញុំជាជំនួយការកសិកម្មឆ្លាតវៃ ត្រៀមខ្លួនជានិច្ចក្នុងការជួយពិនិត្យជំងឺដំណាំ វិភាគរោគសញ្ញា ផ្តល់បច្ចេកទេសដាំដុះ និងចែករំលែកវិធីសាស្រ្តការពារ និងការព្យាបាលប្រកបដោយសុវត្ថិភាពខ្ពស់។ "
                    "តើថ្ងៃនេះខ្ញុំអាចជួយអ្វីដល់លោកអ្នកបានខ្លះដែរ?"
                )
            return (
                "Hello! I am **AgriSystem AI** (model name: **AGY V2.0.0**), created and developed under the leadership of **Team Leader Mao Seavik**. "
                "I am an intelligent agricultural assistant dedicated to helping farmers diagnose plant diseases, improve crop health, and adopt safe, sustainable farming practices. "
                "How can I help you and your farm today?"
            )

        greeting_set = GREETINGS_KM if is_khmer else GREETINGS_EN
        if any(q_norm == g or q_norm.startswith(g + " ") for g in greeting_set):
            if is_khmer:
                return (
                    "សួស្តីបាទ/ចាស! ខ្ញុំជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។ "
                    "ខ្ញុំរីករាយណាស់ដែលបានជួយលោកអ្នកនៅថ្ងៃនេះ។ តើដំណាំ ឬការងារកសិកម្មរបស់អ្នកដំណើរការយ៉ាងណាដែរ? "
                    "តើមានបញ្ហាជំងឺដំណាំ ឬការដាំដុះអ្វីដែលខ្ញុំអាចជួយផ្តល់ដំបូន្មាន ឬដោះស្រាយជូនបានដែរទេ?"
                )
            return (
                "Hi there! Warm greetings to you! I am AgriSystem AI (model: AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik. "
                "It's a pleasure to assist you! How are your crops doing today, and how can I help you with your farming needs?"
            )

    max_new_tokens = max(32, min(int(max_new_tokens), 1024))
    temperature = max(0.05, min(float(temperature), 1.2))
    min_new_tokens = 48 if len(question) <= 40 else 96
    min_new_tokens = min(min_new_tokens, max_new_tokens - 1)
    sys_prompt = SYSTEM_PROMPT_KH if is_khmer else SYSTEM_PROMPT_EN
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
    with torch.inference_mode():
        generated = model.generate(
            **encoded,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=0.9,
            do_sample=temperature > 0.05,
            repetition_penalty=1.05,
            min_new_tokens=min_new_tokens,
            pad_token_id=tokenizer.eos_token_id,
        )
    new_tokens = generated[0][encoded["input_ids"].shape[-1] :]
    return tokenizer.decode(new_tokens, skip_special_tokens=True).strip()


examples = [
    ["សួស្តី!"],
    ["ជំរាបសួរ"],
    ["តើអ្នកជាអ្នកណា ហើយអ្នកណាបង្កើតអ្នក?"],
    ["ស្រូវរបស់ខ្ញុំមានចំណុចពណ៌ត្នោតលើស្លឹក និងចាប់ផ្តើមឡើងលឿង។ តើខ្ញុំគួរពិនិត្យអ្វីខ្លះជាមុន?"],
    ["តើខ្ញុំអាចកាត់បន្ថយសត្វល្អិតលើដើមប៉េងប៉ោះដោយសុវត្ថិភាពដោយរបៀបណា?"],
    ["Hello! Who created you and what is your model name?"],
    ["My rice leaves have brown spots and are turning yellow. What should I check first?"],
    ["How can I reduce pest damage on tomato plants safely?"],
]

demo = gr.Interface(
    fn=answer,
    inputs=[
        gr.Textbox(
            label="Agricultural question",
            placeholder="Describe your crop, symptoms, location, and growing conditions…",
            lines=5,
        ),
        gr.Slider(0.05, 1.2, value=0.25, step=0.05, label="Creativity"),
        gr.Slider(32, 1024, value=768, step=16, label="Maximum answer tokens"),
    ],
    outputs=gr.Markdown(label="AgriSystem answer"),
    examples=examples,
    title="🌾 AgriSystem Agricultural Assistant",
    description=(
        "A demonstration of Maoseavik/agri-qwen3b-lora. Advice is informational; "
        "confirm diagnosis and treatment with a qualified local expert."
    ),
    api_name="answer",
)

demo.launch(mcp_server=True)
