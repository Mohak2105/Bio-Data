from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str
    cors_origins: list[str]
    font_regular_path: Path
    font_bold_path: Path
    google_vision_credentials: Path | None
    google_vision_monthly_limit: int
    vision_usage_file: Path
    ocr_space_api_key: str


@lru_cache
def get_settings() -> Settings:
    font_root = Path(__file__).resolve().parent / "assets" / "fonts"
    backend_root = Path(__file__).resolve().parent.parent
    cors_origins = os.getenv(
        "PORTAL_CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177,http://127.0.0.1:5173",
    )

    # Google Vision credentials path — set via env var or default location
    gv_creds_env = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    gv_creds_path: Path | None = None
    if gv_creds_env and Path(gv_creds_env).exists():
        gv_creds_path = Path(gv_creds_env)
    else:
        default_creds = backend_root / "credentials" / "google_vision_key.json"
        if default_creds.exists():
            gv_creds_path = default_creds

    return Settings(
        app_name="Marathi Biodata API",
        cors_origins=[origin.strip() for origin in cors_origins.split(",") if origin.strip()],
        font_regular_path=font_root / "NotoSansDevanagari-Regular.ttf",
        font_bold_path=font_root / "NotoSansDevanagari-Bold.ttf",
        google_vision_credentials=gv_creds_path,
        google_vision_monthly_limit=int(os.getenv("GOOGLE_VISION_MONTHLY_LIMIT", "900")),
        vision_usage_file=backend_root / "vision_usage.json",
        ocr_space_api_key=os.getenv("OCR_SPACE_API_KEY", "K89659870988957"),
    )
