from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_health_endpoint(self) -> None:
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_render_endpoint_returns_jpg(self) -> None:
        payload = {
            "structuredFields": {
                "personal": {
                    "fullName": "संकेत मांढरे",
                    "birthDate": "06.11.1995",
                    "education": "B.Com",
                    "occupation": "Consultant",
                },
                "horoscope": {
                    "rashi": "मेष",
                    "bloodGroup": "A+",
                },
                "family": {
                    "address": "पुणे",
                },
                "contacts": {
                    "parentContact": "9323048045",
                },
                "preferences": {
                    "expectation": "सुसंस्कृत",
                },
            },
            "templateSettings": {
                "centerName": "भैरवनाथ वधू वर सूचक केंद्र",
                "idLabel": "आयडी क्रमांक",
                "idValue": "30",
                "watermarkText": "भैरवनाथ वधू वर सूचक केंद्र",
                "footerText": "भैरवनाथ वधू वर सूचक केंद्र",
                "accentColor": "#9a2d15",
                "showWatermark": True,
            },
            "templateId": "basic-marathi-v1",
        }

        response = self.client.post("/api/render/jpg", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "image/jpeg")
        self.assertGreater(len(response.content), 1000)

    def test_preview_render_endpoint_returns_png(self) -> None:
        payload = {
            "structuredFields": {
                "personal": {
                    "fullName": "संकेत मांढरे",
                    "birthDate": "06.11.1995",
                    "education": "B.Com",
                    "occupation": "Consultant",
                },
                "horoscope": {
                    "rashi": "मेष",
                    "bloodGroup": "A+",
                },
                "family": {
                    "address": "पुणे",
                },
                "contacts": {
                    "parentContact": "9323048045",
                },
                "preferences": {
                    "expectation": "सुसंस्कृत",
                },
            },
            "templateSettings": {
                "centerName": "भैरवनाथ वधू वर सूचक केंद्र",
                "idLabel": "आयडी क्रमांक",
                "idValue": "30",
                "watermarkText": "भैरवनाथ वधू वर सूचक केंद्र",
                "footerText": "भैरवनाथ वधू वर सूचक केंद्र",
                "accentColor": "#9a2d15",
                "showWatermark": True,
            },
            "templateId": "basic-marathi-v1",
        }

        response = self.client.post("/api/render/preview", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "image/png")
        self.assertGreater(len(response.content), 1000)


if __name__ == "__main__":
    unittest.main()
