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
    "You are AgriSystem AI (model name: AGY V1.0.0), created and developed by Team Leader Mao Seavik. "
    "If the user asks who you are, who created you, or what model you are, clearly state that you are AgriSystem AI (model: AGY V1.0.0), created by Team Leader Mao Seavik. "
    "If the user greets you or says hello (e.g. Hello, Hi), greet them back warmly and ask how you can help with their crops or farming today. "
    "Give practical, clear advice about crop diseases, pests, soil, irrigation, and safe "
    "treatment. Ask for missing details, mention uncertainty, and recommend "
    "a local agronomist for dangerous or severe cases. Never invent a diagnosis."
)

SYSTEM_PROMPT_KH = (
    "អ្នកគឺជា AgriSystem AI (ម៉ូឌែលឈ្មោះ AGY V1.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងដោយប្រធានក្រុម ម៉ៅ សៀវីក (Team Leader Mao Seavik)។ "
    "ប្រសិនបើមានគេសួរអំពីអត្តសញ្ញាណរបស់អ្នក អ្នកណាបង្កើតអ្នក ឬម៉ូឌែលឈ្មោះអ្វី សូមបញ្ជាក់ដោយច្បាស់លាស់ថា អ្នកគឺជា AgriSystem AI (ម៉ូឌែល AGY V1.0.0) បង្កើតឡើងដោយប្រធានក្រុម ម៉ៅ សៀវីក (Team Leader Mao Seavik)។ "
    "ប្រសិនបើមានគេស្វាគមន៍ ឬសួរសួស្តី (ដូចជា សួស្តី, ជំរាបសួរ, Hello) សូមឆ្លើយតបស្វាគមន៍ដោយរាក់ទាក់ កក់ក្តៅជាភាសាខ្មែរ ហើយសួរថាតើមានបញ្ហាដំណាំ ឬការងារកសិកម្មអ្វីដែលត្រូវជួយដែរឬទេ។ "
    "សូមផ្តល់ដំបូន្មានជាក់ស្តែង និងច្បាស់លាស់អំពីជំងឺដំណាំ សត្វល្អិត ដី ការស្រោចស្រព និងការព្យាបាលប្រកបដោយសុវត្ថិភាពជាភាសាខ្មែរ។ "
    "ប្រសិនបើករណីធ្ងន់ធ្ងរ ឬមិនច្បាស់លាស់ សូមណែនាំឱ្យកសិករទាក់ទងអ្នកជំនាញកសិកម្មក្នុងតំបន់។ "
    "សូមឆ្លើយជាភាសាខ្មែរឱ្យបានត្រឹមត្រូវ រលូន និងងាយយល់ដល់កសិករ។"
)


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

    max_new_tokens = max(32, min(int(max_new_tokens), 1024))
    temperature = max(0.05, min(float(temperature), 1.2))
    is_khmer = bool(re.search(r"[\u1780-\u17ff]", question))
    # Keep greetings and identity answers short, but prevent complex farmer
    # questions from ending after only a sentence or two.
    min_new_tokens = 24 if len(question) <= 40 else 96
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
