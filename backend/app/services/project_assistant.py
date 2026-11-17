"""AgriSystem Platform Support Assistant.

Dedicated intelligent guide for the AgriSystem (Integrated Agricultural Expert System)
web platform. Explains navigation, features, account settings, diagnoses, rule inference,
and support tickets in both English and Khmer.
"""

from __future__ import annotations

import re

from flask import current_app

from app.utils.i18n import get_current_language

PROJECT_CONTEXT = """Integrated Agricultural Expert System (AgriSystem) Platform Knowledge:
Created and developed under the leadership of Team Leader Mao Seavik.
Project Supervisor & Academic Advisor: Professor Sek Socheat (សាស្ត្រាចារ្យ សេក សុជាតិ).
Development Team:
- Mao Seavik (ម៉ៅ សៀវអ៊ិ) — Team Leader & Backend Lead (Backend APIs, Rule-Based Diagnosis Engine, Custom AI Training & Weather Intelligence)
- Chea Cheavchhorng (ជា ជៀវឈ័ង្ស) — Frontend & UI/UX Lead (Farmer Web Dashboard, React Diagnosis Wizard, Theme Management & Responsive UI Design)
- Nov Panha (នៅ បញ្ញា) — Mobile App Developer (Flutter Cross-Platform Mobile App, Mobile API Integration & Offline Caching)
- Pich Rachana (ពេជ្រ រចនា) — Data & QA Specialist (Crop Disease & Symptom Rule Dataset Curation, Khmer Translation Matrix & System Testing)

System Architecture & Technology Stack:
- Backend: Python 3.11 + Flask 3.1 REST & SSR architecture, SQLAlchemy ORM, Flask-Login, Flask-WTF CSRF, Flask-Limiter, PyWebAuthn (Passkeys), Authlib (Google OAuth 2.0), Bakong KHQR SDK.
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + Three.js 3D visual canvas.
- Mobile: Flutter / Dart cross-platform iOS & Android app.
- Database: PostgreSQL (Neon Serverless Postgres in production, SQLite in local dev/testing).
- AI & Knowledge Engine: Forward-chaining Rule-Based Expert System (diagnosis_engine.py) + Custom Fine-Tuned Agricultural AI (Model AGY V2.0.0 / Maoseavik/agri-qwen3b-lora hosted on Hugging Face Spaces).

Platform Roles & Navigation:
1. Farmer Portal:
   - Dashboard (/farmer/dashboard): Quick overview of farm stats, recent diagnoses, weather widget, remaining AI credits.
   - AI Diagnosis (/farmer/diagnose): Upload photos of crop leaves, stems, or fruits for automated AI disease detection, severity score, and treatment tips.
   - Rule-Based Diagnosis (/farmer/diagnose-rule-based): Step-by-step questionnaire decision tree to deduce crop diseases by answering guided symptom questions without uploading photos.
   - Diagnosis History (/farmer/diagnosis-history): Chronological log of past diagnoses with status, expert verification, and option to export or print PDF medical plant reports.
   - Ask Agricultural Expert (/farmer/chat): Dedicated AI agronomy guidance and real-time chat with agricultural specialists.
   - Weather & Soil (/farmer/weather): Live localized weather, 24h rainfall prediction, 7-day forecast, humidity, and agronomic field advice.
   - News (/farmer/news): Agriculture news, market updates, and seasonal planting advice.
   - Profile & Settings (/farmer/profile, /farmer/settings): Manage profile, change password, register biometric Passkeys (WebAuthn / TouchID / FaceID), and view active login devices.
   - AI Credits & Upgrade (/farmer/upgrade): Free tier has daily quota; Pro plan ($2.99/month via NBC Bakong KHQR) unlocks unlimited AI analyses and priority expert reviews.

2. Expert Portal:
   - Dashboard (/expert/dashboard): Overview of assigned farmer cases.
   - Diagnoses Review (/expert/diagnoses): Verify and confirm farmer diagnosis submissions.
   - Disease Knowledge Base (/expert/diseases, /expert/rules): Manage plant diseases, symptoms, and diagnostic rules.
   - Consultations (/expert/chats): Chat directly with farmers via Live Support.

3. Admin Portal:
   - Dashboard (/admin/dashboard): System metrics, active users, revenue, and server health.
   - User Management (/admin/users): Manage accounts, activate/deactivate, assign roles (Farmer, Expert, Admin).
   - Diseases & Rules (/admin/diseases, /admin/rules): Configure crop diseases, symptom rules, and decision trees.
   - Translations (/admin/translations): Manage bilingual English and Khmer content.
   - Audit Logs (/admin/audit-logs): View security and system activity logs with CSV/JSON export.
   - Support Requests (/admin/support-requests): Review and resolve user support tickets and live chat.
   - Settings (/admin/settings): AI model configuration and site settings.

Core Policy:
- Agri AI Copilot answers questions about the system of the project (features, navigation, architecture, team members, account settings, Passkeys, Bakong payments, and portal workflows).
- For agricultural questions (crop diseases, symptoms, fertilizers, soil, pest control), politely direct the user to Ask Agricultural Expert (/farmer/chat), AI Diagnosis (/farmer/diagnose), or Rule-Based Diagnosis (/farmer/diagnose-rule-based).
- ABSOLUTELY DO NOT use markdown bold signs (**), asterisks (*), hashtags (###), backticks (`), or code syntax. Write clean, natural plain text.
"""

CROP_DIAGNOSIS_KEYWORDS = (
    "rice blast", "potato blight", "tomato curl", "leaf spot", "leaf spots",
    "yellow leaf", "yellow leaves", "yellow spots", "spots", "blast", "blight",
    "curling leaf", "curling leaves", "leaf curl", "pest", "pests", "insect", "insects",
    "caterpillar", "aphid", "fungicide", "pesticide", "fertilizer", "fertilizer dose",
    "chemical spray", "treat disease", "cure disease", "diagnose my plant",
    "diagnose my crop", "what disease", "how to treat", "how to cure", "plant disease",
    "crop disease", "mildew", "rust", "rot", "wilt", "wilting",
    "ជំងឺ", "សត្វល្អិត", "ស្លឹកលឿង", "ស្លឹកក្រញង់", "ដង្កូវ", "ថ្នាំកសិកម្ម",
    "បាញ់ថ្នាំ", "ព្យាបាលជំងឺ", "ជីគីមី", "ដង្កូវហ្វូង", "រលួយដើម", "ផ្សិត", "ជំងឺដំណាំ",
)

SYSTEM_INTENT_KEYWORDS = (
    "dashboard", "menu", "sidebar", "navigation", "route", "page", "screen",
    "login", "sign in", "register", "account", "profile", "settings",
    "how to use", "how do i", "button", "click", "submit", "form", "admin",
    "expert", "farmer", "permission", "support", "ticket", "passkey", "password",
    "upgrade", "credit", "credits", "token", "tokens", "dark mode", "light mode",
    "theme", "language", "khmer", "english", "history", "export", "pdf", "print",
    "report", "weather", "forecast", "rule based", "rule-based", "upload photo",
    "upload", "image", "contact admin",
    "ប្រព័ន្ធ", "គេហទំព័រ", "កម្មវិធី", "របៀបប្រើ", "មុខងារ", "ម៉ឺនុយ",
    "លេខសម្ងាត់", "គណនី", "ការកំណត់", "ភាសា", "ប្តូរភាសា", "ម៉ូតងងឹត", "តម្លើង",
    "របៀបពិនិត្យ", "បញ្ចូលរូប", "ប្រវត្តិ", "ទាក់ទង", "ជំនួយ", "របាយការណ៍",
)


def clean_markdown_symbols(text: str) -> str:
    """Strip raw markdown formatting symbols (**, *, __, ###, backticks) for a clean plain-text experience."""
    if not text:
        return ""
    # Strip bold/italic markdown
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    text = re.sub(r"_{1,3}(.*?)_{1,3}", r"\1", text)
    # Strip markdown headers (e.g. ### Header -> Header)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    # Strip inline backticks `code` -> code
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Strip any remaining stray asterisks or backticks
    text = text.replace("**", "").replace("*", "").replace("`", "")
    return text.strip()


def _is_khmer(text: str, lang: str | None = None) -> bool:
    if (lang or "").lower() in {"km", "kh", "khmer"}:
        return True
    return bool(re.search(r"[\u1780-\u17ff]", text or ""))


def _looks_like_crop_query(message: str) -> bool:
    msg = (message or "").lower()
    has_crop_term = any(k in msg for k in CROP_DIAGNOSIS_KEYWORDS)
    has_system_term = any(k in msg for k in SYSTEM_INTENT_KEYWORDS)
    # If it asks specifically about crop pathology without asking how to use the system
    return has_crop_term and not has_system_term


def _built_in_support_reply(message: str, is_km: bool, user_role: str = "user", page: str = "") -> str:
    msg = (message or "").lower()

    # 1. Direct Crop Query Handoff
    if _looks_like_crop_query(msg):
        if is_km:
            return (
                "ខ្ញុំជាជំនួយការប្រព័ន្ធ AgriSystem! ដើម្បីពិនិត្យជំងឺដំណាំ និងទទួលបានវិធីព្យាបាលយ៉ាងច្បាស់លាស់ សូមប្រើប្រាស់ឧបករណ៍លើប្រព័ន្ធដូចខាងក្រោម៖\n\n"
                "១. AI Diagnosis (ពិនិត្យតាមរូបថត)៖ ចូលទៅកាន់ម៉ឺនុយ Diagnosis រួចបញ្ចូលរូបថតស្លឹក ឬផ្លែ ហើយចុច Analyze ដើម្បីឱ្យ AI វិភាគជំងឺ និងកម្រិតភាគរយភ្លាមៗ។\n"
                "២. Rule-Based Diagnosis (ពិនិត្យតាមច្បាប់)៖ ចូលទៅកាន់ Rule-Based Diagnosis ដើម្បីឆ្លើយសំណួរអំពីរោគសញ្ញាជាជំហានៗ ដោយមិនចាំបាច់មានរូបថតឡើយ។\n"
                "៣. Ask Expert (សួរអ្នកជំនាញ)៖ ចូលទៅកាន់ Ask Expert ដើម្បីជជែកពិគ្រោះផ្ទាល់ជាមួយអ្នកជំនាញកសិកម្ម។\n\n"
                "តើខ្ញុំអាចជួយណែនាំពីរបៀបប្រើប្រាស់មុខងារណាមួយនៃប្រព័ន្ធ ឬបញ្ហាគណនីផ្សេងទៀតបានទេបាទ/ចាស?"
            )
        return (
            "I am your AgriSystem Platform Support Assistant! To diagnose plant diseases and receive treatment advice, please use our dedicated tools:\n\n"
            "1. AI Image Diagnosis (Photo Upload): Go to Diagnosis in your menu, upload clear photos of affected leaves or fruits, and click Analyze for instant AI detection.\n"
            "2. Rule-Based Diagnosis (Questionnaire): Open Rule-Based Diagnosis to answer guided symptom questions without needing a photo.\n"
            "3. Ask Expert: Open Ask Expert to consult directly with human agronomists.\n\n"
            "Can I help you navigate to any of these tools or explain how they work?"
        )

    # 2. Greetings
    greeting_terms = (
        "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening",
        "how are you", "សួស្តី", "សួរស្តី", "ជំរាបសួរ", "ជំរាបសួរបង", "សុខសប្បាយ",
    )
    if any(msg == g or msg.startswith(g + " ") for g in greeting_terms):
        if is_km:
            return (
                "សួស្តីបាទ/ចាស! ខ្ញុំជាជំនួយការប្រព័ន្ធ AgriSystem (Model AGY V2.0.0) ដែលត្រូវបានបង្កើតឡើងក្រោមការដឹកនាំរបស់ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។\n\n"
                "ខ្ញុំនៅទីនេះដើម្បីជួយសម្រួលដល់ការប្រើប្រាស់ប្រព័ន្ធ AgriSystem របស់អ្នក។ អ្នកអាចសួរខ្ញុំអំពី៖\n"
                "- 🔍 របៀបប្រើប្រាស់ AI Diagnosis (ពិនិត្យតាមរូបថត)\n"
                "- 📋 របៀបប្រើប្រាស់ Rule-Based Diagnosis (ពិនិត្យតាមច្បាប់)\n"
                "- 📜 របៀបមើល និងទាញយកប្រវត្តិពិនិត្យ (History & PDF)\n"
                "- 💬 របៀបជជែកជាមួយអ្នកជំនាញកសិកម្ម (Ask Expert)\n"
                "- 🌦️ ការពិនិត្យអាកាសធាតុ និងដំបូន្មានកសិកម្ម (Weather)\n"
                "- ⚙️ ការគ្រប់គ្រងគណនី, Passkey, ការប្តូរភាសា និងម៉ូតងងឹត (Settings)\n"
                "- 💎 ការពិនិត្យ Credits និងការ Upgrade គណនី\n"
                "- 🛠️ ការផ្ញើសារទាក់ទង Admin (Contact Admin)\n\n"
                "តើថ្ងៃនេះខ្ញុំអាចជួយណែនាំអ្វីដល់លោកអ្នកបានខ្លះដែរ?"
            )
        return (
            "Hello! I am your AgriSystem Support Assistant (Model AGY V2.0.0), created under the leadership of Team Leader Mao Seavik.\n\n"
            "I'm here to help you navigate and get the most out of the AgriSystem platform. You can ask me about:\n"
            "- 🔍 How to use AI Diagnosis (photo upload)\n"
            "- 📋 How Rule-Based Diagnosis works\n"
            "- 📜 Viewing and downloading Diagnosis History & PDF reports\n"
            "- 💬 How to chat with specialists in Ask Expert\n"
            "- 🌦️ Using Weather & Soil advisory\n"
            "- ⚙️ Account profile, Passkeys, Language, and Dark Mode\n"
            "- 💎 Checking credits and upgrading your subscription\n"
            "- 🛠️ Submitting support tickets to administrators\n\n"
            "How can I assist you with the platform today?"
        )

    # 3. Identity
    identity_terms = (
        "who are you", "who created you", "who made you", "who developed you",
        "what is your name", "what is your model", "model name", "who is your leader",
        "team leader", "who is mao seavik", "about you",
        "តើអ្នកជាអ្នកណា", "អ្នកជាអ្នកណា", "តើអ្នកជាអ្វី", "អ្នកជាអ្វី", "អ្នកណាបង្កើត",
        "នរណាបង្កើត", "តើអ្នកណាបង្កើតអ្នក", "តើនរណាបង្កើតអ្នក", "តើម៉ូឌែលឈ្មោះអ្វី",
        "ម៉ូឌែលឈ្មោះអ្វី", "តើ ai នេះឈ្មោះអ្វី", "ប្រធានក្រុម", "ម៉ៅ សៀវអ៊ិ",
    )
    if any(term in msg for term in identity_terms):
        if is_km:
            return (
                "ខ្ញុំគឺជាជំនួយការប្រព័ន្ធ AgriSystem (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងក្រោមការដឹកនាំរបស់ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។\n\n"
                "តួនាទីរបស់ខ្ញុំគឺជួយគាំទ្រ និងណែនាំបងប្អូនកសិករ អ្នកជំនាញ និងអ្នកប្រើប្រាស់ទាំងអស់អំពីការប្រើប្រាស់គេហទំព័រ AgriSystem មុខងារពិនិត្យជំងឺ ការគ្រប់គ្រងគណនី និងការដោះស្រាយបញ្ហាបច្ចេកទេសនានា។"
            )
        return (
            "I am the AgriSystem Support Assistant (Model AGY V2.0.0), created and developed under the leadership of Team Leader Mao Seavik.\n\n"
            "My role is to guide farmers, experts, and administrators in using the AgriSystem platform, explaining tools like AI Diagnosis, Rule-Based Diagnosis, History, Weather, account security, and technical support."
        )

    # 4. AI Diagnosis (Photo Upload)
    if any(k in msg for k in ["how to diagnose", "upload photo", "upload", "take photo", "photo", "image", "picture", "ពិនិត្យជំងឺ", "របៀបពិនិត្យ", "ដាក់រូប", "បញ្ចូលរូប"]):
        if is_km:
            return (
                "របៀបប្រើប្រាស់ AI Image Diagnosis (ពិនិត្យជំងឺតាមរូបភាព)៖\n\n"
                "១. ចុចលើម៉ឺនុយ Diagnosis នៅលើរបារចំហៀង (/farmer/diagnose)។\n"
                "២. ជ្រើសរើសប្រភេទដំណាំរបស់អ្នក (ដូចជា ស្រូវ, ប៉េងប៉ោះ, ដំឡូងបារាំង, ពោត, ម្ទេស)។\n"
                "៣. ចុចលើប្រអប់ Upload Photo ឬអូសទម្លាក់រូបថតស្លឹក ឬផ្លែដែលសង្ស័យថាមានជំងឺ។ (សូមជ្រើសរើសរូបថតដែលច្បាស់ និងផ្តោតលើរោគសញ្ញាផ្ទាល់)។\n"
                "៤. ចុចប៊ូតុង Analyze Diagnosis (វិភាគ)។\n"
                "៥. ប្រព័ន្ធ AI នឹងបង្ហាញឈ្មោះជំងឺ កម្រិតភាគរយជឿជាក់ ព្រមទាំងរោគសញ្ញា វិធីព្យាបាល និងវិធានការការពារ។\n"
                "៦. អ្នកអាចមើលលទ្ធផលចាស់ៗឡើងវិញបានគ្រប់ពេលក្នុងទំព័រ Diagnosis History។"
            )
        return (
            "How to use AI Image Diagnosis:\n\n"
            "1. Click on Diagnosis in your sidebar or navigation menu (/farmer/diagnose).\n"
            "2. Select your crop (e.g. Rice, Tomato, Potato, Corn, Pepper).\n"
            "3. Click Upload Photo or drag & drop a clear photo of the infected leaf, stem, or fruit.\n"
            "4. Click Analyze Diagnosis.\n"
            "5. The AI will detect the disease, provide a confidence percentage, and list symptoms, chemical treatments, and prevention tips.\n"
            "6. You can review all previous diagnoses anytime in Diagnosis History."
        )

    # 5. Rule-Based Diagnosis
    if any(k in msg for k in ["rule based", "rule-based", "rule", "rules", "questionnaire", "without photo", "no photo", "វិនិច្ឆ័យតាមច្បាប់", "តាមច្បាប់", "ឆ្លើយសំណួរ", "សួរនាំ"]):
        if is_km:
            return (
                "Rule-Based Diagnosis (ការធ្វើរោគវិនិច្ឆ័យតាមច្បាប់) (/farmer/diagnose-rule-based)៖\n\n"
                "មុខងារនេះអនុញ្ញាតឱ្យអ្នកវិភាគរកជំងឺដំណាំតាមរយៈតក្កវិជ្ជាអ្នកជំនាញ ដោយមិនចាំបាច់មានរូបថតឡើយ៖\n"
                "១. ចូលទៅកាន់ម៉ឺនុយ Rule-Based Diagnosis។\n"
                "២. ជ្រើសរើសប្រភេទដំណាំរបស់អ្នក។\n"
                "៣. ប្រព័ន្ធនឹងសួរសំណួរអំពីរោគសញ្ញាជាក់ស្តែង (ដូចជា ពណ៌ចំណុចលើស្លឹក, ការស្រពោន, ស្លឹកក្រញង់)។\n"
                "៤. ឆ្លើយសំណួរនីមួយៗតាមអ្វីដែលអ្នកឃើញជាក់ស្តែងលើដំណាំក្នុងចម្ការ។\n"
                "៥. ប្រព័ន្ធឆ្លាតវៃនឹងផ្គូផ្គងច្បាប់កសិកម្មដើម្បីរកឈ្មោះជំងឺ និងផ្តល់វិធីសង្គ្រោះដំណាំយ៉ាងត្រឹមត្រូវ។"
            )
        return (
            "Rule-Based Diagnosis (/farmer/diagnose-rule-based):\n\n"
            "This feature allows you to diagnose crop diseases through proven expert logic without needing photos:\n"
            "1. Open Rule-Based Diagnosis in your menu.\n"
            "2. Select your crop.\n"
            "3. The system will guide you through symptom questions (e.g. leaf spot colors, wilting, leaf shape changes).\n"
            "4. Answer each question based on what you observe on your farm.\n"
            "5. The expert rule engine applies proven agricultural decision trees to pinpoint the exact disease and display verified treatment recommendations."
        )

    # 6. Diagnosis History & Reports
    if any(k in msg for k in ["history", "past diagnosis", "previous", "report", "pdf", "print", "export", "download", "ប្រវត្តិ", "របាយការណ៍", "ទាញយក"]):
        if is_km:
            return (
                "របៀបមើល និងទាញយកប្រវត្តិពិនិត្យជំងឺ (Diagnosis History)៖\n\n"
                "១. ចូលទៅកាន់ម៉ឺនុយ Diagnosis History (/farmer/diagnosis-history) ក្នុងរបារចំហៀង។\n"
                "២. អ្នកនឹងឃើញបញ្ជីរោគវិនិច្ឆ័យកន្លងមកទាំងអស់ រួមមានកាលបរិច្ឆេទ ដំណាំ ឈ្មោះជំងឺ និងកម្រិតភាគរយ។\n"
                "៣. ចុចលើ View Details ដើម្បីអានការណែនាំ និងវិធីព្យាបាលលម្អិត។\n"
                "៤. អ្នកអាចបោះពុម្ព (Print) ឬទាញយករបាយការណ៍ជាឯកសារ PDF ទុកជាកំណត់ត្រា ឬបង្ហាញដល់អ្នកជំនាញកសិកម្មក្នុងតំបន់បាន។"
            )
        return (
            "How to view and export Diagnosis History:\n\n"
            "1. Navigate to Diagnosis History (/farmer/diagnosis-history) in your sidebar.\n"
            "2. You will see a chronological list of all your past diagnoses with date, crop, disease name, and confidence score.\n"
            "3. Click View Details on any record to see full treatment and prevention guidance.\n"
            "4. You can also print or export your diagnosis report as a PDF for your records or to share with local agricultural extension officers."
        )

    # 7. Ask Expert / Chat
    if any(k in msg for k in ["ask expert", "consult", "human expert", "specialist", "chat with expert", "agronomist", "សួរអ្នកជំនាញ", "ជជែកជាមួយអ្នកជំនាញ"]):
        if is_km:
            return (
                "របៀបពិគ្រោះជាមួយអ្នកជំនាញកសិកម្ម (Ask Expert)៖\n\n"
                "១. ចូលទៅកាន់ទំព័រ Ask Expert (/farmer/chat) ពីម៉ឺនុយចំហៀង។\n"
                "២. សរសេរសំណួររបស់អ្នកអំពីស្ថានភាពចម្ការ ដី ជី ឬបញ្ហាជំងឺដំណាំ។\n"
                "៣. អ្នកអាចភ្ជាប់រូបថតជាក់ស្តែងក្នុងប្រអប់ជជែកបាន។\n"
                "៤. អ្នកជំនាញកសិកម្មពិតប្រាកដនឹងពិនិត្យ និងឆ្លើយតបដំបូន្មានបច្ចេកទេសជូនអ្នកក្នុងពេលឆាប់ៗ។"
            )
        return (
            "How to consult with agricultural specialists (Ask Expert):\n\n"
            "1. Open Ask Expert (/farmer/chat) from your sidebar.\n"
            "2. Type your question regarding your field conditions, crop symptoms, or soil management.\n"
            "3. You can attach field photos directly in the chat.\n"
            "4. Verified agricultural experts and agronomists will review your case and provide professional tailored advice."
        )

    # 8. Weather & Soil
    if any(k in msg for k in ["weather", "forecast", "rain", "climate", "temperature", "humidity", "soil", "អាកាសធាតុ", "ភ្លៀង", "ព្យាករណ៍"]):
        if is_km:
            return (
                "មុខងារអាកាសធាតុ និងដី (Weather & Soil Advisory) (/farmer/weather)៖\n\n"
                "- បង្ហាញស្ថានភាពអាកាសធាតុផ្ទាល់ក្នុងតំបន់របស់អ្នក សីតុណ្ហភាព សំណើម និងល្បឿនខ្យល់។\n"
                "- ផ្តល់ការព្យាករណ៍ទឹកភ្លៀងរយៈពេល ២៤ម៉ោងខាងមុខ និងការព្យាករណ៍ ៧ថ្ងៃ។\n"
                "- ផ្តល់អនុសាសន៍ជាក់ស្តែងសម្រាប់ចម្ការ ដូចជាពេលវេលាសមស្របសម្រាប់បាញ់ថ្នាំ និងការប្រុងប្រយ័ត្នក្នុងរដូវប្រាំង។"
            )
        return (
            "Weather & Soil Advisory (/farmer/weather):\n\n"
            "- Displays live local weather conditions, temperature, humidity, and wind speed.\n"
            "- Provides 24-hour rainfall predictions and 7-day extended forecasts.\n"
            "- Offers actionable farming recommendations (e.g. ideal spraying times, irrigation warnings, and dry-season precautions)."
        )

    # 9. Password, Profile & Passkeys
    if any(k in msg for k in ["profile", "password", "reset password", "change password", "passkey", "passkeys", "faceid", "touchid", "biometric", "account", "គណនី", "លេខសម្ងាត់", "ប្តូរលេខសម្ងាត់"]):
        if is_km:
            return (
                "ការគ្រប់គ្រងគណនី និងសុវត្ថិភាព៖\n\n"
                "- Profile (ព័ត៌មានផ្ទាល់ខ្លួន) (/farmer/profile)៖ កែប្រែឈ្មោះ លេខទូរស័ព្ទ ទីតាំងចម្ការ និងទំហំដីដាំដុះ។\n"
                "- ប្តូរលេខសម្ងាត់ (/farmer/settings)៖ ចូលទៅកាន់ Settings រួចស្វែងរកផ្នែក Security បញ្ចូលលេខសម្ងាត់ចាស់ និងលេខសម្ងាត់ថ្មី ហើយចុច Save Changes។\n"
                "- ចុះឈ្មោះ Passkey (TouchID / FaceID)៖ ក្នុងទំព័រ Settings ផ្នែក Passkeys សូមចុច Register Passkey ដើម្បីអាចចូលប្រើប្រព័ន្ធបានភ្លាមៗដោយគ្រាន់តែស្កេនម្រាមដៃ ឬផ្ទៃមុខ ដោយមិនចាំបាច់វាយលេខសម្ងាត់ឡើយ។"
            )
        return (
            "Account Management & Security:\n\n"
            "- Profile (/farmer/profile): Update your name, phone number, farm location, and farm size.\n"
            "- Change Password (/farmer/settings): Go to Settings, scroll to Security, enter your current password, type your new password, and click Save Changes.\n"
            "- Passkeys (TouchID / FaceID): Under Settings > Passkeys, click Register Passkey to enable fast passwordless biometric login with your device's fingerprint or face scan."
        )

    # 10. Language & Theme
    if any(k in msg for k in ["language", "khmer", "english", "dark mode", "light mode", "theme", "color", "ភាសា", "ប្តូរភាសា", "ម៉ូតងងឹត", "ពន្លឺ"]):
        if is_km:
            return (
                "ការប្តូរភាសា និងម៉ូតបង្ហាញ (Theme)៖\n\n"
                "- ប្តូរភាសា (Language)៖ ចុចលើប៊ូតុងប្តូរភាសា (KM / EN) នៅលើរបារខាងលើបង្អស់ ដើម្បីប្តូររវាងភាសាខ្មែរ និងអង់គ្លេសបានគ្រប់ពេលវេលា។\n"
                "- Dark Mode / Light Mode៖ ចុចលើរូប ព្រះច័ន្ទ / ព្រះអាទិត្យ នៅលើរបារខាងលើ ដើម្បីប្តូររវាងម៉ូតងងឹត និងម៉ូតពន្លឺតាមចំណូលចិត្ត។"
            )
        return (
            "Language & Display Theme:\n\n"
            "- Change Language: Click the language toggle button (KM / EN) in the top navigation bar to switch between Khmer and English anytime.\n"
            "- Dark Mode / Light Mode: Click the Sun / Moon icon in the top header to toggle between Dark Mode and Light Mode. Your preference is saved automatically."
        )

    # 11. Credits, Tokens, Bakong KHQR & Upgrade
    if any(k in msg for k in ["credit", "credits", "token", "tokens", "upgrade", "pro", "unlimited", "subscription", "price", "pricing", "plan", "cost", "bakong", "khqr", "payment", "កម្រៃ", "ដំឡើង", "ទិញ", "តម្លៃ", "បាគង", "បង់ប្រាក់"]):
        if is_km:
            return (
                "ចំនួន AI Credits និងការដំឡើងគណនី Pro តាមរយៈ Bakong KHQR (/farmer/upgrade)៖\n\n"
                "- គណនីឥតគិតថ្លៃទទួលបាន Token/Credits ប្រចាំថ្ងៃសម្រាប់ធ្វើរោគវិនិច្ឆ័យ និងសួរអ្នកជំនាញ AI។\n"
                "- ដើម្បីប្រើប្រាស់ដោយគ្មានដែនកំណត់ (Unlimited AI Analyses) សូមចូលទៅកាន់ទំព័រ Upgrade (/farmer/upgrade)។\n"
                "- អ្នកអាចស្កេនបង់ប្រាក់ភ្លាមៗតាមរយៈ NBC Bakong KHQR ពីកម្មវិធីធនាគារណាមួយក្នុងប្រទេសកម្ពុជា (ABA, ACLEDA, Wing, Bakong) ហើយប្រព័ន្ធនឹងផ្ទៀងផ្ទាត់ការបង់ប្រាក់ និងបើកដំណើរការគណនី Pro ដោយស្វ័យប្រវត្តិ។"
            )
        return (
            "AI Credits & Bakong KHQR Pro Upgrade (/farmer/upgrade):\n\n"
            "- Free accounts receive a daily AI credit quota for disease diagnoses and agricultural consultations.\n"
            "- To unlock Unlimited AI analyses and priority expert support, visit Upgrade (/farmer/upgrade).\n"
            "- Scan the generated NBC Bakong KHQR code using any Cambodian mobile banking app (ABA, ACLEDA, Wing, Bakong); the platform automatically verifies the transaction and activates your Pro subscription."
        )

    # 12. Project Team, Supervisor & Architecture / Tech Stack
    if any(
        k in msg
        for k in [
            "team", "member", "developer", "supervisor", "professor", "sek socheat",
            "cheavchhorng", "panha", "rachana", "architecture", "tech stack", "technology",
            "database", "flask", "react", "flutter", "about the project", "about project",
            "ក្រុម", "សមាជិក", "សាស្ត្រាចារ្យ", "សេក សុជាតិ", "ស្ថាបត្យកម្ម", "បច្ចេកវិទ្យា", "អំពីគម្រោង",
        ]
    ):
        if is_km:
            return (
                "ព័ត៌មានអំពីគម្រោង AgriSystem សមាជិកក្រុម និងស្ថាបត្យកម្មបច្ចេកទេស៖\n\n"
                "១. សាស្ត្រាចារ្យដឹកនាំគម្រោង (Project Supervisor)៖\n"
                "- សាស្ត្រាចារ្យ សេក សុជាតិ (Professor Sek Socheat) — អ្នកគ្រប់គ្រងគម្រោង និងទីប្រឹក្សាសិក្សា។\n\n"
                "២. សមាជិកក្រុមអភិវឌ្ឍន៍ (Development Team)៖\n"
                "- ម៉ៅ សៀវអ៊ិ (Mao Seavik) — ប្រធានក្រុម និង Backend Lead (Backend APIs, Rule-Based Diagnosis Engine, AI Model AGY V2.0.0 និង Weather Intelligence)\n"
                "- ជា ជៀវឈ័ង្ស (Chea Cheavchhorng) — Frontend & UI/UX Lead (Farmer Web Dashboard, React Diagnosis Wizard និង Responsive UI)\n"
                "- នៅ បញ្ញា (Nov Panha) — Mobile App Developer (Flutter Cross-Platform Mobile App និង Offline Caching)\n"
                "- ពេជ្រ រចនា (Pich Rachana) — Data & QA Specialist (ទិន្នន័យជំងឺដំណាំ និងរោគសញ្ញា, ការបកប្រែភាសាខ្មែរ និង System Testing)\n\n"
                "៣. ស្ថាបត្យកម្មបច្ចេកទេស (System Architecture)៖\n"
                "- Backend៖ Python 3.11 + Flask 3.1, SQLAlchemy, PyWebAuthn (Passkeys), Google OAuth 2.0 និង NBC Bakong KHQR។\n"
                "- Frontend & Mobile៖ React 18 + TypeScript + Tailwind CSS + Three.js និងកម្មវិធីទូរស័ព្ទ Flutter។\n"
                "- Database & AI៖ PostgreSQL (Neon) រួមជាមួយប្រព័ន្ធ Rule Engine និងម៉ូឌែល AI កសិកម្ម AGY V2.0.0។"
            )
        return (
            "AgriSystem Project Overview, Team & Technical Architecture:\n\n"
            "1. Project Supervisor:\n"
            "- Professor Sek Socheat — Project Supervisor & Academic Advisor.\n\n"
            "2. Development Team:\n"
            "- Mao Seavik — Team Leader & Backend Lead (Backend APIs, Rule-Based Diagnosis Engine, Custom AI Model AGY V2.0.0 & Weather Intelligence)\n"
            "- Chea Cheavchhorng — Frontend & UI/UX Lead (Farmer Web Dashboard, React Diagnosis Wizard, Theme Management & Responsive UI)\n"
            "- Nov Panha — Mobile App Developer (Flutter Cross-Platform Mobile App & Offline Caching)\n"
            "- Pich Rachana — Data & QA Specialist (Crop Disease & Symptom Rule Dataset Curation, Khmer Localization & QA Testing)\n\n"
            "3. System Architecture & Tech Stack:\n"
            "- Backend: Python 3.11 + Flask 3.1, SQLAlchemy ORM, WebAuthn Passkeys, Google OAuth 2.0, and NBC Bakong KHQR.\n"
            "- Frontend & Mobile: React 18 + TypeScript + Vite + Tailwind CSS + Three.js, and Flutter mobile app.\n"
            "- Database & AI: PostgreSQL (Neon) paired with a deterministic Forward-Chaining Rule Engine and custom fine-tuned model AGY V2.0.0."
        )

    # 13. Admin & Expert Portal Management
    if any(
        k in msg
        for k in [
            "admin portal", "manage user", "assign role", "audit log", "expert portal",
            "verify diagnosis", "confirm diagnosis", "manage disease", "configure rule",
            "គ្រប់គ្រងអ្នកប្រើប្រាស់", "កំណត់តួនាទី", "audit logs", "បន្ថែមជំងឺ", "ត្រួតពិនិត្យរោគវិនិច្ឆ័យ",
        ]
    ):
        if is_km:
            return (
                "ការគ្រប់គ្រងក្នុងផ្ទាំង Admin Portal និង Expert Portal៖\n\n"
                "១. សម្រាប់អ្នកគ្រប់គ្រងប្រព័ន្ធ (Admin Portal)៖\n"
                "- User Management (/admin/users)៖ គ្រប់គ្រងគណនីអ្នកប្រើប្រាស់ បិទ/បើកគណនី និងកំណត់តួនាទី (Farmer, Expert, Admin)។\n"
                "- Diseases & Rules (/admin/diseases, /admin/rules)៖ បន្ថែម ឬកែប្រែជំងឺដំណាំ រោគសញ្ញា និងក្បួនវិនិច្ឆ័យក្នុង Rule Engine។\n"
                "- Audit Logs (/admin/audit-logs)៖ ត្រួតពិនិត្យកំណត់ហេតុសុវត្ថិភាព និងសកម្មភាពប្រព័ន្ធ ព្រមទាំងទាញយកជា CSV/JSON។\n\n"
                "២. សម្រាប់អ្នកជំនាញកសិកម្ម (Expert Portal)៖\n"
                "- Diagnoses Review (/expert/diagnoses)៖ ពិនិត្យ និងអនុម័តលទ្ធផលវិនិច្ឆ័យរបស់កសិករ។\n"
                "- Knowledge Base (/expert/diseases)៖ ធ្វើបច្ចុប្បន្នភាពព័ត៌មានជំងឺ និងវិធីព្យាបាល។\n"
                "- Consultations (/expert/chats)៖ ឆ្លើយតបសំណួរកសិករតាមរយៈ Live Support។"
            )
        return (
            "Admin Portal & Expert Portal Workflows:\n\n"
            "1. Admin Portal:\n"
            "- User Management (/admin/users): Search accounts, activate/deactivate users, and assign Farmer, Expert, or Admin roles.\n"
            "- Diseases & Rules (/admin/diseases, /admin/rules): Add or edit crop diseases, symptoms, and forward-chaining diagnostic rules.\n"
            "- Security Audit Logs (/admin/audit-logs): Filter security events, sign-ins, and administrative actions with CSV/JSON export.\n\n"
            "2. Expert Portal:\n"
            "- Diagnoses Review (/expert/diagnoses): Inspect, verify, and add specialist notes to farmer diagnosis submissions.\n"
            "- Disease Knowledge Base (/expert/diseases): Maintain verified disease descriptions, treatments, and prevention tips.\n"
            "- Consultations (/expert/chats): Respond to farmers in real time via Live Support."
        )

    # 14. Contact Admin / Technical Issues
    if any(k in msg for k in ["contact admin", "support", "ticket", "issue", "bug", "broken", "help me admin", "error", "problem", "ទាក់ទង admin", "ជំនួយ", "បញ្ហា", "ខូច", "កំហុស"]):
        if is_km:
            return (
                "របៀបទាក់ទង Admin ឬរាយការណ៍បញ្ហាបច្ចេកទេស៖\n\n"
                "១. នៅក្នុងផ្ទាំង AI Helper នេះ សូមចុចលើផ្ទាំង Contact Admin (ទាក់ទងអ្នកគ្រប់គ្រង) នៅផ្នែកខាងលើ។\n"
                "២. សរសេររៀបរាប់អំពីបញ្ហាដែលអ្នកបានជួបប្រទះ (រួមទាំងឈ្មោះទំព័រ ឬសារកំហុស)។\n"
                "៣. ចុចប៊ូតុង Send to Admin (ផ្ញើទៅអ្នកគ្រប់គ្រង)។\n"
                "៤. ក្រុមការងារ Admin នឹងពិនិត្យសំណើរបស់អ្នក និងជួយដោះស្រាយជូនយ៉ាងឆាប់រហ័ស។"
            )
        return (
            "How to contact administrators or report a technical issue:\n\n"
            "1. In this AI Helper widget, click on the Contact Admin tab at the top.\n"
            "2. Describe the problem you experienced (include page name and error details).\n"
            "3. Click Send to Admin.\n"
            "4. Our administrator team will review your ticket and assist you promptly."
        )

    # 13. Default Fallback
    if is_km:
        return (
            "ខ្ញុំជាជំនួយការប្រព័ន្ធ AgriSystem ត្រៀមខ្លួនជានិច្ចក្នុងការជួយណែនាំពីរបៀបប្រើប្រាស់គេហទំព័រ និងមុខងារនានា។\n\n"
            "សូមប្រាប់ខ្ញុំអំពីទំព័រ ឬមុខងារដែលអ្នកចង់ឱ្យជួយ (ដូចជា ការពិនិត្យជំងឺ, Rule-Based Diagnosis, ប្រវត្តិពិនិត្យ, អាកាសធាតុ, ការកំណត់, ឬការ Upgrade)។ "
            "ប្រសិនបើមានបញ្ហាបច្ចេកទេស អ្នកក៏អាចចុចផ្ទាំង Contact Admin ខាងលើដើម្បីផ្ញើសាររាយការណ៍ទៅ Admin បានភ្លាមៗផងដែរ!"
        )
    return (
        "I am your AgriSystem Support Assistant, ready to help you navigate and use all features of the platform.\n\n"
        "Please tell me what page you are on or what feature you need assistance with (such as AI Diagnosis, Rule-Based Diagnosis, History, Weather, Settings, or Upgrades). "
        "If you are experiencing a technical issue, you can also use the Contact Admin tab above to report it directly to our team!"
    )


def _try_llm_support_reply(
    user_message: str,
    *,
    user_role: str,
    page: str,
    lang: str,
) -> str | None:
    """Optionally use general LLM (Gemini or OpenAI/Groq) if configured for flexible natural reply."""
    system_instruction = (
        "You are AgriSystem Support Assistant, the dedicated intelligent platform guide for the AgriSystem (Integrated Agricultural Expert System) web application. "
        "Your job is to assist users with system navigation, understanding features, account management, settings, subscriptions, and platform troubleshooting. "
        f"Answer in {'Khmer' if lang == 'km' else 'English'}. "
        "Please use a natural, friendly, and flexible voice, like a real person. "
        "DO NOT use markdown bold signs (**), asterisks (*), hashtags (###), or backticks (`) in your responses. Write clean, natural plain text without formatting symbols so that farmers and users see clean readable sentences without code symbols. "
        "Never answer crop disease diagnosis or chemical dosages yourself. If the user asks a crop disease question, politely direct them to the AI Diagnosis (/farmer/diagnose), Rule-Based Diagnosis (/farmer/diagnose-rule-based), or Ask Expert (/farmer/chat) tools. "
        f"User role: {user_role or 'user'}. Current page: {page or 'dashboard'}.\n\n"
        f"Reference Knowledge:\n{PROJECT_CONTEXT}"
    )

    # 1. Try Gemini Client
    try:
        from app.services.openai_assistant import _get_client

        gemini_client = _get_client()
        if gemini_client:
            response = gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{system_instruction}\n\nUser Question: {user_message}",
            )
            if response and response.text:
                return response.text.strip()
    except Exception:  # noqa: BLE001, S110
        pass

    # 2. Try OpenAI / Groq Client
    try:
        from app.services.openai_assistant import _get_openai_client

        openai_client = _get_openai_client()
        if openai_client:
            completion = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=600,
                temperature=0.7,
            )
            if completion and completion.choices:
                content = completion.choices[0].message.content
                if content:
                    return content.strip()
    except Exception:  # noqa: BLE001, S110
        pass

    return None


def generate_project_reply(
    user_message: str,
    *,
    user_role: str,
    page: str = "",
) -> str | None:
    """Generate system support assistance for the AgriSystem application."""
    if not user_message:
        return None

    lang = get_current_language()
    is_km = _is_khmer(user_message, lang)

    # Check if message is a direct crop query or matching standard support intent
    if _looks_like_crop_query(user_message):
        reply = _built_in_support_reply(user_message, is_km, user_role, page)
        return clean_markdown_symbols(reply)

    # Try flexible LLM response if external provider is active
    try:
        llm_reply = _try_llm_support_reply(
            user_message,
            user_role=user_role,
            page=page,
            lang="km" if is_km else "en",
        )
        if llm_reply and len(llm_reply.strip()) > 10:
            return clean_markdown_symbols(llm_reply.strip())
    except Exception as exc:  # noqa: BLE001
        try:
            current_app.logger.warning("LLM support assistant fallback: %s", exc)
        except Exception:  # noqa: BLE001, S110
            pass

    # Fallback to high-quality built-in system support knowledge
    reply = _built_in_support_reply(user_message, is_km, user_role, page)
    return clean_markdown_symbols(reply)
