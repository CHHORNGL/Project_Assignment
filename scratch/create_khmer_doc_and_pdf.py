import os
import subprocess
from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

docx_path = Path("/Users/ahzarjy/Downloads/AgriSystem_Presentation_Summary_KH.docx")
pdf_path = Path("/Users/ahzarjy/Downloads/AgriSystem_Presentation_Summary_KH.pdf")
html_path = Path("/Users/ahzarjy/Documents/Ai/Project_Assignment/scratch/khmer_document.html")

# ==============================================================================
# 1. GENERATE DOCX FILE (Microsoft Word)
# ==============================================================================
doc = docx.Document()

# Set page margins
for section in doc.sections:
    section.top_margin = Inches(0.8)
    section.bottom_margin = Inches(0.8)
    section.left_margin = Inches(0.8)
    section.right_margin = Inches(0.8)

# Title
title_p = doc.add_paragraph()
title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
title_run = title_p.add_run("ប្រព័ន្ធកសិកម្មឆ្លាតវៃ AgriSystem (AGY V2.0.0)")
title_run.bold = True
title_run.font.size = Pt(22)
title_run.font.color.rgb = RGBColor(16, 78, 139) # Deep Navy

sub_p = doc.add_paragraph()
sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
sub_run = sub_p.add_run("ឯកសារសង្ខេបសម្រាប់បទបង្ហាញជូនអ្នកគ្រប់គ្រង (Manager Presentation Brief)\nស្តីពី៖ ប្រព័ន្ធអ្នកជំនាញ (Expert System) និង ភ្នាក់ងារឆ្លាតវៃ AI Agent (AI Train)")
sub_run.font.size = Pt(13)
sub_run.font.color.rgb = RGBColor(80, 80, 80)
sub_p.paragraph_format.space_after = Pt(18)

def add_heading_1(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(15)
    r.font.color.rgb = RGBColor(16, 78, 139)
    return p

def add_heading_2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(13)
    r.font.color.rgb = RGBColor(34, 139, 34) # Green
    return p

def add_bullet(bold_prefix, text):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_after = Pt(4)
    r_bold = p.add_run(bold_prefix + ": ")
    r_bold.bold = True
    r_bold.font.color.rgb = RGBColor(30, 41, 59)
    r_text = p.add_run(text)
    r_text.font.color.rgb = RGBColor(60, 60, 60)
    return p

# Section 1
add_heading_1("១. មូលដ្ឋានចំណេះដឹងនៃប្រព័ន្ធអ្នកជំនាញ (Expert System Knowledge Base)")
doc.add_paragraph("ប្រព័ន្ធអ្នកជំនាញ (Expert System) គឺជាស្នូលនៃភាពត្រឹមត្រូវខាងកសិកម្មរបស់គម្រោងយើង។ វាដំណើរការដោយផ្អែកលើច្បាប់ក្បួនតក្កវិជ្ជាជាក់លាក់ និងគណិតវិទ្យា ដោយមិនមានការភ័ន្តច្រឡំ ឬការប្រឌិតចម្លើយខុស (Zero Hallucination) ដូច AI ទូទៅឡើយ។")

add_heading_2("ក. រចនាសម្ព័ន្ធទិន្នន័យ (Database Schema & Knowledge Graph)")
add_bullet("ដំណាំកសិកម្ម (Crops)", "កត់ត្រាដំណាំសំខាន់ៗចំនួន ៨ មុខនៅកម្ពុជា រួមមាន ស្រូវ, ដំឡូងបារាំង, ប៉េងប៉ោះ, ត្រសក់, ម្ទេស, ចេក, ពោត និងដំឡូងមី។")
add_bullet("ជំងឺដំណាំ (Diseases)", "កត់ត្រាជំងឺសរុបចំនួន ១២៦ មុខ បែងចែកជា ៥ ប្រភេទធំៗ៖ ផ្សិត (Fungal 55), សត្វល្អិតចង្រៃ (Pest 32), បាក់តេរី (Bacterial 15), វីរុស (Viral 13) និងកង្វះជីវជាតិ (Nutrient 11)។")
add_bullet("រោគសញ្ញា (Symptoms)", "រោគសញ្ញារូបវន្តជាច្រើនត្រូវបានកត់ត្រាជាភាសាខ្មែរ និងអង់គ្លេសយ៉ាងច្បាស់លាស់។")
add_bullet("វិធានវិនិច្ឆ័យ (Rules & Associations)", "មានវិធានវិនិច្ឆ័យជាង ២៥០ ដែលភ្ជាប់រោគសញ្ញាជាក្រុមទៅនឹងជំងឺនីមួយៗ ព្រមទាំងកម្រិតទំនុកចិត្តរបស់អ្នកជំនាញ (Expert Baseline Confidence)។")

add_heading_2("ខ. រូបមន្តគណនាពិន្ទុវិនិច្ឆ័យជំងឺ (Scoring Algorithm)")
doc.add_paragraph("រូបមន្តគណិតវិទ្យាជាក់ស្តែងដែល Rule Engine ប្រើប្រាស់ក្នុងការកំណត់ជំងឺ៖")
doc.add_paragraph("Score = (0.60 × Coverage) + (0.20 × Precision) + (0.20 × Expert_Confidence) - (0.45 × Contradiction_Penalty) ± Category_Adj")
add_bullet("Coverage (៦០%)", "ភាគរយនៃរោគសញ្ញាក្នុងវិធានដែលកសិករបានជួបប្រទះ (Matched Symptoms / Rule Symptoms)។")
add_bullet("Precision (២០%)", "កម្រិតជាក់លាក់នៃរោគសញ្ញា ដើម្បីកុំឱ្យកសិកររើសរោគសញ្ញាច្រើនហួសហេតុ។")
add_bullet("Expert Baseline (២០%)", "កម្រិតទំនុកចិត្តដែលអ្នកជំនាញកសិកម្មបានកំណត់ទុក។")
add_bullet("Contradiction Penalty (-៤៥%)", "ការផាកពិន័យកាត់បន្ថយយ៉ាងខ្លាំង ប្រសិនបើកសិករបញ្ជាក់ថាមិនមានរោគសញ្ញាស្នូលណាមួយ (ឧទាហរណ៍៖ បើគ្មានទឹករំអិលបាក់តេរីទេ ជំងឺបាក់តេរីនឹងត្រូវកាត់បន្ថយ ៤៥% ភ្លាមៗ)។")

add_heading_2("គ. ផ្ទាំងវិនិច្ឆ័យសម្របសម្រួល (Adaptive Clarification Wizard)")
add_bullet("កម្រិតសំណួរ ៥–៧ ប៉ុណ្ណោះ", "កសិករនៅជនបទមិនអាចឆ្លើយសំណួរ ៤០ បានឡើយ។ ប្រព័ន្ធរបស់យើងសួរសំណួរ បាទ/ចាស ឬ ទេ ត្រឹមតែ ៥ ទៅ ៧ សំណួរ ដោយជ្រើសរើសសំណួរណាដែលកាត់បន្ថយភាពស្រពិចស្រពិលបានលឿនបំផុត។")
add_bullet("ភស្តុតាងច្បាស់លាស់ (Explainable AI)", "បង្ហាញលទ្ធផលជាក់លាក់៖ រោគសញ្ញាដែលត្រូវគ្នា (Matched), រោគសញ្ញាដែលខ្វះ (Missing), កម្រិតភាគរយ % ព្រមទាំងវិធីព្យាបាលដោយប្រើថ្នាំត្រឹមត្រូវ និងការការពារទុកជាមុន។")

# Section 2
add_heading_1("២. ភ្នាក់ងារឆ្លាតវៃ AI Agent និងការបង្វឹក AI Train (AI Train Pipeline)")
doc.add_paragraph("AI Agent គឺជាជំនួយការសន្ទនាដ៏ឆ្លាតវៃ ដែលអាចទំនាក់ទំនងជាមួយកសិករជាភាសាខ្មែរយ៉ាងរលូន រួសរាយ និងយល់ចិត្ត ប៉ុន្តែត្រូវគោរពតាមព្រំដែនសុវត្ថិភាពយ៉ាងតឹងរ៉ឹង។")

add_heading_2("ក. ស្រទាប់គ្រប់គ្រងភ្នាក់ងារ (Controlled Agent Layer - agri_agent.py)")
add_bullet("ការបែងចែកបំណង (Intent Classification)", "មុនពេលហៅ AI មកឆ្លើយ ប្រព័ន្ធពិនិត្យជាមុនថាតើកសិករចង់សួរអំពី៖ អាកាសធាតុ (Weather), សុខភាពដំណាំ (Crop Health), ការវិភាគដីនិងជី (Agri Insights), ការស្វាគមន៍ (Greeting) ឬជជែកលេងទូទៅ (Casual Talk)។")
add_bullet("ឧបករណ៍ដែលមានការអនុញ្ញាត (Trusted Tools)", "AI អាចទាញព័ត៌មានពី Database ជំងឺ និងទិន្នន័យអាកាសធាតុ Open-Meteo។ AI មិនត្រូវបានអនុញ្ញាតឱ្យបង្កើតកម្រិតថ្នាំគីមីដោយគ្មានមូលដ្ឋាន ឬកែប្រែទិន្នន័យក្នុង Database ដោយគ្មានការអនុញ្ញាតឡើយ។")

add_heading_2("ខ. ទិន្នន័យបង្វឹក AI Train (SFT Dataset - export_to_jsonl.py)")
add_bullet("ចំនួនទិន្នន័យសរុប", "មានទិន្នន័យបង្វឹកសរុបចំនួន ២,៩៣៧ កម្រងសំណួរ-ចម្លើយ (Training: ២,៣៤៣ ស្មើ ៨០%, Validation: ៥៩៤ ស្មើ ២០%) ដោយគ្មានទិន្នន័យត្រួតស៊ីគ្នាឡើយ (Zero Overlap verified by SHA-256)។")
add_bullet("ខ្លឹមសារទិន្នន័យ", "គ្របដណ្តប់លើការព្យាបាលជំងឺដំណាំ (២,៥២០), វិធានវិនិច្ឆ័យ (២៥២), ទិដ្ឋភាពទូទៅនៃដំណាំ (៤៨), អត្តសញ្ញាណ AI (៣១), ការលើកទឹកចិត្តកសិករ (៣០), សុជីវធម៌ស្វាគមន៍ (២៤) និងការវិភាគដី/ជី pH/NPK (១៦)។")

add_heading_2("គ. ម៉ូឌែល និងវិធីសាស្ត្របង្វឹក QLoRA (Fine-Tuning Execution)")
add_bullet("ម៉ូឌែលគោល (Base Model)", "Qwen/Qwen2.5-3B-Instruct — មានសមត្ថភាពខ្ពស់លើភាសាខ្មែរ និងមានទំហំសមស្រប ៣ ពាន់លានប៉ារ៉ាម៉ែត្រ ដែលដំណើរការលឿន។")
add_bullet("បច្ចេកទេស QLoRA", "បង្រួមទម្ងន់ម៉ូឌែលទៅជា 4-bit NormalFloat (NF4) ដោយប្រើ LoRA Rank r=32, Alpha=64 លើ Projection Matrices ទាំង ៧ ធ្វើឱ្យការបង្វឹកចំណាយពេលត្រឹមតែ ~២៨ នាទីប៉ុណ្ណោះនៅលើ Google Colab GPU ឥតគិតថ្លៃ។")
add_bullet("ការដាក់ឱ្យប្រើប្រាស់ (Deployment)", "LoRA Adapter ត្រូវបានរក្សាទុកនៅលើ Hugging Face Hub (Maoseavik/agri-qwen3b-lora) និងដាក់ឱ្យដំណើរការលើ Hugging Face Space (Maoseavik/agrisystem-agricultural-assistant)។")
add_bullet("ប្រព័ន្ធជំនួយពេលដាច់បណ្តាញ (Offline Fallback)", "ប្រសិនបើ Hugging Face Space មិនដំណើរការ ប្រព័ន្ធមាន Local Fallback ឆ្លើយចេញពី Database ភ្លាមៗ ធានាថាប្រព័ន្ធដំណើរការ ១០០% ជានិច្ច។")

# Section 3
add_heading_1("៣. ការប្រៀបធៀប៖ ហេតុអ្វីត្រូវមានទាំង Expert System និង AI Agent?")
table = doc.add_table(rows=1, cols=3)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
hdr_cells = table.rows[0].cells
hdr_cells[0].text = "លក្ខណៈវិនិច្ឆ័យ"
hdr_cells[1].text = "Expert System (មូលដ្ឋានច្បាប់)"
hdr_cells[2].text = "AI Agent (ម៉ូឌែល AGY V2.0.0)"
for cell in hdr_cells:
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.size = Pt(11)

comparisons = [
    ("តួនាទីចម្បង", "ធ្វើរោគវិនិច្ឆ័យជំងឺ និងកំណត់ថ្នាំព្យាបាលផ្លូវការ", "ជជែក ពិគ្រោះយោបល់ និងពន្យល់កសិករជាភាសាខ្មែរ"),
    ("ក្បួនដំណើរការ", "រូបមន្តគណិតវិទ្យា និងតក្កវិជ្ជា Forward Chaining", "បណ្តាញប្រសាទសិប្បនិម្មិត Qwen2.5-3B + QLoRA"),
    ("ហានិភ័យភូតកុហក (Hallucination)", "០.០% (មិនអាចខុសបានឡើយ)", "ទាបបំផុត (ដោយសារមាន Tool Gating កំណត់)"),
    ("ការប្រើប្រាស់របស់កសិករ", "ចុចឆ្លើយសំណួរ បាទ/ទេ ៥–៧ សំណួរក្នុង Wizard", "វាយជាអក្សរ ឬជជែកសួរនាំតាមធម្មជាតិ"),
    ("ការបកស្រាយហេតុផល", "បង្ហាញរោគសញ្ញាត្រូវ/ខ្វះ និងភាគរយច្បាស់លាស់", "ពន្យល់ជាពាក្យពេចន៍ងាយយល់ និងទន់ភ្លន់"),
]

for item in comparisons:
    row_cells = table.add_row().cells
    row_cells[0].text = item[0]
    row_cells[1].text = item[1]
    row_cells[2].text = item[2]
    for cell in row_cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10)

# Section 4
add_heading_1("៤. ចំណុចគន្លឹះសម្រាប់ធ្វើបទបង្ហាញជូនអ្នកគ្រប់គ្រង (Talking Points for Manager)")
add_bullet("១. ប្រព័ន្ធរួចរាល់សម្រាប់ផលិតកម្ម", "យើងបានបង្កើតប្រព័ន្ធពេញលេញមួយដែលបំបែករវាង Web Server និង AI Server មិនចំណាយថ្លៃ Server GPU ថ្លៃៗឡើយ។")
add_bullet("២. សុវត្ថិភាពខ្ពស់បំផុតលើវិស័យកសិកម្ម", "ការកំណត់កម្រិតថ្នាំគីមីមិនពឹងលើការស្មានរបស់ AI ឡើយ គឺពឹងលើ Expert System ដែលមានការផ្ទៀងផ្ទាត់ដោយអ្នកជំនាញកសិកម្ម ១០០%។")
add_bullet("៣. ផលិតផលបង្កើតឡើងសម្រាប់កសិករខ្មែរ", "គាំទ្រអក្សរខ្មែរពេញលេញ ប្រតិទិនចន្ទគតិខ្មែរ ព្រមទាំងប្រព័ន្ធព្យាករណ៍អាកាសធាតុដែលប្រាប់ពីល្បឿនខ្យល់សមស្របក្នុងការបាញ់ថ្នាំ (< ២៥ គីឡូម៉ែត្រ/ម៉ោង)។")
add_bullet("៤. ភាពជាម្ចាស់លើបច្ចេកវិទ្យា AI", "យើងមិនពឹងផ្អែកលើ OpenAI API ឡើយ។ យើងបានបង្វឹកម៉ូឌែលផ្ទាល់ខ្លួនឈ្មោះ AGY V2.0.0 ក្រោមការដឹកនាំរបស់ប្រធានក្រុម ម៉ៅ សៀវអ៊ិ (Mao Seavik)។")

doc.save(docx_path)
print(f"DOCX created at {docx_path}")

