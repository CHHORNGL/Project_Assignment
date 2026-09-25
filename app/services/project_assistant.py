"""AgriSystem Platform Support Assistant.

Dedicated intelligent guide for the AgriSystem (Integrated Agricultural Expert System)
web platform. Explains navigation, features, account settings, diagnoses, rule inference,
and support tickets in both English and Khmer.
"""

from __future__ import annotations

import re
from typing import Optional

from flask import current_app

from app.utils.i18n import get_current_language


PROJECT_CONTEXT = """Integrated Agricultural Expert System (AgriSystem) Platform Knowledge:
Created and developed under the leadership of Team Leader Mao Seavik.
Model: AGY V2.0.0.

Platform Roles & Navigation:
1. Farmer Portal:
   - Dashboard (/farmer/dashboard): Quick overview of farm stats, recent diagnoses, weather widget, remaining AI credits.
   - AI Diagnosis (/farmer/diagnose): Upload photos of crop leaves, stems, or fruits for automated AI disease detection, severity score, and treatment tips.
   - Rule-Based Diagnosis (/farmer/diagnose-rule-based): Step-by-step questionnaire decision tree to deduce crop diseases by answering guided symptom questions without uploading photos.
   - Diagnosis History (/farmer/diagnosis-history): Chronological log of past diagnoses with status, expert verification, and option to export or print PDF medical plant reports.
   - Ask Expert (/farmer/chat): Real-time chat with human agricultural specialists and agronomists with image attachment support.
   - Weather & Soil (/farmer/weather): Live localized weather, 24h rainfall prediction, 7-day forecast, humidity, and agronomic field advice.
   - News (/farmer/news): Agriculture news, market updates, and seasonal planting advice.
   - Profile (/farmer/profile): Manage farmer name, phone, farm location, and farm area.
   - Settings & Security (/farmer/settings): Change password, register biometric Passkeys (WebAuthn / TouchID / FaceID) for instant passwordless login.
   - Language & Theme: Top navbar switcher for Khmer (KM) and English (EN); Sun/Moon button for Light Mode / Dark Mode.
   - AI Credits & Upgrade (/farmer/upgrade): Free tier has daily quota; Pro and Unlimited plans provide unlimited AI analyses and priority expert reviews.
   - Contact Admin: Support tab inside this AI Helper widget or via support form to submit issue tickets directly to system administrators.

2. Expert Portal:
   - Dashboard (/expert/dashboard): Overview of assigned farmer cases.
   - Diagnoses Review (/expert/diagnoses): Verify and confirm farmer diagnosis submissions.
   - Disease Knowledge Base (/expert/diseases): Manage plant diseases and recommended treatments.
   - Consultations (/expert/chats): Chat directly with farmers.

3. Admin Portal:
   - Dashboard (/admin/dashboard): System metrics, active users, server health.
   - User Management (/admin/users): Manage accounts, activate/deactivate, assign roles.
   - Diseases & Rules (/admin/diseases, /admin/rules): Configure crop diseases, symptom rules, and decision trees.
   - Translations (/admin/translations): Manage bilingual English and Khmer content.
   - Audit Logs (/admin/audit-logs): View security and system activity logs.
   - Support Requests (/admin/support-requests): Review and resolve user support tickets.
   - Settings (/admin/settings): AI model configuration and site settings.

Core Policy:
- Answer only about using and navigating this AgriSystem application.
- If the user asks for crop disease diagnosis or chemical dosages, politely direct them to AI Diagnosis (/farmer/diagnose), Rule-Based Diagnosis (/farmer/diagnose-rule-based), or Ask Expert (/farmer/chat).
- Use a natural, friendly, and flexible voice, like a real person.
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


def _is_khmer(text: str, lang: Optional[str] = None) -> bool:
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
                "ខ្ញុំជា**ជំនួយការប្រព័ន្ធ AgriSystem**! ដើម្បីពិនិត្យជំងឺដំណាំ និងទទួលបានវិធីព្យាបាលយ៉ាងច្បាស់លាស់ សូមប្រើប្រាស់ឧបករណ៍លើប្រព័ន្ធដូចខាងក្រោម៖\n\n"
                "១. **AI Diagnosis (ពិនិត្យតាមរូបថត)**៖ ចូលទៅកាន់ម៉ឺនុយ **Diagnosis** រួចបញ្ចូលរូបថតស្លឹក ឬផ្លែ ហើយចុច **Analyze** ដើម្បីឱ្យ AI វិភាគជំងឺ និងកម្រិតភាគរយភ្លាមៗ។\n"
                "២. **Rule-Based Diagnosis (ពិនិត្យតាមច្បាប់)**៖ ចូលទៅកាន់ **Rule-Based Diagnosis** ដើម្បីឆ្លើយសំណួរអំពីរោគសញ្ញាជាជំហានៗ ដោយមិនចាំបាច់មានរូបថតឡើយ។\n"
                "៣. **Ask Expert (សួរអ្នកជំនាញ)**៖ ចូលទៅកាន់ **Ask Expert** ដើម្បីជជែកពិគ្រោះផ្ទាល់ជាមួយអ្នកជំនាញកសិកម្ម។\n\n"
                "តើខ្ញុំអាចជួយណែនាំពីរបៀបប្រើប្រាស់មុខងារណាមួយនៃប្រព័ន្ធ ឬបញ្ហាគណនីផ្សេងទៀតបានទេបាទ/ចាស?"
            )
        return (
            "I am your **AgriSystem Platform Support Assistant**! To diagnose plant diseases and receive treatment advice, please use our dedicated tools:\n\n"
            "1. **AI Image Diagnosis** (Photo Upload): Go to **Diagnosis** in your menu, upload clear photos of affected leaves or fruits, and click **Analyze** for instant AI detection.\n"
            "2. **Rule-Based Diagnosis** (Questionnaire): Open **Rule-Based Diagnosis** to answer guided symptom questions without needing a photo.\n"
            "3. **Ask Expert**: Open **Ask Expert** to consult directly with human agronomists.\n\n"
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
                "សួស្តីបាទ/ចាស! ខ្ញុំជា**ជំនួយការប្រព័ន្ធ AgriSystem** (Model AGY V2.0.0) ដែលត្រូវបានបង្កើតឡើងក្រោមការដឹកនាំរបស់ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)។\n\n"
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
            "Hello! I am your **AgriSystem Support Assistant** (Model AGY V2.0.0), created under the leadership of Team Leader Mao Seavik.\n\n"
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
                "ខ្ញុំគឺជា**ជំនួយការប្រព័ន្ធ AgriSystem** (ម៉ូឌែលឈ្មោះ AGY V2.0.0) ដែលត្រូវបានបង្កើត និងអភិវឌ្ឍឡើងក្រោមការដឹកនាំរបស់**ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Team Leader Mao Seavik)**។\n\n"
                "តួនាទីរបស់ខ្ញុំគឺជួយគាំទ្រ និងណែនាំបងប្អូនកសិករ អ្នកជំនាញ និងអ្នកប្រើប្រាស់ទាំងអស់អំពីការប្រើប្រាស់គេហទំព័រ AgriSystem មុខងារពិនិត្យជំងឺ ការគ្រប់គ្រងគណនី និងការដោះស្រាយបញ្ហាបច្ចេកទេសនានា។"
            )
        return (
            "I am the **AgriSystem Support Assistant** (Model AGY V2.0.0), created and developed under the leadership of **Team Leader Mao Seavik**.\n\n"
            "My role is to guide farmers, experts, and administrators in using the AgriSystem platform, explaining tools like AI Diagnosis, Rule-Based Diagnosis, History, Weather, account security, and technical support."
        )

    # 4. AI Diagnosis (Photo Upload)
    if any(k in msg for k in ["how to diagnose", "upload photo", "upload", "take photo", "photo", "image", "picture", "ពិនិត្យជំងឺ", "របៀបពិនិត្យ", "ដាក់រូប", "បញ្ចូលរូប"]):
        if is_km:
            return (
                "**របៀបប្រើប្រាស់ AI Image Diagnosis (ពិនិត្យជំងឺតាមរូបភាព)**៖\n\n"
                "១. ចុចលើម៉ឺនុយ **Diagnosis** នៅលើរបារចំហៀង (`/farmer/diagnose`)។\n"
                "២. ជ្រើសរើសប្រភេទដំណាំរបស់អ្នក (ដូចជា ស្រូវ, ប៉េងប៉ោះ, ដំឡូងបារាំង, ពោត, ម្ទេស)។\n"
                "៣. ចុចលើប្រអប់ **Upload Photo** ឬអូសទម្លាក់រូបថតស្លឹក ឬផ្លែដែលសង្ស័យថាមានជំងឺ។ (សូមជ្រើសរើសរូបថតដែលច្បាស់ និងផ្តោតលើរោគសញ្ញាផ្ទាល់)។\n"
                "៤. ចុចប៊ូតុង **Analyze Diagnosis (វិភាគ)**។\n"
                "៥. ប្រព័ន្ធ AI នឹងបង្ហាញឈ្មោះជំងឺ កម្រិតភាគរយជឿជាក់ ព្រមទាំងរោគសញ្ញា វិធីព្យាបាល និងវិធានការការពារ។\n"
                "៦. អ្នកអាចមើលលទ្ធផលចាស់ៗឡើងវិញបានគ្រប់ពេលក្នុងទំព័រ **Diagnosis History**។"
            )
        return (
            "**How to use AI Image Diagnosis**:\n\n"
            "1. Click on **Diagnosis** in your sidebar or navigation menu (`/farmer/diagnose`).\n"
            "2. Select your crop (e.g. Rice, Tomato, Potato, Corn, Pepper).\n"
            "3. Click **Upload Photo** or drag & drop a clear photo of the infected leaf, stem, or fruit.\n"
            "4. Click **Analyze Diagnosis**.\n"
            "5. The AI will detect the disease, provide a confidence percentage, and list symptoms, chemical treatments, and prevention tips.\n"
            "6. You can review all previous diagnoses anytime in **Diagnosis History**."
        )

    # 5. Rule-Based Diagnosis
    if any(k in msg for k in ["rule based", "rule-based", "rule", "rules", "questionnaire", "without photo", "no photo", "វិនិច្ឆ័យតាមច្បាប់", "តាមច្បាប់", "ឆ្លើយសំណួរ", "សួរនាំ"]):
        if is_km:
            return (
                "**Rule-Based Diagnosis (ការធ្វើរោគវិនិច្ឆ័យតាមច្បាប់)** (`/farmer/diagnose-rule-based`)៖\n\n"
                "មុខងារនេះអនុញ្ញាតឱ្យអ្នកវិភាគរកជំងឺដំណាំតាមរយៈតក្កវិជ្ជាអ្នកជំនាញ ដោយមិនចាំបាច់មានរូបថតឡើយ៖\n"
                "១. ចូលទៅកាន់ម៉ឺនុយ **Rule-Based Diagnosis**។\n"
                "២. ជ្រើសរើសប្រភេទដំណាំរបស់អ្នក។\n"
                "៣. ប្រព័ន្ធនឹងសួរសំណួរអំពីរោគសញ្ញាជាក់ស្តែង (ដូចជា ពណ៌ចំណុចលើស្លឹក, ការស្រពោន, ស្លឹកក្រញង់)។\n"
                "៤. ឆ្លើយសំណួរនីមួយៗតាមអ្វីដែលអ្នកឃើញជាក់ស្តែងលើដំណាំក្នុងចម្ការ។\n"
                "៥. ប្រព័ន្ធឆ្លាតវៃនឹងផ្គូផ្គងច្បាប់កសិកម្មដើម្បីរកឈ្មោះជំងឺ និងផ្តល់វិធីសង្គ្រោះដំណាំយ៉ាងត្រឹមត្រូវ។"
            )
        return (
            "**Rule-Based Diagnosis** (`/farmer/diagnose-rule-based`):\n\n"
            "This feature allows you to diagnose crop diseases through proven expert logic without needing photos:\n"
            "1. Open **Rule-Based Diagnosis** in your menu.\n"
            "2. Select your crop.\n"
            "3. The system will guide you through symptom questions (e.g. leaf spot colors, wilting, leaf shape changes).\n"
            "4. Answer each question based on what you observe on your farm.\n"
            "5. The expert rule engine applies proven agricultural decision trees to pinpoint the exact disease and display verified treatment recommendations."
        )

    # 6. Diagnosis History & Reports
    if any(k in msg for k in ["history", "past diagnosis", "previous", "report", "pdf", "print", "export", "download", "ប្រវត្តិ", "របាយការណ៍", "ទាញយក"]):
        if is_km:
            return (
                "**របៀបមើល និងទាញយកប្រវត្តិពិនិត្យជំងឺ (Diagnosis History)**៖\n\n"
                "១. ចូលទៅកាន់ម៉ឺនុយ **Diagnosis History** (`/farmer/diagnosis-history`) ក្នុងរបារចំហៀង។\n"
                "២. អ្នកនឹងឃើញបញ្ជីរោគវិនិច្ឆ័យកន្លងមកទាំងអស់ រួមមានកាលបរិច្ឆេទ ដំណាំ ឈ្មោះជំងឺ និងកម្រិតភាគរយ។\n"
                "៣. ចុចលើ **View Details** ដើម្បីអានការណែនាំ និងវិធីព្យាបាលលម្អិត។\n"
                "៤. អ្នកអាចបោះពុម្ព (Print) ឬទាញយករបាយការណ៍ជាឯកសារ PDF ទុកជាកំណត់ត្រា ឬបង្ហាញដល់អ្នកជំនាញកសិកម្មក្នុងតំបន់បាន។"
            )
        return (
            "**How to view and export Diagnosis History**:\n\n"
            "1. Navigate to **Diagnosis History** (`/farmer/diagnosis-history`) in your sidebar.\n"
            "2. You will see a chronological list of all your past diagnoses with date, crop, disease name, and confidence score.\n"
            "3. Click **View Details** on any record to see full treatment and prevention guidance.\n"
            "4. You can also print or export your diagnosis report as a PDF for your records or to share with local agricultural extension officers."
        )

    # 7. Ask Expert / Chat
    if any(k in msg for k in ["ask expert", "consult", "human expert", "specialist", "chat with expert", "agronomist", "សួរអ្នកជំនាញ", "ជជែកជាមួយអ្នកជំនាញ"]):
        if is_km:
            return (
                "**របៀបពិគ្រោះជាមួយអ្នកជំនាញកសិកម្ម (Ask Expert)**៖\n\n"
                "១. ចូលទៅកាន់ទំព័រ **Ask Expert** (`/farmer/chat`) ពីម៉ឺនុយចំហៀង។\n"
                "២. សរសេរសំណួររបស់អ្នកអំពីស្ថានភាពចម្ការ ដី ជី ឬបញ្ហាជំងឺដំណាំ។\n"
                "៣. អ្នកអាចភ្ជាប់រូបថតជាក់ស្តែងក្នុងប្រអប់ជជែកបាន។\n"
                "៤. អ្នកជំនាញកសិកម្មពិតប្រាកដនឹងពិនិត្យ និងឆ្លើយតបដំបូន្មានបច្ចេកទេសជូនអ្នកក្នុងពេលឆាប់ៗ។"
            )
        return (
            "**How to consult with agricultural specialists (Ask Expert)**:\n\n"
            "1. Open **Ask Expert** (`/farmer/chat`) from your sidebar.\n"
            "2. Type your question regarding your field conditions, crop symptoms, or soil management.\n"
            "3. You can attach field photos directly in the chat.\n"
            "4. Verified agricultural experts and agronomists will review your case and provide professional tailored advice."
        )

    # 8. Weather & Soil
    if any(k in msg for k in ["weather", "forecast", "rain", "climate", "temperature", "humidity", "soil", "អាកាសធាតុ", "ភ្លៀង", "ព្យាករណ៍"]):
        if is_km:
            return (
                "**មុខងារអាកាសធាតុ និងដី (Weather & Soil Advisory)** (`/farmer/weather`)៖\n\n"
                "- បង្ហាញស្ថានភាពអាកាសធាតុផ្ទាល់ក្នុងតំបន់របស់អ្នក សីតុណ្ហភាព សំណើម និងល្បឿនខ្យល់។\n"
                "- ផ្តល់ការព្យាករណ៍ទឹកភ្លៀងរយៈពេល ២៤ម៉ោងខាងមុខ និងការព្យាករណ៍ ៧ថ្ងៃ។\n"
                "- ផ្តល់អនុសាសន៍ជាក់ស្តែងសម្រាប់ចម្ការ ដូចជាពេលវេលាសមស្របសម្រាប់បាញ់ថ្នាំ និងការប្រុងប្រយ័ត្នក្នុងរដូវប្រាំង។"
            )
        return (
            "**Weather & Soil Advisory** (`/farmer/weather`):\n\n"
            "- Displays live local weather conditions, temperature, humidity, and wind speed.\n"
            "- Provides 24-hour rainfall predictions and 7-day extended forecasts.\n"
            "- Offers actionable farming recommendations (e.g. ideal spraying times, irrigation warnings, and dry-season precautions)."
        )

    # 9. Password, Profile & Passkeys
    if any(k in msg for k in ["profile", "password", "reset password", "change password", "passkey", "passkeys", "faceid", "touchid", "biometric", "account", "គណនី", "លេខសម្ងាត់", "ប្តូរលេខសម្ងាត់"]):
        if is_km:
            return (
                "**ការគ្រប់គ្រងគណនី និងសុវត្ថិភាព**៖\n\n"
                "- **Profile (ព័ត៌មានផ្ទាល់ខ្លួន)** (`/farmer/profile`)៖ កែប្រែឈ្មោះ លេខទូរស័ព្ទ ទីតាំងចម្ការ និងទំហំដីដាំដុះ។\n"
                "- **ប្តូរលេខសម្ងាត់** (`/farmer/settings`)៖ ចូលទៅកាន់ **Settings** រួចស្វែងរកផ្នែក **Security** បញ្ចូលលេខសម្ងាត់ចាស់ និងលេខសម្ងាត់ថ្មី ហើយចុច **Save Changes**។\n"
                "- **ចុះឈ្មោះ Passkey (TouchID / FaceID)**៖ ក្នុងទំព័រ Settings ផ្នែក Passkeys សូមចុច **Register Passkey** ដើម្បីអាចចូលប្រើប្រព័ន្ធបានភ្លាមៗដោយគ្រាន់តែស្កេនម្រាមដៃ ឬផ្ទៃមុខ ដោយមិនចាំបាច់វាយលេខសម្ងាត់ឡើយ។"
            )
        return (
            "**Account Management & Security**:\n\n"
            "- **Profile** (`/farmer/profile`): Update your name, phone number, farm location, and farm size.\n"
            "- **Change Password** (`/farmer/settings`): Go to **Settings**, scroll to **Security**, enter your current password, type your new password, and click **Save Changes**.\n"
            "- **Passkeys (TouchID / FaceID)**: Under Settings > Passkeys, click **Register Passkey** to enable fast passwordless biometric login with your device's fingerprint or face scan."
        )

    # 10. Language & Theme
    if any(k in msg for k in ["language", "khmer", "english", "dark mode", "light mode", "theme", "color", "ភាសា", "ប្តូរភាសា", "ម៉ូតងងឹត", "ពន្លឺ"]):
        if is_km:
            return (
                "**ការប្តូរភាសា និងម៉ូតបង្ហាញ (Theme)**៖\n\n"
                "- **ប្តូរភាសា (Language)**៖ ចុចលើប៊ូតុងប្តូរភាសា (`KM` / `EN`) នៅលើរបារខាងលើបង្អស់ ដើម្បីប្តូររវាងភាសាខ្មែរ និងអង់គ្លេសបានគ្រប់ពេលវេលា។\n"
                "- **Dark Mode / Light Mode**៖ ចុចលើរូប **ព្រះច័ន្ទ / ព្រះអាទិត្យ** នៅលើរបារខាងលើ ដើម្បីប្តូររវាងម៉ូតងងឹត និងម៉ូតពន្លឺតាមចំណូលចិត្ត។"
            )
        return (
            "**Language & Display Theme**:\n\n"
            "- **Change Language**: Click the language toggle button (`KM` / `EN`) in the top navigation bar to switch between Khmer and English anytime.\n"
            "- **Dark Mode / Light Mode**: Click the **Sun / Moon** icon in the top header to toggle between Dark Mode and Light Mode. Your preference is saved automatically."
        )

    # 11. Credits, Tokens & Upgrade
    if any(k in msg for k in ["credit", "credits", "token", "tokens", "upgrade", "pro", "unlimited", "subscription", "price", "pricing", "plan", "cost", "កម្រៃ", "ដំឡើង", "ទិញ", "តម្លៃ"]):
        if is_km:
            return (
                "**ចំនួន AI Credits និងគម្រោងគណនី (Upgrade)**៖\n\n"
                "- គណនីឥតគិតថ្លៃទទួលបាន Token/Credits ប្រចាំថ្ងៃសម្រាប់ធ្វើរោគវិនិច្ឆ័យ និងជជែកជាមួយ AI។\n"
                "- អ្នកអាចពិនិត្យសមតុល្យ Credits ដែលនៅសល់នៅលើផ្នែកខាងលើនៃ **Dashboard** របស់អ្នក។\n"
                "- ដើម្បីប្រើប្រាស់ដោយគ្មានដែនកំណត់ (Unlimited AI Analyses) និងទទួលបានការពិគ្រោះជាមួយអ្នកជំនាញជាអាទិភាព សូមចូលទៅកាន់ទំព័រ **Upgrade** (`/farmer/upgrade`) ដើម្បីដំឡើងគណនី។"
            )
        return (
            "**AI Credits & Plan Upgrades**:\n\n"
            "- Every free account receives daily AI credits for disease diagnoses and expert chats.\n"
            "- You can view your remaining credit balance anytime at the top of your **Dashboard**.\n"
            "- To unlock **Unlimited** AI analyses, priority expert reviews, and advanced weather forecasts, visit **Upgrade** (`/farmer/upgrade`) and select a premium tier."
        )

    # 12. Contact Admin / Technical Issues
    if any(k in msg for k in ["contact admin", "support", "ticket", "issue", "bug", "broken", "help me admin", "error", "problem", "ទាក់ទង admin", "ជំនួយ", "បញ្ហា", "ខូច", "កំហុស"]):
        if is_km:
            return (
                "**របៀបទាក់ទង Admin ឬរាយការណ៍បញ្ហាបច្ចេកទេស**៖\n\n"
                "១. នៅក្នុងផ្ទាំង **AI Helper** នេះ សូមចុចលើផ្ទាំង **Contact Admin (ទាក់ទងអ្នកគ្រប់គ្រង)** នៅផ្នែកខាងលើ។\n"
                "២. សរសេររៀបរាប់អំពីបញ្ហាដែលអ្នកបានជួបប្រទះ (រួមទាំងឈ្មោះទំព័រ ឬសារកំហុស)។\n"
                "៣. ចុចប៊ូតុង **Send to Admin (ផ្ញើទៅអ្នកគ្រប់គ្រង)**។\n"
                "៤. ក្រុមការងារ Admin នឹងពិនិត្យសំណើរបស់អ្នក និងជួយដោះស្រាយជូនយ៉ាងឆាប់រហ័ស។"
            )
        return (
            "**How to contact administrators or report a technical issue**:\n\n"
            "1. In this **AI Helper** widget, click on the **Contact Admin** tab at the top.\n"
            "2. Describe the problem you experienced (include page name and error details).\n"
            "3. Click **Send to Admin**.\n"
            "4. Our administrator team will review your ticket and assist you promptly."
        )

    # 13. Default Fallback
    if is_km:
        return (
            "ខ្ញុំជា**ជំនួយការប្រព័ន្ធ AgriSystem** ត្រៀមខ្លួនជានិច្ចក្នុងការជួយណែនាំពីរបៀបប្រើប្រាស់គេហទំព័រ និងមុខងារនានា។\n\n"
            "សូមប្រាប់ខ្ញុំអំពីទំព័រ ឬមុខងារដែលអ្នកចង់ឱ្យជួយ (ដូចជា ការពិនិត្យជំងឺ, Rule-Based Diagnosis, ប្រវត្តិពិនិត្យ, អាកាសធាតុ, ការកំណត់, ឬការ Upgrade)។ "
            "ប្រសិនបើមានបញ្ហាបច្ចេកទេស អ្នកក៏អាចចុចផ្ទាំង **Contact Admin** ខាងលើដើម្បីផ្ញើសាររាយការណ៍ទៅ Admin បានភ្លាមៗផងដែរ!"
        )
    return (
        "I am your **AgriSystem Support Assistant**, ready to help you navigate and use all features of the platform.\n\n"
        "Please tell me what page you are on or what feature you need assistance with (such as AI Diagnosis, Rule-Based Diagnosis, History, Weather, Settings, or Upgrades). "
        "If you are experiencing a technical issue, you can also use the **Contact Admin** tab above to report it directly to our team!"
    )


def _try_llm_support_reply(
    user_message: str,
    *,
    user_role: str,
    page: str,
    lang: str,
) -> Optional[str]:
    """Optionally use general LLM (Gemini or OpenAI/Groq) if configured for flexible natural reply."""
    system_instruction = (
        "You are AgriSystem Support Assistant, the dedicated intelligent platform guide for the AgriSystem (Integrated Agricultural Expert System) web application. "
        "Your job is to assist users with system navigation, understanding features, account management, settings, subscriptions, and platform troubleshooting. "
        f"Answer in {'Khmer' if lang == 'km' else 'English'}. "
        "Please use a natural, friendly, and flexible voice, like a real person. "
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
    except Exception:
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
    except Exception:
        pass

    return None


def generate_project_reply(
    user_message: str,
    *,
    user_role: str,
    page: str = "",
) -> Optional[str]:
    """Generate system support assistance for the AgriSystem application."""
    if not user_message:
        return None

    lang = get_current_language()
    is_km = _is_khmer(user_message, lang)

    # Check if message is a direct crop query or matching standard support intent
    if _looks_like_crop_query(user_message):
        return _built_in_support_reply(user_message, is_km, user_role, page)

    # Try flexible LLM response if external provider is active
    try:
        llm_reply = _try_llm_support_reply(
            user_message,
            user_role=user_role,
            page=page,
            lang="km" if is_km else "en",
        )
        if llm_reply and len(llm_reply.strip()) > 10:
            return llm_reply.strip()
    except Exception as exc:
        try:
            current_app.logger.warning("LLM support assistant fallback: %s", exc)
        except Exception:
            pass

    # Fallback to high-quality built-in system support knowledge
    return _built_in_support_reply(user_message, is_km, user_role, page)
