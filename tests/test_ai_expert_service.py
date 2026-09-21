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


class AiExpertServiceTestCase(unittest.TestCase):
    def test_prompt_contains_language_question_and_context(self):
        prompt = _build_prompt("How do I treat rice blast?", "Disease: Rice Blast", "km")
        self.assertIn("Answer in Khmer", prompt)
        self.assertIn("Disease: Rice Blast", prompt)
        self.assertIn("How do I treat rice blast?", prompt)

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


if __name__ == "__main__":
    unittest.main()
