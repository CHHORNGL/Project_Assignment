import unittest

from app.services.agri_agent import agent_metadata, plan_request


class AgriAgentPlanningTestCase(unittest.TestCase):
    def test_khmer_weather_request_uses_weather_and_requests_location(self):
        plan = plan_request("សូមប្រាប់អំពីអាកាសធាតុ និងភ្លៀងសម្រាប់ស្រែរបស់ខ្ញុំ", language="km")

        self.assertEqual(plan.intent, "weather_advice")
        self.assertEqual(plan.tools, ("weather", "knowledge_base"))
        self.assertTrue(plan.needs_location)

    def test_weather_request_with_coordinates_can_use_weather_tool(self):
        plan = plan_request(
            "Will rain affect my rice field?",
            latitude=11.55,
            longitude=104.92,
        )

        self.assertFalse(plan.needs_location)
        self.assertIn("weather", plan.tools)

    def test_diagnosis_image_never_becomes_an_unrestricted_tool_call(self):
        plan = plan_request("Please check this leaf", has_image=True)

        self.assertEqual(plan.intent, "crop_health")
        self.assertIn("diagnosis_guidance", plan.tools)
        self.assertTrue(plan.has_image)

    def test_action_request_is_confirmation_gated(self):
        plan = plan_request("រំលឹកខ្ញុំឱ្យស្រោចទឹកថ្ងៃស្អែក", language="km")

        self.assertEqual(plan.intent, "action_request")
        self.assertIn("confirmation_gate", plan.tools)
        self.assertEqual(agent_metadata(plan)["intent"], "action_request")


if __name__ == "__main__":
    unittest.main()
