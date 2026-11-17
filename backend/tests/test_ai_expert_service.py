# ruff: noqa: I001
import pathlib as _pathlib
import sys as _sys

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)
import os
import unittest
import importlib.util
import sys
from pathlib import Path
from unittest.mock import Mock, patch


# Load this small HTTP client without importing ``app``. The broader test
# suite configures DATABASE_URL before importing Flask; importing app here at
# module load time would freeze the production .env URL first.
_SERVICE_PATH = Path(__file__).parents[1] / "app" / "services" / "ai_expert_service.py"
_SPEC = importlib.util.spec_from_file_location("ai_expert_service_under_test", _SERVICE_PATH)
_SERVICE = importlib.util.module_from_spec(_SPEC)
assert _SPEC and _SPEC.loader
sys.modules[_SPEC.name] = _SERVICE
_SPEC.loader.exec_module(_SERVICE)

_build_prompt = _SERVICE._build_prompt
_extract_text = _SERVICE._extract_text
generate_reply = _SERVICE.generate_reply
is_configured = _SERVICE.is_configured
_setting = _SERVICE._setting


class AiExpertServiceTestCase(unittest.TestCase):
    def test_prompt_contains_language_question_and_context(self):
        prompt_km = _build_prompt("តើខ្ញុំត្រូវព្យាបាលជំងឺនេះយ៉ាងដូចម្តេច?", "Disease: Rice Blast", "km")
        self.assertIn("សូមឆ្លើយជាភាសាខ្មែរ", prompt_km)
        self.assertIn("Disease: Rice Blast", prompt_km)
        self.assertIn("តើខ្ញុំត្រូវព្យាបាលជំងឺនេះយ៉ាងដូចម្តេច?", prompt_km)

        prompt_en = _build_prompt("How do I treat rice blast?", "Disease: Rice Blast", "en")
        self.assertIn("Answer in English", prompt_en)
        self.assertIn("How do I treat rice blast?", prompt_en)

    def test_extracts_common_response_shapes(self):
        self.assertEqual(_extract_text([{"generated_text": "reply"}]), "reply")
        self.assertEqual(_extract_text({"response": "reply"}), "reply")
        self.assertEqual(
            _extract_text({"choices": [{"message": {"content": "reply"}}]}),
            "reply",
        )
        self.assertEqual(_extract_text({"unexpected": True}), "")

    @patch.dict(
        os.environ,
        {
            "AI_PROVIDER": "huggingface",
            "HF_INFERENCE_URL": "https://example.invalid/generate",
            "HF_TOKEN": "test-token",
        },
        clear=False,
    )
    @patch("ai_expert_service_under_test.requests.post")
    def test_remote_reply_is_parsed(self, post):
        response = Mock()
        response.json.return_value = [{"generated_text": "A safe answer."}]
        response.raise_for_status.return_value = None
        post.return_value = response

        reply = generate_reply("What is rice blast?", context="Disease: Rice Blast")

        self.assertEqual(reply, "A safe answer.")
        post.assert_called_once()
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "Bearer test-token")

    @patch.dict(os.environ, {"AI_PROVIDER": "", "HF_INFERENCE_URL": ""}, clear=False)
    def test_unconfigured_provider_is_disabled(self):
        self.assertFalse(is_configured())
        self.assertIsNone(generate_reply("hello"))

    def test_legacy_provider_value_cannot_override_owner_model(self):
        # A stale deployment variable must not re-enable a commercial model.
        with patch.dict(os.environ, {"AI_PROVIDER": "openai"}, clear=False):
            self.assertEqual(_setting("AI_PROVIDER"), "own-ai")

    def test_invalid_huggingface_repo_url_in_site_setting_falls_back_to_env_space(self):
        fake_saved = Mock(value="https://huggingface.co/Maoseavik/agri-expert-adapter")
        with (
            patch.dict(
                os.environ,
                {
                    "AI_PROVIDER": "huggingface",
                    "HF_INFERENCE_URL": "https://maoseavik-agrisystem-agricultural-assistant.hf.space",
                },
                clear=False,
            ),
            patch("app.models.site_setting.SiteSetting") as site_setting_cls,
        ):
            site_setting_cls.query.get.return_value = fake_saved
            self.assertEqual(
                _setting("HF_INFERENCE_URL"),
                "https://maoseavik-agrisystem-agricultural-assistant.hf.space",
            )
            self.assertTrue(is_configured())

    def test_valid_hf_token_filters_expired_oauth_jwt(self):
        import base64
        import json

        valid_hf_token = _SERVICE._valid_hf_token
        self.assertEqual(valid_hf_token("hf_validPersonalAccessToken123"), "hf_validPersonalAccessToken123")
        expired_payload = base64.urlsafe_b64encode(json.dumps({"exp": 1700000000}).encode("utf-8")).decode("utf-8").rstrip("=")
        expired_oauth = f"hf_oauth_header.{expired_payload}.sig"
        self.assertIsNone(valid_hf_token(expired_oauth))

    def test_trained_dataset_answers_diverse_khmer_and_english_queries(self):
        synth = _SERVICE._synthesize_local_expert_reply

        # 1. Crop growing guide (English & Khmer, including catalog crops like Mango)
        ans_grow_en = synth("How to grow mango?", language="en")
        self.assertIn("Growing Mango", ans_grow_en)
        ans_grow_km = synth("របៀបដាំដុះដំណាំស្វាយ", language="km")
        self.assertIn("ស្វាយ", ans_grow_km)
        self.assertNotIn("ខ្ញុំបានកត់ត្រាសំណួររបស់អ្នករួចហើយ", ans_grow_km)

        # 2. Specific disease cause & prevention from train.json
        ans_cause_km = synth("តើអ្វីជាមូលហេតុនៃជំងឺអុចខ្មៅស៊ីហ្គាតូកាចេក?", language="km")
        self.assertIn("មូលហេតុ", ans_cause_km)
        self.assertIn("ចេក", ans_cause_km)

        ans_cause_en = synth("What causes Corn Smut in Corn?", language="en")
        self.assertIn("Corn Smut", ans_cause_en)

        # 3. Practical problem solving from conversational_data.py / train.json
        ans_scale_km = synth("ខ្ញុំគ្មានជញ្ជីងថ្លឹងជីគីមីទេ តើអាចវាស់កម្រិតជីដោយរបៀបណា?", language="km")
        self.assertIn("ស្លាបព្រាបាយ", ans_scale_km)

        ans_compost_en = synth("How do I make organic liquid compost fertilizer at home from kitchen scraps?", language="en")
        self.assertIn("molasses", ans_compost_en)

        # 4. Emotional support / crop distress
        ans_empathy_en = synth("My crops are dying from a sudden disease outbreak, I feel heartbroken", language="en")
        self.assertIn("heartbreaking", ans_empathy_en)

    @patch.dict(
        os.environ,
        {
            "AI_PROVIDER": "huggingface",
            "HF_INFERENCE_URL": "https://maoseavik-agrisystem-agricultural-assistant.hf.space",
            "HF_TOKEN": "hf_validPersonalAccessToken123",
        },
        clear=False,
    )
    def test_generic_space_fallback_triggers_local_trained_dataset_reply(self):
        _SERVICE._SPACE_COOLDOWN_UNTIL.clear()
        with patch.object(
            _SERVICE,
            "request_endpoint",
            return_value=(
                "ជំរាបសួរលោកអ្នក ឬបងប្អូនកសិករជាទីគោរព!\n\n"
                "ខ្ញុំបានទទួលសំណួររបស់អ្នកហើយ។ ដើម្បីឱ្យខ្ញុំអាចវិភាគបញ្ហា និងផ្តល់រូបមន្តព្យាបាលឱ្យចំគោលដៅបំផុត សូមមេត្តាជួយប្រាប់បន្ថែមអំពី៖"
            ),
        ):
            reply = generate_reply("ខ្ញុំគ្មានជញ្ជីងថ្លឹងជីគីមីទេ តើអាចវាស់កម្រិតជីដោយរបៀបណា?", language="km")
            self.assertIsNotNone(reply)
            self.assertIn("ស្លាបព្រាបាយ", reply or "")


if __name__ == "__main__":
    unittest.main()
