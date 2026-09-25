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


if __name__ == "__main__":
    unittest.main()
