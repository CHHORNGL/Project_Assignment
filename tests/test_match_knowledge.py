import sys
import unittest
import importlib.util
from pathlib import Path
from unittest.mock import MagicMock

# Mock ZeroGPU & heavy ML packages before importing space app
sys.modules.setdefault("spaces", MagicMock())
sys.modules.setdefault("torch", MagicMock())
sys.modules.setdefault("gradio", MagicMock())
sys.modules.setdefault("peft", MagicMock())
sys.modules.setdefault("transformers", MagicMock())

_SPACE_DIR = Path(__file__).parents[1] / "huggingface-space"
if str(_SPACE_DIR) not in sys.path:
    sys.path.insert(0, str(_SPACE_DIR))

_APP_PATH = _SPACE_DIR / "app.py"
_SPEC = importlib.util.spec_from_file_location("space_app_under_test", _APP_PATH)
space_app = importlib.util.module_from_spec(_SPEC)
assert _SPEC and _SPEC.loader
_SPEC.loader.exec_module(space_app)


class MatchKnowledgeTestCase(unittest.TestCase):
    def test_khmer_durian_root_rot_orthography(self):
        # Test both ឫស and ឬស spellings
        m1 = space_app._match_knowledge("តើជំងឺរលួយឫសលើដើមទុរេនត្រូវព្យាបាលយ៉ាងម៉េច?")
        self.assertIsNotNone(m1)
        self.assertIn("Phytophthora", m1["title_km"])

        m2 = space_app._match_knowledge("ដើមទុរេនរបស់ខ្ញុំរលួយឬស")
        self.assertIsNotNone(m2)
        self.assertIn("Phytophthora", m2["title_km"])

    def test_english_disease_queries(self):
        m1 = space_app._match_knowledge("my durian tree has root rot, what should I do?")
        self.assertIsNotNone(m1)
        self.assertIn("Durian Root Rot", m1["title_en"])

        m2 = space_app._match_knowledge("what should i do if my rice has blast?")
        self.assertIsNotNone(m2)
        self.assertIn("Rice Blast", m2["title_en"])

        m3 = space_app._match_knowledge("whiteflies on my cassava")
        self.assertIsNotNone(m3)
        self.assertIn("Cassava Mosaic", m3["title_en"])

        m4 = space_app._match_knowledge("corn has armyworms")
        self.assertIsNotNone(m4)
        self.assertIn("Fall Armyworm", m4["title_en"])

    def test_catalog_listing_queries(self):
        m_km = space_app._match_knowledge("តើដំណាំស្រូវមានជំងឺអ្វីខ្លះ?")
        self.assertIsNotNone(m_km)
        self.assertTrue(m_km.get("is_catalog"))
        self.assertEqual(m_km.get("crop_km"), "ស្រូវ")

        m_en = space_app._match_knowledge("what diseases affect tomato?")
        self.assertIsNotNone(m_en)
        self.assertTrue(m_en.get("is_catalog"))
        self.assertEqual(m_en.get("crop_en"), "Tomato")

    def test_individual_catalog_diseases(self):
        # Rice brown spot
        m1 = space_app._match_knowledge("តើជំងឺអុចត្នោតស្រូវត្រូវព្យាបាលយ៉ាងណា?")
        self.assertIsNotNone(m1)
        self.assertIn("Rice Brown Spot", m1["title_en"])
        self.assertFalse(m1.get("is_catalog"))

        # Brown planthopper
        m2 = space_app._match_knowledge("How to manage Brown Planthopper on rice?")
        self.assertIsNotNone(m2)
        self.assertIn("Brown Planthopper", m2["title_en"])

        # Potato late blight
        m3 = space_app._match_knowledge("Potato late blight treatment")
        self.assertIsNotNone(m3)
        self.assertIn("Potato Late Blight", m3["title_en"])

    def test_agricultural_practices(self):
        # Soil liming
        m_soil = space_app._match_knowledge("តើដីជូរត្រូវកែតម្រូវយ៉ាងដូចម្តេច?")
        self.assertIsNotNone(m_soil)
        self.assertIn("Soil Management", m_soil["title_en"])

        # NPK
        m_npk = space_app._match_knowledge("របៀបដាក់ជី NPK ឱ្យមានតុល្យភាព")
        self.assertIsNotNone(m_npk)
        self.assertIn("N-P-K", m_npk["title_en"])

        # Crop rotation
        m_rot = space_app._match_knowledge("what are the benefits of crop rotation with legumes?")
        self.assertIsNotNone(m_rot)
        self.assertIn("Crop Rotation", m_rot["title_en"])

        # IPM
        m_ipm = space_app._match_knowledge("តើ IPM ជាអ្វី?")
        self.assertIsNotNone(m_ipm)
        self.assertIn("IPM", m_ipm["title_en"])

    def test_smooth_human_reply_format(self):
        m = space_app._match_knowledge("តើជំងឺរលួយឫសលើដើមទុរេនត្រូវព្យាបាលយ៉ាងម៉េច?")
        reply_km = space_app._format_smooth_human_reply(m, is_khmer=True)
        # Verify warm respectful greeting
        self.assertIn("ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព!", reply_km)
        # Verify numbered sections
        self.assertIn("១. រោគសញ្ញាសម្គាល់ជាក់ស្តែង", reply_km)
        self.assertIn("២. វិធានការព្យាបាល និងការអនុវត្តបន្ទាន់", reply_km)
        self.assertIn("៣. វិធានការបង្ការ និងការថែទាំរយៈពេលវែង", reply_km)
        # Verify safety reminder
        self.assertIn("ការណែនាំសុវត្ថិភាព", reply_km)
        # Verify no markdown headers or bold asterisks
        self.assertNotIn("###", reply_km)
        self.assertNotIn("**", reply_km)

        reply_en = space_app._format_smooth_human_reply(m, is_khmer=False)
        self.assertIn("Greetings!", reply_en)
        self.assertIn("1. Identifiable Symptoms", reply_en)
        self.assertIn("2. Immediate Treatment", reply_en)
        self.assertIn("3. Long-Term Prevention", reply_en)
        self.assertIn("Safety Reminder:", reply_en)
        self.assertNotIn("###", reply_en)
        self.assertNotIn("**", reply_en)

    def test_expanded_crops_and_fertilizer(self):
        # Mango catalog query
        m_mango = space_app._match_knowledge("តើដំណាំស្វាយមានជំងឺអ្វីខ្លះ?")
        self.assertIsNotNone(m_mango)
        self.assertTrue(m_mango.get("is_catalog"))
        self.assertEqual(m_mango.get("crop_km"), "ស្វាយ")

        # Mango anthracnose
        m_anth = space_app._match_knowledge("ស្វាយកើតអុចខ្មៅ")
        self.assertIsNotNone(m_anth)
        self.assertIn("Mango Anthracnose", m_anth["title_en"])

        # Urea query
        m_urea = space_app._match_knowledge("តើត្រូវដាក់ជីអ៊ុយរ៉េយ៉ាងដូចម្តេច?")
        self.assertIsNotNone(m_urea)
        self.assertIn("Fertilizer", m_urea["title_en"])

        # Citrus
        m_citrus = space_app._match_knowledge("តើដំណាំក្រូចមានជំងឺអ្វីខ្លះ?")
        self.assertIsNotNone(m_citrus)
        self.assertEqual(m_citrus.get("crop_km"), "ក្រូច")

        # Cashew
        m_cashew = space_app._match_knowledge("បញ្ជីជំងឺស្វាយចន្ទី")
        self.assertIsNotNone(m_cashew)
        self.assertEqual(m_cashew.get("crop_km"), "ស្វាយចន្ទី")

        # Longan
        m_longan = space_app._match_knowledge("តើដំណាំមៀនមានជំងឺអ្វីខ្លះ?")
        self.assertIsNotNone(m_longan)
        self.assertEqual(m_longan.get("crop_km"), "មៀន")

        # Watermelon
        m_wm = space_app._match_knowledge("ជំងឺឪឡឹក")
        self.assertIsNotNone(m_wm)
        self.assertEqual(m_wm.get("crop_km"), "ឪឡឹក")

        # Coconut
        m_coco = space_app._match_knowledge("បញ្ជីសត្វល្អិតលើដំណាំដូង")
        self.assertIsNotNone(m_coco)
        self.assertEqual(m_coco.get("crop_km"), "ដូង")

        # Coffee
        m_coffee = space_app._match_knowledge("តើដំណាំកាហ្វេមានជំងឺអ្វីខ្លះ?")
        self.assertIsNotNone(m_coffee)
        self.assertEqual(m_coffee.get("crop_km"), "កាហ្វេ")

        # Eggplant
        m_egg = space_app._match_knowledge("ជំងឺដំណាំត្រប់")
        self.assertIsNotNone(m_egg)
        self.assertEqual(m_egg.get("crop_km"), "ត្រប់")

        # Cabbage
        m_cab = space_app._match_knowledge("ជំងឺលើស្ពៃក្តោប")
        self.assertIsNotNone(m_cab)
        self.assertEqual(m_cab.get("crop_km"), "ស្ពៃ")

    def test_khmer_text_validator_rejects_corrupted_tokens(self):
        # Corrupted gibberish reported by user with Latin artifacts, broken vowels, obsolete characters
        bad_text = "សូជីយូ! សើរតែថាជាកសិkcម្មរាកលើពេក? ខ្ញុ៊ណែះណាដឹង សាបស្រោច សឿងស្រពដោំឡើប! ប្លែកចំហៀងដែនម៉ baybayin ខ្លះ ស឴ឫសចំពោៗម៉"
        self.assertFalse(space_app._is_valid_khmer_text(bad_text))

        # Valid expert reply should pass
        good_text = "ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព! ចំពោះដំណាំស្វាយដែលមានជំងឺអុចខ្មៅ ឬអង់ត្រាក់ណូស សូមអនុវត្តដូចខាងក្រោម៖ ១. កាត់មែកនិងប្រមូលផ្លែដែលរងការបំផ្លាញដុតចោល។ ២. បាញ់ថ្នាំការពារដូចជា Copper hydroxide ឬ Mancozeb។"
        self.assertTrue(space_app._is_valid_khmer_text(good_text))



if __name__ == "__main__":
    unittest.main()
