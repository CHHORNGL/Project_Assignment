import subprocess
from pathlib import Path

html_content = """<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="utf-8">
<title>AgriSystem Presentation Summary - Khmer</title>
<style>
@page {
    size: A4 portrait;
    margin: 12mm 16mm 12mm 16mm;
}
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}
body {
    background-color: #ffffff;
    color: #1e293b;
    font-family: "Khmer OS Battambang", "Hanuman", "Noto Sans Khmer", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

/* Document Header */
.doc-header {
    border-bottom: 2px solid #0284c7;
    padding-bottom: 8px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}
.header-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.badge {
    display: inline-block;
    background: #e0f2fe;
    color: #0369a1;
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 9px;
    border-radius: 9999px;
    width: fit-content;
    margin-bottom: 2px;
    border: 1px solid #bae6fd;
}
.doc-title {
    font-size: 19px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.25;
}
.doc-subtitle {
    font-size: 11.5px;
    color: #64748b;
}
.header-meta {
    text-align: right;
    font-size: 10.5px;
    color: #64748b;
    line-height: 1.35;
}

/* Headings */
h2 {
    font-size: 14.5px;
    font-weight: 800;
    color: #0369a1;
    margin-top: 10px;
    margin-bottom: 5px;
    padding-bottom: 3px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    gap: 6px;
}
h3 {
    font-size: 12.5px;
    font-weight: 700;
    color: #0f766e;
    margin-top: 6px;
    margin-bottom: 3px;
}

p {
    margin-bottom: 5px;
    color: #334155;
    text-align: justify;
}

/* Bullet list */
ul.bullet-list {
    list-style: none;
    margin-bottom: 6px;
    display: flex;
    flex-direction: column;
    gap: 3.5px;
}
ul.bullet-list li {
    position: relative;
    padding-left: 15px;
    color: #334155;
    font-size: 11.8px;
}
ul.bullet-list li::before {
    content: "•";
    position: absolute;
    left: 3px;
    top: -1px;
    color: #0284c7;
    font-weight: bold;
    font-size: 14px;
}
ul.bullet-list li strong {
    color: #0f172a;
}

/* Callout Box */
.callout {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #0284c7;
    border-radius: 6px;
    padding: 7px 12px;
    margin: 7px 0;
    font-size: 11.5px;
    line-height: 1.45;
}
.callout.green {
    background: #f0fdf4;
    border-color: #bbf7d0;
    border-left-color: #16a34a;
}
.callout.amber {
    background: #fffbeb;
    border-color: #fde68a;
    border-left-color: #d97706;
}
.callout-title {
    font-weight: 700;
    font-size: 12px;
    margin-bottom: 3px;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 6px;
}

/* Formula */
.formula {
    background: #0f172a;
    color: #f8fafc;
    padding: 7px 12px;
    border-radius: 6px;
    font-family: Consolas, monospace;
    font-size: 11px;
    margin: 5px 0;
    text-align: center;
    letter-spacing: 0.4px;
}

/* Table */
table.data-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 11px;
}
table.data-table th {
    background: #f1f5f9;
    color: #0f172a;
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    font-weight: 700;
    text-align: left;
}
table.data-table td {
    padding: 5px 8px;
    border: 1px solid #e2e8f0;
    color: #334155;
    vertical-align: top;
    line-height: 1.35;
}
table.data-table tr:nth-child(even) {
    background: #f8fafc;
}

/* Footer */
.doc-footer {
    margin-top: 14px;
    border-top: 1px solid #e2e8f0;
    padding-top: 6px;
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    color: #94a3b8;
}

.page-break {
    page-break-before: always;
    break-before: page;
}
</style>
</head>
<body>

<!-- PAGE 1: EXPERT SYSTEM KNOWLEDGE BASE -->
<div class="doc-header">
    <div class="header-left">
        <span class="badge">🌾 ប្រព័ន្ធកសិកម្មឆ្លាតវៃ • AGY V2.0.0</span>
        <h1 class="doc-title">សេចក្តីសង្ខេបគម្រោង៖ ប្រព័ន្ធអ្នកជំនាញ និង ភ្នាក់ងារ AI</h1>
        <div class="doc-subtitle">ឯកសារជំនួយស្មារតីសម្រាប់បទបង្ហាញជូនថ្នាក់ដឹកនាំ (Manager Presentation Brief)</div>
    </div>
    <div class="header-meta">
        <div><strong>អ្នកដឹកនាំបច្ចេកទេស៖</strong> ម៉ៅ សៀវអ៊ិ (Mao Seavik)</div>
        <div><strong>គម្រោង៖</strong> AgriSystem (Project_Assignment)</div>
        <div><strong>កាលបរិច្ឆេទ៖</strong> ខែកញ្ញា ឆ្នាំ២០២៦</div>
    </div>
</div>

<div class="callout green">
    <div class="callout-title">💡 គោលបំណងចម្បងនៃគម្រោង (Project Mission)</div>
    ជួយដោះស្រាយបញ្ហាការខូចខាតទិន្នផលដំណាំរបស់កសិករកម្ពុជា (៣០% ទៅ ៥០%) ដោយសារការយល់ដឹងទាប និងភាពខ្វះខាតអ្នកជំនាញកសិកម្ម។ យើងបានបង្កើតប្រព័ន្ធរួមបញ្ចូលគ្នារវាង <strong>ប្រព័ន្ធអ្នកជំនាញ (Expert System)</strong> ដែលធានាសុវត្ថិភាពវេជ្ជសាស្ត្រដំណាំ ១០០% និង <strong>ភ្នាក់ងារឆ្លាតវៃ (AI Agent)</strong> ដែលអាចជជែកពិគ្រោះជាភាសាខ្មែរយ៉ាងរលូន។
</div>

<h2>១. មូលដ្ឋានចំណេះដឹងនៃប្រព័ន្ធអ្នកជំនាញ (Expert System Knowledge Base)</h2>
<p>
    ប្រព័ន្ធអ្នកជំនាញ គឺជាស្នូលនៃភាពត្រឹមត្រូវខាងបច្ចេកទេសកសិកម្ម។ វាដំណើរការដោយផ្អែកលើច្បាប់ក្បួន និងរូបមន្តគណិតវិទ្យាជាក់ស្តែង <strong>ដោយគ្មានការប្រឌិតចម្លើយភូតកុហក (0% Hallucination)</strong> ដូច AI ភាសាទូទៅឡើយ។
</p>

<h3>ក. រចនាសម្ព័ន្ធទិន្នន័យ (Database Schema & Knowledge Base)</h3>
<ul class="bullet-list">
    <li><strong>ដំណាំកសិកម្មគោល (៨ មុខ)៖</strong> ស្រូវ, ដំឡូងបារាំង, ប៉េងប៉ោះ, ត្រសក់, ម្ទេស, ចេក, ពោត និងដំឡូងមី ដោយមានការកត់ត្រាឈ្មោះខ្មែរ និងលក្ខណៈរុក្ខសាស្ត្រច្បាស់លាស់។</li>
    <li><strong>ជំងឺដំណាំដែលបានកត់ត្រា (១២៦ មុខ)៖</strong> បែងចែកជា ៥ ប្រភេទ៖ ជំងឺផ្សិត (Fungal 55 មុខ), សត្វល្អិតចង្រៃ (Pest 32 មុខ), ជំងឺបាក់តេរី (Bacterial 15 មុខ), ជំងឺវីរុស (Viral 13 មុខ) និងកង្វះជីវជាតិ (Nutrient 11 មុខ)។</li>
    <li><strong>វិធានវិនិច្ឆ័យ (Rules & Symptoms)៖</strong> មានវិធានវិនិច្ឆ័យជាង ២៥០ ភ្ជាប់រោគសញ្ញារូបវន្តជាក្រុម ទៅនឹងជំងឺនីមួយៗ ព្រមទាំងមានកម្រិតទំនុកចិត្តរបស់អ្នកជំនាញ (Expert Baseline Confidence)។</li>
</ul>

<h3>ខ. រូបមន្តគណនាពិន្ទុវិនិច្ឆ័យជំងឺ (Rule Scoring Algorithm)</h3>
<div class="formula">
    Score = (0.60 × Coverage) + (0.20 × Precision) + (0.20 × Expert_Conf) - (0.45 × Contradiction_Penalty) ± Category_Adj
</div>
<ul class="bullet-list">
    <li><strong>Coverage (៦០%)៖</strong> រាប់ចំនួនរោគសញ្ញាក្នុងវិធានដែលកសិករបានជួបប្រទះ (Matched Symptoms / Total Rule Symptoms)។</li>
    <li><strong>Precision (២០%)៖</strong> វាស់ស្ទង់ភាពជាក់លាក់ ដើម្បីកុំឱ្យកសិករចេះតែរើសរោគសញ្ញាច្រើនហួសហេតុ។</li>
    <li><strong>Contradiction Penalty (-៤៥%)៖</strong> <strong>ចំណុចពិសេសបំផុត!</strong> ប្រសិនបើកសិករបញ្ជាក់ថាមិនមានរោគសញ្ញាស្នូលណាមួយ (ឧទាហរណ៍៖ មិនមានទឹករំអិលបាក់តេរី) ពិន្ទុជំងឺបាក់តេរីនឹងត្រូវកាត់បន្ថយ ៤៥% ភ្លាមៗ ដើម្បីចៀសវាងការវិនិច្ឆ័យខុស (False Positive)។</li>
    <li><strong>កម្រិតទំនុកចិត្ត (Tiers)៖</strong> High (≥ ៧៥%), Medium (៥៥%–៧៤%), Low (៣៥%–៥៤%), Insufficient (< ៣៥%)។</li>
</ul>

<h3>គ. ផ្ទាំងវិនិច្ឆ័យសម្របសម្រួល (Adaptive Clarification Wizard)</h3>
<ul class="bullet-list">
    <li><strong>កម្រិតសំណួរ ៥ ទៅ ៧ ប៉ុណ្ណោះ៖</strong> កសិករជនបទមិនអាចឆ្លើយសំណួរច្រើនបានទេ។ ប្រព័ន្ធប្រើក្បួន Adaptive algorithm ជ្រើសរើសសួរសំណួរ បាទ/ទេ ណាដែលផ្តល់ព័ត៌មានច្រើនបំផុតដើម្បីកាត់ផ្តាច់ជំងឺដទៃទៀត។</li>
    <li><strong>ភស្តុតាងជាក់ស្តែង (Explainable Evidence)៖</strong> បង្ហាញលទ្ធផលច្បាស់លាស់៖ រោគសញ្ញាត្រូវគ្នា, រោគសញ្ញាដែលខ្វះ, ភាគរយទំនុកចិត្ត ព្រមទាំងថ្នាំព្យាបាល និងការការពារយូរអង្វែង។</li>
</ul>

<div class="doc-footer">
    <div>AgriSystem (Project_Assignment) • ឯកសារជំនួយស្មារតីបទបង្ហាញ (ទំព័រទី ១)</div>
    <div>រៀបចំដោយ៖ ម៉ៅ សៀវអ៊ិ និងក្រុមការងារវិស្វកម្ម • ថ្ងៃទី២៥ ខែកញ្ញា ឆ្នាំ២០២៦</div>
</div>

<!-- PAGE 2: AI AGENT, COMPARISON & TALKING POINTS -->
<div class="page-break"></div>

<div class="doc-header" style="margin-bottom: 8px;">
    <div class="header-left">
        <span class="badge">🤖 ភ្នាក់ងារឆ្លាតវៃ AI Agent • AGY V2.0.0</span>
        <h1 class="doc-title" style="font-size: 17px;">ភ្នាក់ងារ AI ការបង្វឹក AI Train និងយុទ្ធសាស្ត្រធ្វើបទបង្ហាញ</h1>
    </div>
    <div class="header-meta">
        <div><strong>គម្រោង៖</strong> AgriSystem</div>
        <div>ទំព័រទី ២</div>
    </div>
</div>

<h2>២. ភ្នាក់ងារឆ្លាតវៃ AI Agent និងការបង្វឹក AI Train (AI Train Pipeline)</h2>
<p>
    ដើម្បីជួយសម្រួលដល់កសិករដែលចង់ជជែកសាកសួរផ្ទាល់ជាភាសាខ្មែរ យើងបានបង្កើត និងបង្វឹកភ្នាក់ងារ AI ដោយផ្ទាល់ដៃ ឈ្មោះថា <strong>AgriSystem AI (ម៉ូឌែល AGY V2.0.0)</strong>។
</p>

<h3>ក. ស្រទាប់គ្រប់គ្រងសុវត្ថិភាព (Controlled Agent Layer - agri_agent.py)</h3>
<ul class="bullet-list">
    <li><strong>ការវិភាគបំណងជាមុន (Intent Planning)៖</strong> មុននឹង AI ឆ្លើយ ប្រព័ន្ធវិភាគជាមុនថាតើសំណួរជា៖ អាកាសធាតុ (Weather), ជំងឺដំណាំ (Crop Health), ការវិភាគដី/ជី (Insights), ការស្វាគមន៍ (Greeting) ឬការជជែកលេងលើកទឹកចិត្ត (Casual Talk)។</li>
    <li><strong>ឧបករណ៍សុវត្ថិភាព (Trusted Tools)៖</strong> AI ត្រូវបានភ្ជាប់ជាមួយ Database ជំងឺកសិកម្ម និង Open-Meteo Weather API។ AI មិនត្រូវបានអនុញ្ញាតឱ្យប្រឌិតកម្រិតថ្នាំគីមី ឬកែប្រែទិន្នន័យក្នុងប្រព័ន្ធដោយគ្មានការបញ្ជាក់ឡើយ។</li>
</ul>

<h3>ខ. ទិន្នន័យបង្វឹក AI Train និងបច្ចេកទេស QLoRA</h3>
<ul class="bullet-list">
    <li><strong>ទិន្នន័យបង្វឹក (២,៩៣៧ កម្រង)៖</strong> Training ២,៣៤៣ (៨០%), Validation ៥៩៤ (២០%) ដោយគ្មានការត្រួតស៊ីគ្នា (Zero Overlap SHA-256)។ គ្របដណ្តប់លើជំងឺដំណាំ (២,៥២០), វិធានវិនិច្ឆ័យ (២៥២), ដី/ជី NPK (១៦), និងការសន្ទនាលើកទឹកចិត្តកសិករ (៣០)។</li>
    <li><strong>ម៉ូឌែលគោល និង QLoRA៖</strong> ប្រើ <code>Qwen/Qwen2.5-3B-Instruct</code> បង្រួមជា 4-bit NF4 ដោយប្រើ LoRA Rank r=32, Alpha=64 លើ Projection Matrices ទាំង ៧។ បង្វឹកបានជោគជ័យត្រឹមតែ ២៨ នាទីលើ Google Colab GPU ឥតគិតថ្លៃ។</li>
    <li><strong>ការដាក់ឱ្យដំណើរការ និងប្រព័ន្ធជំនួយ៖</strong> រក្សាទុកលើ Hugging Face Hub (<code>Maoseavik/agri-qwen3b-lora</code>) និងដំណើរការលើ Space (<code>Maoseavik/agrisystem-agricultural-assistant</code>)។ ប្រសិនបើដាច់អ៊ីនធឺណិត មាន Local Fallback ឆ្លើយចេញពី Database ភ្លាមៗ ១០០% ជានិច្ច។</li>
</ul>

<h2>៣. ការប្រៀបធៀប៖ ហេតុអ្វីត្រូវមានទាំង Expert System និង AI Agent?</h2>
<table class="data-table">
    <thead>
        <tr>
            <th style="width: 20%;">លក្ខណៈវិនិច្ឆ័យ</th>
            <th style="width: 40%;">១. Expert System (មូលដ្ឋានច្បាប់)</th>
            <th style="width: 40%;">២. AI Agent (ម៉ូឌែល AGY V2.0.0)</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>តួនាទីចម្បង</strong></td>
            <td>ធ្វើរោគវិនិច្ឆ័យផ្លូវការ និងកំណត់ថ្នាំព្យាបាលត្រឹមត្រូវ</td>
            <td>ជជែក ពិគ្រោះយោបល់ និងពន្យល់កសិករជាភាសាខ្មែរ</td>
        </tr>
        <tr>
            <td><strong>ក្បួនដំណើរការ</strong></td>
            <td>រូបមន្តគណិតវិទ្យា និងតក្កវិជ្ជា Forward Chaining</td>
            <td>បណ្តាញប្រសាទសិប្បនិម្មិត Qwen2.5-3B + QLoRA</td>
        </tr>
        <tr>
            <td><strong>ហានិភ័យភូតកុហក</strong></td>
            <td><strong>០.០% (មិនអាចប្រឌិតខុសបានឡើយ)</strong></td>
            <td>ទាបបំផុត (គ្រប់គ្រងដោយ Tool Gating)</td>
        </tr>
        <tr>
            <td><strong>ការប្រើប្រាស់</strong></td>
            <td>ចុចឆ្លើយសំណួរ បាទ/ទេ ៥–៧ សំណួរក្នុង Wizard</td>
            <td>វាយជាអក្សរ ឬជជែកសួរនាំតាមធម្មជាតិ</td>
        </tr>
        <tr>
            <td><strong>ការបកស្រាយ</strong></td>
            <td>បង្ហាញរោគសញ្ញាត្រូវ/ខ្វះ និងភាគរយច្បាស់លាស់</td>
            <td>ពន្យល់ជាពាក្យពេចន៍ងាយយល់ និងទន់ភ្លន់</td>
        </tr>
    </tbody>
</table>

<h2>៤. ចំណុចគន្លឹះសម្រាប់ធ្វើបទបង្ហាញជូនអ្នកគ្រប់គ្រង (Talking Points)</h2>
<div class="callout amber">
    <ul class="bullet-list">
        <li><strong>១. ប្រព័ន្ធរួចរាល់សម្រាប់ផលិតកម្ម៖</strong> យើងបានបំបែក Server ជាពីរ (Web Server និង AI Server) ធ្វើឱ្យចំណេញថ្លៃ Cloud Server យ៉ាងច្រើន និងមិនចាំបាច់ទិញ Server GPU ថ្លៃៗឡើយ។</li>
        <li><strong>២. សុវត្ថិភាពវេជ្ជសាស្ត្រដំណាំខ្ពស់បំផុត៖</strong> ការណែនាំថ្នាំគីមីមិនពឹងលើការស្មានរបស់ AI ឡើយ គឺពឹងលើ Expert System ដែលមានការផ្ទៀងផ្ទាត់ដោយអ្នកជំនាញកសិកម្ម ១០០%។</li>
        <li><strong>៣. បង្កើតឡើងសម្រាប់កសិករខ្មែរពិតប្រាកដ៖</strong> គាំទ្រអក្សរខ្មែរពេញលេញ ប្រតិទិនចន្ទគតិខ្មែរ ព្រមទាំងប្រព័ន្ធអាកាសធាតុ Open-Meteo ដែលប្រាប់ពីល្បឿនខ្យល់សមស្របក្នុងការបាញ់ថ្នាំ (< ២៥ គីឡូម៉ែត្រ/ម៉ោង)។</li>
        <li><strong>៤. ភាពជាម្ចាស់លើបច្ចេកវិទ្យា AI ផ្ទាល់ខ្លួន៖</strong> យើងមិនចំណាយលុយទិញ OpenAI API ឡើយ។ យើងបានបង្វឹកម៉ូឌែលផ្ទាល់ខ្លួនឈ្មោះ AGY V2.0.0 ក្រោមការដឹកនាំរបស់ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Mao Seavik)។</li>
    </ul>
</div>

<div class="doc-footer">
    <div>AgriSystem (Project_Assignment) • ឯកសារជំនួយស្មារតីបទបង្ហាញ (ទំព័រទី ២)</div>
    <div>រៀបចំដោយ៖ ម៉ៅ សៀវអ៊ិ និងក្រុមការងារវិស្វកម្ម • ថ្ងៃទី២៥ ខែកញ្ញា ឆ្នាំ២០២៦</div>
</div>

</body>
</html>
"""

html_path = Path("/Users/ahzarjy/Documents/Ai/Project_Assignment/scratch/khmer_document.html")
pdf_path = Path("/Users/ahzarjy/Downloads/AgriSystem_Presentation_Summary_KH.pdf")

html_path.write_text(html_content, encoding="utf-8")
print(f"HTML written to {html_path}")

chrome_cmd = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_path}",
    str(html_path),
]

print("Rendering Khmer PDF with Chrome...")
res = subprocess.run(chrome_cmd, capture_output=True, text=True)
print("Chrome return code:", res.returncode)

if pdf_path.exists():
    print(f"SUCCESS: PDF created at {pdf_path} ({pdf_path.stat().st_size / 1024:.1f} KB)")
else:
    print("FAILED: PDF not created. Stderr:", res.stderr)

