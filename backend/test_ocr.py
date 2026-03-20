import sys
import logging
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# Fix Windows console encoding for Devanagari output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Setup path and logging
sys.path.append(r'd:\Bio-Data\backend')
logging.basicConfig(level=logging.INFO)

from app.services.ocr import OcrService
from app.services.parser import parse_structured_fields

FONT_PATH = Path(__file__).resolve().parent / "app" / "assets" / "fonts" / "NotoSansDevanagari-Regular.ttf"


def main():
    print("Generating test image...")
    img = Image.new('RGB', (800, 600), color='white')
    d = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype(str(FONT_PATH), 28)
    except Exception as e:
        print(f"Font error (tried {FONT_PATH}): {e}")
        font = ImageFont.load_default()

    text = "मुलाचे नाव: सिद्धार्थ पाटील\nजन्मतारीख: १२-०५-१९९०\nउंची: ५ फूट ८ इंच\nपत्ता: पुणे, महाराष्ट्र"
    d.text((50, 50), text, fill='black', font=font)

    # Save test image so we can visually verify
    test_img_path = Path(__file__).resolve().parent / "test_bio.png"
    img.save(str(test_img_path))
    print(f"Test image saved to {test_img_path}")

    print("Testing OcrService...")
    ocr_svc = OcrService()
    res = ocr_svc.extract_text([img])

    print("=== SUMMARY ===")
    print(f"Engine used: {res.engine_used}")
    print(f"Warnings: {res.warnings}")

    print("\n=== EXTRACTED LINES ===")
    for line in res.lines:
        print(f"[{line.confidence:.2f}] {line.text}")

    print("\n=== PARSED OUTPUT ===")
    raw_text = "\n".join([line.text for line in res.lines])
    fields, missing, low_conf = parse_structured_fields(raw_text)
    print("Personal:", fields.get("personal", {}))
    print(f"Missing fields: {missing}")
    print(f"Low confidence: {low_conf}")


if __name__ == "__main__":
    main()
