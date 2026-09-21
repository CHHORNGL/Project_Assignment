import unittest

from scripts.export_to_jsonl import _split


class ExportToJsonlTestCase(unittest.TestCase):
    def test_split_is_deterministic_and_complete(self):
        records = [
            {"metadata": {"record_id": f"record:{index}"}, "messages": []}
            for index in range(100)
        ]

        train_a, validation_a = _split(records, 0.2)
        train_b, validation_b = _split(records, 0.2)

        self.assertEqual(train_a, train_b)
        self.assertEqual(validation_a, validation_b)
        self.assertEqual(len(train_a) + len(validation_a), len(records))
        self.assertEqual(
            {record["metadata"]["record_id"] for record in train_a}
            | {record["metadata"]["record_id"] for record in validation_a},
            {record["metadata"]["record_id"] for record in records},
        )


if __name__ == "__main__":
    unittest.main()
