"""Comprehensive Khmer agricultural terminology, descriptions, and translations.

Provides clean, idiomatic Khmer knowledge representation for crops, diseases,
symptoms, causes, and treatment advice without broken mixed-language artifacts.
"""

from __future__ import annotations

import re
from typing import Optional

CROP_DESCRIPTION_KH: dict[str, str] = {
    "Rice": "ដំណាំស្រូវជាដំណាំស្បៀងដ៏សំខាន់បំផុតនៅកម្ពុជា ដាំដុះទាំងនៅតំបន់ទំនាបនិងតំបន់ខ្ពង់រាប។",
    "Potato": "ដំណាំដំឡូងបារាំងជាដំណាំយកមើមដែលត្រូវការដីធូរ មានជីវជាតិ និងងាយរងគ្រោះដោយសារជំងឺលើស្លឹកនិងជំងឺក្នុងដី។",
    "Tomato": "ដំណាំប៉េងប៉ោះជាបន្លែហូបផ្លែដែលមានតម្លៃសេដ្ឋកិច្ចខ្ពស់ ប៉ុន្តែងាយប្រឈមនឹងជំងឺផ្សិត សត្វល្អិត និងបញ្ហារលួយផ្លែ។",
    "Cucumber": "ដំណាំត្រសក់ជាដំណាំវល្លិ៍អាយុកាលខ្លី ងាយស្រួលដាំដុះ ប៉ុន្តែងាយកើតជំងឺផ្សិតម្សៅ ជំងឺដួង និងជំងឺឫស។",
    "Chili Pepper": "ដំណាំម្ទេសជាដំណាំគ្រឿងទេសសំខាន់ មានតម្រូវការទីផ្សារខ្ពស់ ងាយកើតជំងឺអង់ត្រាក់ណូសនិងសត្វល្អិតទ្រីប។",
    "Banana": "ដំណាំចេកជាដំណាំឈើហូបផ្លែពេញនិយម ងាយដាំដុះ តែងាយប្រឈមនឹងជំងឺក្រិន ជំងឺស្វិតស្លឹក និងសត្វល្អិតចោះដើម។",
    "Corn": "ដំណាំពោតជាដំណាំធញ្ញជាតិសេដ្ឋកិច្ចសំខាន់ ងាយរងគ្រោះដោយសារដង្កូវហ្វលអាមីវ៉ម ជំងឺរលួយដើម និងជំងឺច្រែះ។",
    "Cassava": "ដំណាំដំឡូងមីជាដំណាំឧស្សាហកម្មកសិកម្មសំខាន់ ធន់នឹងភាពរាំងស្ងួត ប៉ុន្តែងាយឆ្លងជំងឺមូសៃ និងជំងឺបាក់តេរីខូចស្លឹក។",
}

DISEASE_CAUSE_KH: dict[str, str] = {
    # Rice
    "Rice Blast": "ការឆ្លងមេរោគផ្សិត Magnaporthe oryzae ក្នុងលក្ខខណ្ឌសំណើមខ្ពស់នៃគុម្ពស្រូវ។",
    "Bacterial Leaf Blight": "ការឆ្លងរាលដាលនៃបាក់តេរី Xanthomonas oryzae តាមរយៈដំណក់ទឹកភ្លៀងនិងខ្យល់។",
    "Rice Brown Spot": "ការឆ្លងមេរោគផ្សិត Bipolaris oryzae រួមផ្សំនឹងកង្វះសារធាតុចិញ្ចឹមក្នុងដី។",
    "Rice Stem Borer Damage": "ដង្កូវខួងដើមស៊ីកកាយខាងក្នុងដើមស្រូវ និងរារាំងការបញ្ជូនសារធាតុចិញ្ចឹម។",
    "Rice Tungro Virus": "ការចម្លងមេរោគវីរុសតាមរយៈសត្វល្អិតមមាចបៃតងជាភ្នាក់ងារចម្លង។",
    "Rice Sheath Blight": "ការឆ្លងមេរោគផ្សិត Rhizoctonia solani នៅលើស្រទាប់ស្រទបស្លឹកជិតផ្ទៃទឹក។",
    "Rice False Smut": "ការឆ្លងមេរោគផ្សិត Ustilaginoidea virens លើគ្រាប់ស្រូវនៅដំណាក់កាលចេញផ្កា។",
    "Rice Bacterial Leaf Streak": "បាក់តេរី Xanthomonas oryzae pv. oryzicola ជ្រាបចូលតាមរន្ធដង្ហើមស្លឹកស្រូវ។",
    "Brown Planthopper Damage": "សត្វមមាចត្នោតជញ្ជក់ទឹករុក្ខជាតិយ៉ាងច្រើនបង្កឱ្យស្រូវស្ងួតក្រៀម។",
    "Rice Gall Midge Damage": "ដង្កូវមូសកន្ត្រាក់បំផ្លាញចំណុចលូតលាស់នៃពន្លកស្រូវបណ្តាលឱ្យក្លាយជាបំពង់ខ្ទឹម។",
    "Rice Bakanae Disease": "មេរោគផ្សិត Fusarium fujikuroi បញ្ចេញអ័រម៉ូនហ្ស៊ីបបេរ៉េលីនធ្វើឱ្យស្រូវលូតលាស់ខ្ពស់ខុសប្រក្រតី។",
    "Rice Narrow Brown Leaf Spot": "ការឆ្លងមេរោគផ្សិត Cercospora janseana បង្កជាស្នាមឆ្នូតត្នោតលើស្លឹកចាស់។",
    "Rice Grassy Stunt Virus": "មេរោគវីរុសចម្លងដោយមមាចត្នោតធ្វើឱ្យដើមស្រូវក្រិននិងបែកគុម្ពច្រើនតែមិនចេញកួរ។",
    "Rice Bacterial Panicle Blight": "ការឆ្លងបាក់តេរី Burkholderia glumae បណ្តាលឱ្យគ្រាប់ស្រូវស្កកនិងរលួយកួរ។",
    "Bacterial Panicle Blight": "ការឆ្លងបាក់តេរី Burkholderia glumae បណ្តាលឱ្យគ្រាប់ស្រូវស្កកនិងរលួយកួរក្នុងដំណាក់កាលដាក់គ្រាប់។",
    "Brown Planthopper Hopperburn": "សត្វមមាចត្នោត Nilaparvata lugens ជញ្ជក់ទឹករុក្ខជាតិយ៉ាងច្រើនបង្កឱ្យស្រូវស្ងួតក្រៀមទូទាំងស្រែ។",
    "Rice Leaf Folder Damage": "ដង្កូវមូរស្លឹក Cnaphalocrocis medinalis មូរស្លឹកស្រូវនិងស៊ីកោសផ្ទៃស្លឹកបៃតង។",
    "Rice Nutrient Deficiency": "ការផ្គត់ផ្គង់ជីអាសូតឬប៉ូតាស្យូមមិនមានតុល្យភាពក្នុងដីស្រែមានទឹក។",
    "Rice Leaf Scald": "មេរោគផ្សិត Microdochium oryzae បង្កជាស្នាមរលាករាងអក្សរវីលើចុងស្លឹកស្រូវ។",
    "Rice Caseworm Damage": "ដង្កូវបំពង់ Parapoynx stagnalis ក្នុងទឹកស៊ីកោសផ្ទៃស្លឹកស្រូវខ្ចី។",
    "Rice Salinity Toxicity": "ការជ្រាបចូលនៃទឹកប្រៃនិងសម្ពាធអូស្មូសលើឫសស្រូវ។",
    "Rice Zinc Deficiency": "កង្វះជាតិស័ង្កសីដោយសារដីលិចទឹកជាប្រចាំនិងមានកម្រិត pH អព្យាក្រឹតទៅបាស។",
    "Rice Nitrogen Deficiency": "កង្វះជីអាសូតក្នុងដំណាក់កាលលូតលាស់យ៉ាងឆាប់រហ័សនៃដំណាំស្រូវ។",

    # Potato
    "Potato Late Blight": "មេរោគផ្សិត Phytophthora infestans រាលដាលយ៉ាងលឿនក្នុងអាកាសធាតុត្រជាក់និងសើម។",
    "Late Blight": "មេរោគផ្សិត Phytophthora infestans រាលដាលយ៉ាងលឿនក្នុងអាកាសធាតុត្រជាក់និងសើម។",
    "Potato Early Blight": "មេរោគផ្សិត Alternaria solani បង្កស្នាមដំបៅជារង្វង់ៗលើស្លឹកចាស់។",
    "Potato Blackleg": "បាក់តេរី Pectobacterium បង្កការរលួយជាលិកាគល់ដើមនិងមើមដំឡូង។",
    "Potato Leafroll Virus": "មេរោគវីរុសចម្លងដោយសត្វចៃស្លឹកធ្វើឱ្យស្លឹករមួលនិងប្រែពណ៌។",
    "Potato Common Scab": "បាក់តេរី Streptomyces scabies ក្នុងដីបង្កស្នាមក្រមរលើស្បែកមើមដំឡូង។",
    "Potato Bacterial Wilt": "បាក់តេរី Ralstonia solanacearum ជ្រៀតចូលក្នុងបំពង់បង្ហូរទឹកដើមធ្វើឱ្យដើមស្រពោនភ្លាមៗ។",
    "Potato Dry Rot": "មេរោគផ្សិត Fusarium ជ្រៀតចូលតាមស្នាមរបួសលើមើមពេលប្រមូលផលឬទុកដាក់។",
    "Potato Fusarium Dry Rot": "មេរោគផ្សិត Fusarium បង្កការរលួយស្ងួតលើមើមដំឡូងពេលទុកដាក់ក្នុងឃ្លាំង។",
    "Potato Silver Scurf": "មេរោគផ្សិត Helminthosporium solani បង្កស្នាមប្រឡាក់ពណ៌ប្រាក់លើស្បែកមើមដំឡូង។",
    "Potato Leak Tuber Rot": "ពពួកផ្សិតទឹក Pythium ultimum ឆ្លងចូលមើមដំឡូងតាមស្នាមរបួសពេលប្រមូលផល។",
    "Potato White Grub Damage": "ដង្កូវដួងកញ្ចែស៊ីបំផ្លាញឫសនិងចោះស៊ីសាច់មើមដំឡូងបារាំង។",
    "Potato Mop Top Virus": "មេរោគវីរុស Pomovirus ចម្លងដោយផ្សិត Spongospora subterranea បង្កស្នាមឆ្នូតក្នុងសាច់មើម។",
    "Potato Rhizoctonia Canker": "មេរោគផ្សិត Rhizoctonia solani ក្នុងដីបំផ្លាញពន្លកនិងបង្កើតស្នាមដំបៅលើដើម។",
    "Potato Soft Rot": "បាក់តេរី Pectobacterium carotovorum រលួយសាច់មើមក្នុងលក្ខខណ្ឌសើមនិងខ្វះខ្យល់។",
    "Potato Aphid Infestation": "សត្វល្អិតចៃស្លឹកបៀមជញ្ជក់ទឹកដមនិងចម្លងមេរោគវីរុសជាច្រើនប្រភេទ។",
    "Potato Tuber Moth Damage": "ដង្កូវមេអំបៅមើមដំឡូងចោះចូលស៊ីខាងក្នុងមើមទាំងក្នុងចម្ការនិងឃ្លាំង។",
    "Potato Verticillium Wilt": "មេរោគផ្សិត Verticillium ក្នុងដីរារាំងប្រព័ន្ធបង្ហូរទឹកក្នុងដើមធ្វើឱ្យស្វិតស្លឹក។",
    "Potato Powdery Scab": "មេរោគ Spongospora subterranea បង្កជាដំបៅពកម្សៅលើមើមក្នុងដីត្រជាក់សើម។",
    "Potato Wireworm Damage": "ដង្កូវដួង Agriotes ចោះទម្លុះមើមដំឡូងបង្កើតជារន្ធជ្រៅៗ។",
    "Potato Potassium Deficiency": "កង្វះជាតិប៉ូតាស្យូមក្នុងដីធ្វើឱ្យគែមស្លឹកស្ងួតនិងមើមលូតលាស់មិនពេញលេញ។",

    # Tomato
    "Tomato Late Blight": "មេរោគផ្សិត Phytophthora infestans បំផ្លាញស្លឹក ដើម និងផ្លែក្នុងអាកាសធាតុត្រជាក់សើម។",
    "Tomato Early Blight": "មេរោគផ្សិត Alternaria solani បង្កជាស្នាមដំបៅរាងគោលដៅលើស្លឹកនិងផ្លែ។",
    "Tomato Bacterial Wilt": "បាក់តេរី Ralstonia solanacearum ធ្វើឱ្យប្រព័ន្ធបង្ហូរទឹករាំងស្ទះ បណ្តាលឱ្យដើមស្រពោនងាប់យ៉ាងលឿន។",
    "Tomato Leaf Curl Virus": "មេរោគវីរុសចម្លងដោយសត្វរុយស ធ្វើឱ្យស្លឹកប៉េងប៉ោះរួញក្រញង់ឡើងលើ។",
    "Tomato Fruit Borer Damage": "ដង្កូវបំផ្លាញផ្លែចោះស៊ីសាច់ខាងក្នុងផ្លែប៉េងប៉ោះ។",
    "Tomato Blossom End Rot": "កង្វះជាតិកាល់ស្យូមរួមផ្សំជាមួយការស្រោចទឹកមិនទៀងទាត់។",
    "Tomato Septoria Leaf Spot": "មេរោគផ្សិត Septoria lycopersici បង្កជាចំណុចអុចៗតូចៗយ៉ាងក្រាស់លើស្លឹកក្រោម។",
    "Tomato Powdery Mildew": "មេរោគផ្សិតម្សៅ Oidium / Leveillula ដុះគ្របដណ្តប់លើផ្ទៃស្លឹកប៉េងប៉ោះ។",
    "Tomato Spider Mite Damage": "សត្វពីងពាងក្រហមជញ្ជក់ទឹករុក្ខជាតិក្នុងអាកាសធាតុក្តៅនិងស្ងួត។",
    "Tomato Gray Mold Blight": "មេរោគផ្សិត Botrytis cinerea បង្កការរលួយស្លឹកនិងផ្លែក្នុងផ្ទះសំណាញ់ដែលមានសំណើមខ្ពស់។",
    "Tomato Anthracnose Fruit Spot": "មេរោគផ្សិត Colletotrichum coccodes បង្កស្នាមដំបៅមូលលិចលើផ្លែទុំ។",
    "Tomato Root Knot Nematode": "ដង្កូវព្រូនក្នុងដី Meloidogyne incognita ចោះទម្លុះឫសបង្កើតជាពកឫសរារាំងការបឺតស្រូបជី។",
    "Tomato Bacterial Canker": "បាក់តេរី Clavibacter michiganensis ឆ្លងរាលដាលជាប្រព័ន្ធក្នុងបំពង់សរសៃដើម។",
    "Tomato Fusarium Crown Rot": "មេរោគផ្សិត Fusarium oxysporum បង្កការរលួយគល់ដើមជិតផ្ទៃដី។",
    "Tomato Tobacco Mosaic Virus": "មេរោគវីរុស Tobamovirus ឆ្លងតាមការប៉ះពាល់ ឧបករណ៍កាត់តម្រឹម និងផ្សែងថ្នាំជក់។",
    "Tomato Whitefly Sooty Mold": "សត្វរុយសបញ្ចេញទឹកដមស្អិតបង្កើតជាលក្ខខណ្ឌឱ្យផ្សិតខ្មៅដុះលើស្លឹក។",
    "Tomato Catfacing Disorder": "សីតុណ្ហភាពត្រជាក់ខ្លាំងនៅពេលចេញផ្កាធ្វើឱ្យផ្លែខូចទ្រង់ទ្រាយ។",

    # Cucumber
    "Cucumber Downy Mildew": "មេរោគផ្សិត Pseudoperonospora cubensis រាលដាលលើស្លឹកតាមសំណើមខ្យល់។",
    "Cucumber Powdery Mildew": "មេរោគផ្សិតម្សៅ Podosphaera xanthii ដុះជាស្រទាប់ម្សៅពណ៌សលើស្លឹកត្រសក់។",
    "Cucumber Mosaic Virus": "មេរោគវីរុសចម្លងដោយសត្វចៃស្លឹកធ្វើឱ្យស្លឹកឡើងស្នាមអុចៗលឿងបៃតង។",
    "Cucumber Root Rot": "មេរោគផ្សិតក្នុងដីរលួយឫសដោយសារដីជាំទឹកនិងខ្វះខ្យល់ចេញចូល។",
    "Cucumber Anthracnose": "មេរោគផ្សិត Colletotrichum orbiculare បង្កដំបៅលើស្លឹកនិងផ្លែក្រោយពេលមានភ្លៀងធ្លាក់។",
    "Cucumber Gummy Stem Blight": "មេរោគផ្សិត Stagonosporopsis cucurbitacearum បង្កការខូចខាតដើមនិងហៀរជ័រពណ៌ទឹកឃ្មុំ។",
    "Cucumber Fusarium Wilt": "មេរោគផ្សិត Fusarium oxysporum f. sp. cucumerinum ឆ្លងតាមឫសរារាំងបំពង់បង្ហូរទឹក។",
    "Cucumber Two-Spotted Spider Mite": "សត្វពីងពាងក្រហមពីរចំណុចជញ្ជក់ទឹករុក្ខជាតិក្រោមស្លឹកក្នុងអាកាសធាតុក្តៅស្ងួត។",
    "Cucumber Scab Spot": "មេរោគផ្សិត Cladosporium cucumerinum បង្កស្នាមដំបៅដូចមាត់រណ្ដៅលើផ្លែនិងស្លឹក។",
    "Cucumber Yellow Stunting Disorder": "មេរោគ Crinivirus ចម្លងដោយសត្វរុយសធ្វើឱ្យស្លឹកប្រែពណ៌លឿងចន្លោះទ្រនុង។",
    "Cucumber Bacterial Wilt": "បាក់តេរី Erwinia tracheiphila ចម្លងដោយសត្វកណ្ដូបដង្កូវស៊ីស្លឹកត្រសក់។",
    "Cucumber Belly Rot": "មេរោគផ្សិត Rhizoctonia solani ក្នុងដីបង្ករលួយផ្នែកផ្លែដែលប៉ះផ្ទាល់នឹងដីសើម។",
    "Cucumber Root Knot Nematode": "ដង្កូវព្រូនពកឫស Meloidogyne បង្កើតពកលើឫសធ្វើឱ្យទងវល្លិ៍ក្រិន។",
    "Cucumber Thrips Infestation": "សត្វល្អិតទ្រីប Thrips palmi បៀមជញ្ជក់ត្រួយខ្ចីនិងផ្កាធ្វើឱ្យផ្លែខូចទ្រង់ទ្រាយ។",
    "Cucumber Magnesium Deficiency": "កង្វះជាតិម៉ាញ៉េស្យូមក្នុងដីខ្សាច់នៅពេលដំណាំកំពុងផ្ទុកផ្លែច្រើន។",

    # Chili Pepper
    "Chili Anthracnose Fruit Rot": "មេរោគផ្សិត Colletotrichum capsici បង្កដំបៅរលួយលិចលើផ្លែម្ទេសក្រោយភ្លៀង។",
    "Chili Bacterial Leaf Spot": "បាក់តេរី Xanthomonas campestris pv. vesicatoria បង្កចំណុចខ្មៅលើស្លឹកនិងផ្លែ។",
    "Chili Leaf Curl Virus": "មេរោគវីរុសចម្លងដោយសត្វរុយស ធ្វើឱ្យស្លឹកម្ទេសរួញក្រញង់ឡើងលើ។",
    "Chili Thrips Damage": "សត្វល្អិតទ្រីបបៀមជញ្ជក់ត្រួយខ្ចីនិងផ្កាធ្វើឱ្យស្លឹករួញដូចទូក។",
    "Chili Phytophthora Blight": "មេរោគផ្សិត Phytophthora capsici បង្ករលួយគល់ដើមនិងផ្លែពេលដីជាំទឹកខ្លាំង។",
    "Chili Powdery Mildew": "មេរោគផ្សិត Leveillula taurica ដុះក្នុងជាលិកាស្លឹកនិងចេញម្សៅសក្រោមស្លឹក។",
    "Chili Broad Mite Infestation": "សត្វល្អិតស្កៀប Polyphagotarsonemus latus ជញ្ជក់ត្រួយខ្ចីធ្វើឱ្យស្លឹករមួលចុះក្រោម។",
    "Chili Sunscald and Blossom Rot": "ការរលាកកម្ដៅថ្ងៃរួមផ្សំនឹងការខ្វះជាតិកាល់ស្យូមនិងជាតិទឹកមិនទៀងទាត់។",
    "Chili White Mold Rot": "មេរោគផ្សិត Sclerotinia sclerotiorum បង្កការរលួយដើមមានដុំផ្សិតសដូចកប្បាស។",
    "Chili Twig Dieback": "មេរោគផ្សិត Colletotrichum / Phomopsis ធ្វើឱ្យមែកស្ងួតងាប់ពីចុងចុះក្រោម។",
    "Chili Bacterial Wilt": "បាក់តេរី Ralstonia solanacearum ជ្រៀតចូលប្រព័ន្ធបង្ហូរទឹកដើមធ្វើឱ្យដើមស្រពោនភ្លាមៗ។",
    "Chili Root Knot Nematode": "ដង្កូវព្រូនពកឫស Meloidogyne បង្កពកលើឫសធ្វើឱ្យដើមក្រិននិងស្លេកស្លាំង។",
    "Chili Aphid Mosaic Complex": "ក្រុមមេរោគវីរុស Potyvirus ចម្លងដោយសត្វចៃស្លឹក Aphis gossypii។",
    "Chili Cercospora Leaf Spot": "មេរោគផ្សិត Cercospora capsici បង្កចំណុចភ្នែកកង្កែបធ្វើឱ្យស្លឹកជ្រុះយ៉ាងច្រើន។",
    "Chili Fruit Caterpillar Damage": "ដង្កូវមេអំបៅ Spodoptera / Helicoverpa ចោះស៊ីផ្លែម្ទេសខ្ចីនិងទុំ។",

    # Banana
    "Banana Sigatoka Leaf Spot": "មេរោគផ្សិត Mycosphaerella musicola បង្កចំណុចលឿងត្នោតលើស្លឹកក្នុងអាកាសធាតុសើម។",
    "Banana Panama Wilt": "មេរោគផ្សិត Fusarium oxysporum f. sp. cubense ក្នុងដីរារាំងប្រព័ន្ធបង្ហូរទឹកក្នុងដើម។",
    "Banana Bunchy Top Virus": "មេរោគវីរុសចម្លងដោយសត្វចៃចេក Pentalonia nigronervosa ធ្វើឱ្យដើមក្រិនស្លឹកប្រជុំគ្នានៅកំពូល។",
    "Banana Pseudostem Weevil Damage": "ដង្កូវកញ្ចែ Odoiporus longicollis ចោះស៊ីខាងក្នុងដើមក្លែងចេកធ្វើឱ្យដើមរលួយបាក់។",
    "Banana Anthracnose Fruit Rot": "មេរោគផ្សិត Colletotrichum musae បង្កស្នាមដំបៅខ្មៅលើសម្បកផ្លែចេកទុំ។",
    "Banana Bacterial Wilt Blood Disease": "បាក់តេរីបង្កជំងឺឈាមរលួយប្រព័ន្ធសរសៃដើមនិងសាច់ផ្លែចេក។",
    "Banana Black Sigatoka": "មេរោគផ្សិត Pseudocercospora fijiensis បំផ្លាញស្លឹកចេកយ៉ាងធ្ងន់ធ្ងរធ្វើឱ្យស្លឹកស្ងួតងាប់។",
    "Banana Rust Thrips Damage": "សត្វល្អិតទ្រីប Chaetanaphothrips signipennis បង្កស្នាមច្រែះក្រហមលើសម្បកចេក។",
    "Banana Crown Rot": "ការឆ្លងមេរោគផ្សិត Colletotrichum និង Fusarium នៅលើក្បាលស្ទងចេកក្រោយប្រមូលផល។",
    "Banana Corm Borer Weevil": "ដង្កូវកញ្ចែ Cosmopolites sordidus ចោះបំផ្លាញមើមចេកក្រោមដី។",
    "Banana Moko Bacterial Wilt": "បាក់តេរី Ralstonia solanacearum race 2 ចម្លងតាមកាំបិតកាត់និងសត្វល្អិត។",
    "Banana Cordana Leaf Spot": "មេរោគផ្សិត Cordana musae បង្កស្នាមដំបៅធំៗរាងពងក្រពើលើគែមស្លឹក។",
    "Banana Nematode Toppling Disease": "ដង្កូវព្រូនចោះឫស Radopholus similis បំផ្លាញឫសទ្រទ្រង់ធ្វើឱ្យដើមចេកដួលរលំ។",
    "Banana Aphid Infestation": "សត្វចៃចេកផ្តុំគ្នានៅគល់ធាងនិងបណ្តូលចេក ជាភ្នាក់ងារចម្លងមេរោគក្រិនចេក។",
    "Banana Potassium Deficiency": "កង្វះជាតិប៉ូតាស្យូមធ្ងន់ធ្ងរក្នុងដំណាក់កាលបំពេញផ្លែចេកធ្វើឱ្យចុងស្លឹកស្ងួត។",

    # Corn
    "Corn Northern Leaf Blight": "មេរោគផ្សិត Exserohilum turcicum បង្កស្នាមដំបៅវែងៗលើស្លឹកពោត។",
    "Corn Common Rust": "មេរោគផ្សិត Puccinia sorghi បង្កពងទឹកពណ៌ត្នោតក្រហមលើស្លឹកកាត់បន្ថយការធ្វើរស្មីសំយោគ។",
    "Fall Armyworm Damage": "ដង្កូវហ្វលអាមីវ៉ម Spodoptera frugiperda ស៊ីបំផ្លាញបណ្ដូលនិងស្លឹកខ្ចីរបស់ពោត។",
    "Corn Stalk Rot": "មេរោគផ្សិតបង្កការរលួយគល់ដើមនិងបណ្តាលឱ្យដើមពោតដួលនៅជិតពេលប្រមូលផល។",
    "Corn Gray Leaf Spot": "មេរោគផ្សិត Cercospora zeae-maydis បង្កស្នាមឆ្នូតចតុកោណកែងចន្លោះទ្រនុងស្លឹក។",
    "Corn Smut": "មេរោគផ្សិត Ustilago maydis បង្កើតជាដុំពកខ្មៅលើផ្លែ ផ្កាឈ្មោល និងដើមពោត។",
    "Corn Downy Mildew": "មេរោគផ្សិត Peronosclerospora បង្កឆ្នូតពណ៌លឿងតាមប្រព័ន្ធស្លឹកពោត។",
    "Corn Earworm Damage": "ដង្កូវចោះផ្លែ Helicoverpa zea ស៊ីកកាយពុកមាត់និងគ្រាប់ពោតនៅចុងផ្លែ។",
    "Corn Gibberella Ear Rot": "មេរោគផ្សិត Fusarium graminearum បង្កការរលួយផ្លែពណ៌ផ្កាឈូកក្នុងអាកាសធាតុត្រជាក់សើម។",
    "Corn Rootworm Damage": "ដង្កូវដួង Diabrotica ស៊ីបំផ្លាញឫសពោតធ្វើឱ្យដើមកោងដូចកក្ងាននិងដួល។",
    "Corn Bacterial Stalk Rot": "បាក់តេរី Dickeya zeae បង្កការរលួយទន់លើដើមពោតក្នុងលក្ខខណ្ឌទឹកលិចនិងក្តៅសើម។",
    "Corn Anthracnose Leaf Blight": "មេរោគផ្សិត Colletotrichum graminicola បង្កដំបៅលើស្លឹកនិងរលួយបណ្តូលដើម។",
    "Corn Aphid Infestation": "សត្វចៃពោត Rhopalosiphum maidis បៀមជញ្ជក់ទឹកដមក្នុងបណ្ដូលនិងផ្កាឈ្មោល។",
    "Corn Head Smut": "មេរោគផ្សិត Sphacelotheca reiliana ឆ្លងជាប្រព័ន្ធបំផ្លាញផ្កាឈ្មោលនិងផ្លែឱ្យទៅជាម្សៅខ្មៅ។",
    "Corn Zinc Deficiency": "កង្វះជាតិស័ង្កសីក្នុងដីដែលមាន pH ខ្ពស់ ឬមានជាតិផូស្វ័រច្រើនពេក។",

    # Cassava
    "Cassava Mosaic Disease": "មេរោគវីរុសចម្លងដោយសត្វរុយស Bemisia tabaci ធ្វើឱ្យស្លឹកដំឡូងមីរួញនិងឡើងស្នាមអុចៗ។",
    "Cassava Bacterial Blight": "បាក់តេរី Xanthomonas axonopodis pv. manihotis រាលដាលតាមទឹកភ្លៀងបង្កដំបៅលើស្លឹកនិងដើម។",
    "Cassava Mealybug Infestation": "សត្វល្អិតកន្ទុំរុយម្សៅ Phenacoccus manihoti ជញ្ជក់ទឹករុក្ខជាតិលើត្រួយធ្វើឱ្យដើមក្រិន។",
    "Cassava Brown Streak Disease": "មេរោគវីរុស Ipomovirus ធ្វើឱ្យស្លឹកឡើងឆ្នូតលឿងនិងបង្កការរលួយស្ងួតក្នុងមើមដំឡូង។",
    "Cassava Anthracnose Disease": "មេរោគផ្សិត Colletotrichum gloeosporioides បង្កដំបៅពកលើដើមនិងធ្វើឱ្យមែកងាប់ពីចុង។",
    "Cassava Root Rot": "មេរោគផ្សិត Phytophthora និង Fusarium ក្នុងដីបង្កការរលួយមើមក្នុងដីជាំទឹក។",
    "Cassava Green Mite Damage": "សត្វស្កៀបបៃតង Mononychellus tanajoa ជញ្ជក់ស្លឹកខ្ចីធ្វើឱ្យស្លឹកតូចនិងជ្រុះ។",
    "Cassava Superelongation Disease": "មេរោគផ្សិត Sphaceloma manihoticola បញ្ចេញសារធាតុធ្វើឱ្យថ្នាំងដើមដំឡូងមីលូតវែងខុសប្រក្រតី។",
    "Cassava Nutrient Deficiency": "កង្វះជាតិម៉ាញ៉េស្យូមនិងប៉ូតាស្យូមក្នុងដីខ្សាច់ជូរ។",
    "Cassava Witches Broom Disease": "មេរោគ Phytoplasma បង្កការបែកមែកញឹកដូចអំបោសនៅកំពូលដើមដំឡូងមី។",
    "Cassava Bacterial Stem Rot": "បាក់តេរី Pectobacterium carotovorum បង្កការរលួយបណ្តូលដើមដំឡូងមី។",
    "Cassava Whitefly Vector Pressure": "ដង់ស៊ីតេសត្វរុយសខ្ពស់ជញ្ជក់ទឹករុក្ខជាតិនិងចម្លងមេរោគវីរុស។",
    "Cassava Brown Leaf Spot": "មេរោគផ្សិត Passalora henningsii បង្កចំណុចត្នោតលើស្លឹកចាស់ក្នុងអាកាសធាតុសើម។",
    "Cassava Stem Borer Damage": "ដង្កូវកញ្ចែចោះទម្លុះស៊ីខាងក្នុងដើមដំឡូងមីធ្វើឱ្យដើមងាយបាក់។",
}

SYMPTOM_CLEAN_KH: dict[str, str] = {
    "aphid vector present": "មានសត្វល្អិតចៃស្លឹកជាភ្នាក់ងារចម្លងរោគ",
    "bright yellow chevron or v-shaped markings on leaves": "ស្នាមឆ្នូតពណ៌លឿងភ្លឺរាងអក្សរវីលើស្លឹក",
    "broad white or yellow bands on either side of leaf midrib": "ឆ្នូតធំៗពណ៌សឬលឿងសងខាងទ្រនុងស្លឹកពោត",
    "clusters of aphids under leaves": "មានសត្វល្អិតចៃស្លឹកផ្តុំគ្នានៅក្រោមស្លឹក",
    "crazy top symptom with leafy tassel proliferation": "កំពូលដើមពោតបែកស្លឹកញឹកញុំារញ៉េរញ៉ៃខុសប្រក្រតី",
    "fern leaf symptom with extremely narrow distorted leaflets": "ស្លឹកប៉េងប៉ោះរួញតូចនិងខូចទ្រង់ទ្រាយដូចស្លឹកបន្លាស្អិត",
    "goosenecking and curved stalks at base (lodging)": "ដើមពោតកោងដូចកក្ងាននៅគល់និងងាយដួល",
    "pale water-soaked spots on green fruit (ghost spots)": "ចំណុចស្លេកៗដូចជាំទឹកនៅលើផ្លែខៀវ",
    "plants turn golden brown and dry (hopperburn)": "ដើមស្រូវប្រែពណ៌លឿងទុំហើយស្ងួតងាប់ដោយសារមមាច",
    "top dieback symptom with upper leaves dying prematurely": "រោគសញ្ញាងាប់ពីចុងដោយស្លឹកផ្នែកខាងលើងាប់ស្ងួតមុនអាយុ",
    "tubular hollow onion leaf gall silver shoot": "ស្លឹកស្រូវក្លាយជាបំពង់ប្រហោងពណ៌ប្រាក់ដូចស្លឹកខ្ទឹម",
    "v-shaped yellowing starting from leaf tip along midrib": "ស្លឹកប្រែពណ៌លឿងរាងអក្សរវីចាប់ពីចុងស្លឹកតាមទ្រនុង",
    "crater-like scabs with olive-green velvety mold on fruit": "មានស្នាមក្រមរដូចមាត់រណ្ដៅជាមួយផ្សិតពណ៌បៃតងចាស់លើផ្លែ",
    "decayed fruit becomes soft, watery and unmarketable": "ផ្លែដែលរលួយប្រែជាទន់ ជាំទឹក និងលក់មិនចេញ",
    "deep scars, crevices, and convolutions at blossom end of fruit": "មានស្នាមឆ្នូតជ្រៅ ប្រេះ និងរួញក្រញង់នៅផ្នែកខាងចុងផ្លែ",
    "fat white c-shaped grubs discovered in soil ridge": "ប្រទះឃើញដង្កូវដួងពណ៌សធាត់ៗរាងកោងកណ្ដុរប្រមេះក្នុងដីរង",
    "heavy bead-like galls on roots causing clubbed appearance": "មានពកឫសធំៗដូចគ្រាប់អង្កាំធ្វើឱ្យឫសឡើងប៉ោងខូចទ្រង់ទ្រាយ",
    "individual leaves wilt during hot day, recover at night, then wilt permanently": "ស្លឹកស្រពោនពេលថ្ងៃក្តៅ ងើបឡើងវិញពេលយប់ រួចស្រពោនងាប់ទាំងស្រុង",
    "internal cavities lined with white or blue-pink mold": "ប្រហោងខាងក្នុងផ្លែមានស្រទាប់ផ្សិតពណ៌សឬផ្កាឈូកលាយខៀវ",
    "sawdust-like frass ejected around stem boreholes": "មានកាកសំណល់ដូចកម្ទេចឈើរុញចេញជុំវិញរន្ធចោះលើដើម",
    "severe stunting of plant with bushy broom-like canopy": "ដើមរុក្ខជាតិក្រិនខ្លាំងហើយបែកមែកញឹកដូចអំបោស",
    "stunted umbrella-like canopy": "គុម្ពដំណាំក្រិនមានទម្រង់ដូចឆ័ត្រ",
    "stunted vines with bitter small fruits": "ទងវល្លិ៍ក្រិននិងឲ្យផ្លែតូចៗមានរសជាតិល្វីង",
    "stunted vines with pale green to yellowish foliage": "ទងវល្លិ៍ក្រិនជាមួយស្លឹកពណ៌បៃតងស្លេកទៅលឿង",
    "sunken water-soaked circular lesions on ripe fruit": "មានស្នាមដំបៅលិចជ្រៅរាងមូលដូចជាំទឹកលើផ្លែទុំ",
    "tuber becomes light, dry and shriveled like stone": "មើមប្រែជាស្រាល ស្ងួត និងរួញរឹងដូចថ្ម",
    "water-soaked lesions on stems near soil line": "មានស្នាមដំបៅជាំទឹកនៅលើដើមក្បែរផ្ទៃដី",
    "water-soaked sunken spots on fruit exuding amber gum": "មានចំណុចជាំទឹកលិចជ្រៅលើផ្លែនិងបញ្ចេញជ័រពណ៌ទឹកឃ្មុំ",
    "water-soaked yellow brown sunken lesions on underside of fruit touching soil": "ស្នាមដំបៅជាំទឹកពណ៌លឿងត្នោតលិចជ្រៅនៅផ្នែកក្រោមផ្លែដែលប៉ះផ្ទៃដី",
}


def clean_khmer_text(text: Optional[str]) -> str:
    """Ensure Khmer text contains no stray latin tokens or placeholder artifacts."""
    if not text:
        return ""
    cleaned = str(text).strip()
    # Remove surrogate characters, replacement chars, and question mark placeholders
    cleaned = re.sub(r"[\ufffd\u202a-\u202e]", "", cleaned)
    # Normalize multiple whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def has_english(text: Optional[str]) -> bool:
    """Return True if text contains any ASCII alphabet characters."""
    if not text:
        return False
    return bool(re.search(r"[a-zA-Z]", str(text)))
