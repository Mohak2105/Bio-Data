from __future__ import annotations

import unittest
from unittest.mock import patch

from app.services.ocr import OcrResult, OcrService


class OcrTests(unittest.TestCase):
    def test_extract_text_reports_missing_engine_clearly(self) -> None:
        service = OcrService()

        def fake_run_easyocr(_images):
            service._easyocr_error_message = "EasyOCR import झाले नाही: No module named 'easyocr'"
            return None

        with patch.object(service, "_run_easyocr", side_effect=fake_run_easyocr):
            result = service.extract_text([])

        self.assertEqual(result.engine_used, "none")
        self.assertEqual(result.lines, [])
        self.assertEqual(
            result.warnings,
            [
                "EasyOCR import झाले नाही: No module named 'easyocr'",
                "OCR engine उपलब्ध नाही. Raw text manually भरावा लागेल.",
            ],
        )

    def test_extract_text_returns_easyocr_result(self) -> None:
        service = OcrService()
        easyocr_result = OcrResult(lines=[], engine_used="easyocr", warnings=[])

        with patch.object(service, "_run_easyocr", return_value=easyocr_result):
            result = service.extract_text([])

        self.assertEqual(result.engine_used, "easyocr")
        self.assertEqual(result.warnings, [])


if __name__ == "__main__":
    unittest.main()
