from __future__ import annotations

import unittest

from app.services.parser import extract_template_settings, parse_structured_fields


class ParserTests(unittest.TestCase):
    def test_parser_extracts_marathi_fields(self) -> None:
        sample = """
        भैरवनाथ वधू वर सूचक केंद्र
        वैयक्तिक माहिती
        मुलाचे नाव: संकेत राजाराम मांढरे
        जन्मतारीख: 06.11.1995
        जन्मवेळ: सकाळी 05.32.18 वाजता
        जन्मठिकाण: पाचवड
        शिक्षण: B. Com
        व्यवसाय: Consultant in CapGemini
        उत्पन्न: 5 लाख
        जात: हिंदू मराठा
        रास: मेष
        नाडी: आद्य
        रक्तगट: A+
        वडील: श्री. राजाराम रामचंद्र मांढरे
        आई: सौ. सुनीता राजाराम मांढरे
        पत्ता: A-301 आदित्य अपार्टमेंट, आंबेगाव
        अपेक्षा: सुसंस्कृत, मनमिळाऊ
        पालक संपर्क: 9323048045 / 9130583042
        """

        structured_fields, missing_fields, low_confidence_fields = parse_structured_fields(sample)

        self.assertEqual(structured_fields["personal"]["full_name"], "संकेत राजाराम मांढरे")
        self.assertEqual(structured_fields["personal"]["birth_date"], "06.11.1995")
        self.assertEqual(structured_fields["horoscope"]["rashi"], "मेष")
        self.assertIn("9323048045", structured_fields["contacts"]["parent_contact"])
        self.assertFalse(missing_fields)
        self.assertFalse(low_confidence_fields)

    def test_extract_template_settings(self) -> None:
        sample = """
        भैरवनाथ वधू वर सूचक केंद्र
        आयडी क्रमांक :- 30
        मुलाचे नाव: संकेत मांढरे
        """

        template_settings = extract_template_settings(sample)

        self.assertEqual(template_settings["center_name"], "भैरवनाथ वधू वर सूचक केंद्र")
        self.assertEqual(template_settings["id_value"], "30")

    def test_parser_handles_label_only_and_space_separated_values(self) -> None:
        sample = """
        मुलाचे नाव
        कु. संकेत राजाराम मांढरे
        जन्मतारीख 06.11.1995
        जन्म वेळ
        सकाळी 05.32.18 वाजता
        रास मेष
        नाडी आद्य
        रक्तगट A+
        शिक्षण B. Com
        नोकरी Consultant in CapGemini
        उत्पन्न 5 लाख
        जात हिंदू मराठा
        अपेक्षा
        सुसंस्कृत, मनमिळाऊ
        ऑफिस संपर्क 9975285800
        """

        structured_fields, _missing_fields, _low_confidence_fields = parse_structured_fields(sample)

        self.assertEqual(structured_fields["personal"]["full_name"], "कु. संकेत राजाराम मांढरे")
        self.assertEqual(structured_fields["personal"]["birth_time"], "सकाळी 05.32.18 वाजता")
        self.assertEqual(structured_fields["horoscope"]["blood_group"], "A+")
        self.assertEqual(structured_fields["personal"]["occupation"], "Consultant in CapGemini")
        self.assertEqual(structured_fields["contacts"]["office_contact"], "9975285800")
        self.assertEqual(structured_fields["preferences"]["expectation"], "सुसंस्कृत, मनमिळाऊ")


if __name__ == "__main__":
    unittest.main()
