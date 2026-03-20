from __future__ import annotations

import base64
import io
import json
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

import numpy as np
import requests as http_requests
from PIL import Image, ImageEnhance

from app.config import get_settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Image pre-processing
# ---------------------------------------------------------------------------

def _preprocess_for_ocr(image: Image.Image) -> Image.Image:
    """Enhance image for better Devanagari OCR accuracy."""
    img = image.convert("RGB")

    # Upscale small images so OCR models can detect text better
    min_dim = min(img.size)
    if min_dim < 1500:
        scale = max(2, 1500 // min_dim)
        img = img.resize(
            (img.size[0] * scale, img.size[1] * scale),
            Image.LANCZOS,
        )

    # Mild contrast and sharpness boost
    img = ImageEnhance.Contrast(img).enhance(1.3)
    img = ImageEnhance.Sharpness(img).enhance(1.5)

    return img


# ---------------------------------------------------------------------------
# EasyOCR line merging helper
# ---------------------------------------------------------------------------

def _merge_easyocr_lines(
    results: list,
) -> list[tuple[str, float]]:
    """Merge EasyOCR detections that sit on the same horizontal line."""
    if not results:
        return []

    items: list[tuple[float, float, float, str, float]] = []
    for bbox, text, confidence in results:
        y_center = (bbox[0][1] + bbox[2][1]) / 2
        box_height = abs(bbox[2][1] - bbox[0][1])
        x_left = bbox[0][0]
        items.append((y_center, x_left, box_height, str(text).strip(), float(confidence)))

    items.sort(key=lambda it: it[0])

    heights = [it[2] for it in items if it[2] > 0]
    median_height = sorted(heights)[len(heights) // 2] if heights else 40
    y_threshold = median_height * 0.6

    merged: list[tuple[str, float]] = []
    current_group: list[tuple[float, float, float, str, float]] = [items[0]]

    for item in items[1:]:
        prev_y = current_group[-1][0]
        if abs(item[0] - prev_y) < y_threshold:
            current_group.append(item)
        else:
            current_group.sort(key=lambda it: it[1])
            line_text = " ".join(it[3] for it in current_group)
            avg_conf = sum(it[4] for it in current_group) / len(current_group)
            merged.append((line_text, avg_conf))
            current_group = [item]

    if current_group:
        current_group.sort(key=lambda it: it[1])
        line_text = " ".join(it[3] for it in current_group)
        avg_conf = sum(it[4] for it in current_group) / len(current_group)
        merged.append((line_text, avg_conf))

    return merged


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class OcrLine:
    text: str
    confidence: float


@dataclass
class OcrResult:
    lines: list[OcrLine]
    engine_used: str
    warnings: list[str]


# ---------------------------------------------------------------------------
# OCR Service
# ---------------------------------------------------------------------------

class OcrService:
    def __init__(self) -> None:
        # EasyOCR state
        self._easyocr = None
        self._easyocr_failed = False
        self._easyocr_error_message: str | None = None

        # OCR.space state
        self._ocr_space_error_message: str | None = None

    # ---- public -----------------------------------------------------------

    def extract_text(self, images: Sequence[Image.Image]) -> OcrResult:
        # 1) Try OCR.space (free, fast, good Devanagari support)
        logger.info("Trying OCR.space...")
        t0 = time.time()
        result = self._run_ocr_space(images)
        if result:
            logger.info("OCR.space took %.1fs", time.time() - t0)
            return result
        logger.warning("OCR.space failed, falling back to EasyOCR")

        # 2) Fallback to EasyOCR
        logger.info("Running EasyOCR...")
        t0 = time.time()
        result = self._run_easyocr(images)
        logger.info("EasyOCR took %.1fs", time.time() - t0)

        if result:
            return result

        # 3) Nothing worked
        warnings: list[str] = []
        if self._ocr_space_error_message:
            warnings.append(self._ocr_space_error_message)
        if self._easyocr_error_message:
            warnings.append(self._easyocr_error_message)
        warnings.append("OCR engine उपलब्ध नाही. Raw text manually भरावा लागेल.")
        return OcrResult(lines=[], engine_used="none", warnings=warnings)

    # ---- OCR.space ---------------------------------------------------------

    def _run_ocr_space(self, images: Sequence[Image.Image]) -> OcrResult | None:
        settings = get_settings()
        api_key = settings.ocr_space_api_key

        if not api_key:
            self._ocr_space_error_message = "OCR.space API key सेट नाही."
            return None

        lines: list[OcrLine] = []

        try:
            for image in images:
                # Light preprocessing for OCR.space (it has its own scaling via scale=true)
                img = image.convert("RGB")
                img = ImageEnhance.Contrast(img).enhance(1.3)
                img = ImageEnhance.Sharpness(img).enhance(1.5)

                # Use JPEG to keep under 1MB (free tier limit)
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=90)

                # If still over 900KB, reduce quality
                if buf.tell() > 900_000:
                    buf = io.BytesIO()
                    img.save(buf, format="JPEG", quality=70)

                img_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")

                payload = {
                    "apikey": api_key,
                    "base64Image": f"data:image/png;base64,{img_base64}",
                    "language": "auto",      # Auto-detect — works for Marathi/Devanagari
                    "OCREngine": "2",        # Engine 2 — best for Devanagari + auto-detect
                    "isOverlayRequired": "false",
                    "scale": "true",         # Better for low-res images
                    "detectOrientation": "true",
                }

                response = http_requests.post(
                    "https://api.ocr.space/parse/image",
                    data=payload,
                    timeout=60,
                )

                if response.status_code != 200:
                    raise Exception(f"OCR.space HTTP {response.status_code}")

                data = response.json()

                if data.get("IsErroredOnProcessing"):
                    error_msgs = data.get("ErrorMessage", ["Unknown error"])
                    if isinstance(error_msgs, list):
                        error_msgs = "; ".join(str(e) for e in error_msgs)
                    raise Exception(f"OCR.space error: {error_msgs}")

                if data.get("OCRExitCode", 0) not in (1, 2):
                    # Exit code 1 = success, 2 = partial success
                    raise Exception(f"OCR.space exit code: {data.get('OCRExitCode')}")

                parsed_results = data.get("ParsedResults", [])
                for result in parsed_results:
                    parsed_text = result.get("ParsedText", "")
                    for line in parsed_text.splitlines():
                        stripped = line.strip()
                        if stripped:
                            lines.append(OcrLine(text=stripped, confidence=0.85))

        except Exception as error:
            self._ocr_space_error_message = f"OCR.space scan झाले नाही: {error}"
            logger.exception("OCR.space error")
            return None

        if not lines:
            return None

        return OcrResult(lines=lines, engine_used="ocr_space", warnings=[])

    # ---- EasyOCR ----------------------------------------------------------

    def _run_easyocr(self, images: Sequence[Image.Image]) -> OcrResult | None:
        if self._easyocr_failed:
            return None

        try:
            import easyocr
        except (ImportError, OSError, Exception) as error:
            self._easyocr_failed = True
            self._easyocr_error_message = f"EasyOCR import झाले नाही: {error}"
            return None

        try:
            if self._easyocr is None:
                self._easyocr = easyocr.Reader(["mr", "en"], gpu=False)
        except Exception as error:
            self._easyocr_failed = True
            self._easyocr_error_message = f"EasyOCR सुरू झाले नाही: {error}"
            return None

        lines: list[OcrLine] = []
        try:
            for image in images:
                processed = _preprocess_for_ocr(image)
                results = self._easyocr.readtext(np.array(processed))
                merged = _merge_easyocr_lines(results)
                for text, confidence in merged:
                    stripped = str(text).strip()
                    if stripped:
                        lines.append(OcrLine(text=stripped, confidence=float(confidence)))
        except Exception as error:
            self._easyocr_failed = True
            self._easyocr_error_message = f"EasyOCR scan झाले नाही: {error}"
            return None

        return OcrResult(lines=lines, engine_used="easyocr", warnings=[])
