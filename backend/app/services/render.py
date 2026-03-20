from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFont

from app.config import get_settings
from app.schemas import StructuredFields, TemplateSettings
from app.services.images import decode_data_url


CANVAS_SIZE = (1080, 1080)


def build_biodata_image(
    structured_fields: StructuredFields,
    template_settings: TemplateSettings,
    photo_data_url: str | None,
) -> Image.Image:
    image = Image.new("RGB", CANVAS_SIZE, "#fffdfa")
    draw = ImageDraw.Draw(image)
    fonts = _load_fonts()
    accent = _parse_color(template_settings.accent_color)

    _draw_background(draw, template_settings, accent, fonts)
    _draw_title(draw, template_settings, accent, fonts)
    _draw_id(draw, template_settings, accent, fonts)
    _draw_section_divider(draw, accent)
    _draw_photo(draw, image, photo_data_url, fonts, template_settings)
    _draw_biodata_lines(draw, structured_fields, accent, fonts)
    _draw_footer(draw, template_settings, fonts)
    return image


def render_biodata(
    structured_fields: StructuredFields,
    template_settings: TemplateSettings,
    photo_data_url: str | None,
) -> bytes:
    image = build_biodata_image(structured_fields, template_settings, photo_data_url)

    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=95, subsampling=0)
    return buffer.getvalue()


def render_biodata_preview(
    structured_fields: StructuredFields,
    template_settings: TemplateSettings,
    photo_data_url: str | None,
) -> bytes:
    image = build_biodata_image(structured_fields, template_settings, photo_data_url)

    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def _draw_background(
    draw: ImageDraw.ImageDraw,
    template_settings: TemplateSettings,
    accent: tuple[int, int, int],
    fonts: dict[str, ImageFont.FreeTypeFont],
) -> None:
    width, height = CANVAS_SIZE
    draw.rectangle((0, 0, width, height), fill="#fffefb")
    
    # Add the outer border inset slightly from the edge
    inset = 16
    draw.rectangle((inset, inset, width - inset - 1, height - inset - 1), outline="#870044", width=8)

    pale = _mix(accent, (255, 255, 255), 0.76)
    outline = _mix(accent, (255, 255, 255), 0.88)

    for offset in range(0, 320, 36):
        draw.ellipse((20 - offset, 60 + offset, 220 - offset, 260 + offset), outline=outline, width=3)
        draw.ellipse((80 - offset, 120 + offset, 280 - offset, 320 + offset), outline=outline, width=2)

    for offset in range(0, 280, 42):
        draw.ellipse((860 + offset // 4, 40 + offset, 1020 + offset // 4, 200 + offset), outline=outline, width=2)

    if template_settings.show_watermark and template_settings.watermark_text.strip():
        text = template_settings.watermark_text.strip()
        bbox = draw.textbbox((0, 0), text, font=fonts["watermark"])
        text_width = bbox[2] - bbox[0]
        x_center = (CANVAS_SIZE[0] - text_width) // 2
        
        for y_pos in [300, 560, 820]:
            draw.text((x_center, y_pos), text, font=fonts["watermark"], fill=pale)
            
        draw.text((180, 1010), template_settings.footer_text.strip() or text, font=fonts["footer"], fill=pale)


def _draw_title(
    draw: ImageDraw.ImageDraw,
    template_settings: TemplateSettings,
    accent: tuple[int, int, int],
    fonts: dict[str, ImageFont.FreeTypeFont],
) -> None:
    title = template_settings.center_name.strip() or "भैरवनाथ वधू वर सूचक केंद्र"
    shadow = _mix(accent, (0, 0, 0), 0.45)
    bbox = draw.textbbox((0, 0), title, font=fonts["title"])
    x = (CANVAS_SIZE[0] - (bbox[2] - bbox[0])) // 2
    draw.text((x + 2, 45), title, fill=shadow, font=fonts["title"])
    draw.text((x, 41), title, fill=accent, font=fonts["title"])


def _draw_id(
    draw: ImageDraw.ImageDraw,
    template_settings: TemplateSettings,
    accent: tuple[int, int, int],
    fonts: dict[str, ImageFont.FreeTypeFont],
) -> None:
    id_label = template_settings.id_label.strip() or "आयडी क्रमांक"
    id_value = template_settings.id_value.strip() or " "
    text = f"{id_label} :- {id_value}"
    bbox = draw.textbbox((0, 0), text, font=fonts["id"])
    text_width = bbox[2] - bbox[0]
    
    # The photo frame box is horizontally between 652 and 1008.
    x_center = (652 + 1008) // 2
    x = x_center - (text_width // 2)
    y = 175  # Positioned right above the photo frame which starts at y=245
    
    draw.text((x, y), text, fill=accent, font=fonts["id"])


def _draw_section_divider(
    draw: ImageDraw.ImageDraw,
    accent: tuple[int, int, int],
) -> None:
    divider = _mix(accent, (255, 255, 255), 0.72)
    shadow = _mix(accent, (255, 255, 255), 0.9)
    draw.line((594, 165, 594, 905), fill=divider, width=3)
    draw.line((602, 165, 602, 905), fill=shadow, width=1)


def _draw_photo(
    draw: ImageDraw.ImageDraw,
    canvas: Image.Image,
    photo_data_url: str | None,
    fonts: dict[str, ImageFont.FreeTypeFont],
    template_settings: TemplateSettings | None = None,
) -> None:
    frame_box = (652, 235, 1008, 803)
    photo_box = (666, 250, 994, 789)
    shadow_box = (662, 245, 1018, 813)
    
    # Simple solid drop shadow matching the beige aesthetics
    draw.rounded_rectangle(shadow_box, radius=16, fill="#e3d6c8")
    
    draw.rounded_rectangle(frame_box, radius=12, fill="#fffdfa", outline="#e1d4c5", width=2)
    draw.rounded_rectangle(photo_box, radius=8, fill="#ffffff", outline="#d6cfc4", width=2)

    has_photo = False
    if not photo_data_url:
        draw.text((782, 515), "फोटो", fill="#775642", font=fonts["body"])
    else:
        try:
            photo = decode_data_url(photo_data_url)
            fitted = _fit_cover(photo, (photo_box[2] - photo_box[0], photo_box[3] - photo_box[1]))
            mask = Image.new("L", (photo_box[2] - photo_box[0], photo_box[3] - photo_box[1]), 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.rounded_rectangle((0, 0, mask.width, mask.height), radius=10, fill=255)
            canvas.paste(fitted, (photo_box[0], photo_box[1]), mask)
            has_photo = True
        except Exception:
            draw.text((706, 505), "फोटो वाचता आला नाही", fill="#775642", font=fonts["body"])



def _draw_biodata_lines(
    draw: ImageDraw.ImageDraw,
    structured_fields: StructuredFields,
    accent: tuple[int, int, int],
    fonts: dict[str, ImageFont.FreeTypeFont],
) -> None:
    entries = [
        ("मुलाचे नाव", structured_fields.personal.full_name),
        ("जन्मतारीख", structured_fields.personal.birth_date),
        ("जन्म वेळ", structured_fields.personal.birth_time),
        ("जन्म वार", structured_fields.personal.birth_day),
        ("जन्म ठिकाण", structured_fields.personal.birth_place),
        ("उंची", structured_fields.personal.height),
        ("रास", structured_fields.horoscope.rashi),
        ("नाडी", structured_fields.horoscope.nadi),
        ("रक्तगट", structured_fields.horoscope.blood_group),
        ("शिक्षण", structured_fields.personal.education),
        ("नोकरी", structured_fields.personal.occupation),
        ("उत्पन्न", structured_fields.personal.income),
        ("जात", _join_non_empty(structured_fields.personal.caste, structured_fields.personal.sub_caste)),
        ("अपेक्षा", structured_fields.preferences.expectation),
        ("ऑफिस संपर्क", structured_fields.contacts.office_contact),
        ("पालक संपर्क", structured_fields.contacts.parent_contact),
    ]

    x = 62
    y = 164
    label_fill = (15, 15, 15)
    value_fill = (15, 15, 15)

    for label, value in entries:
        y = _draw_entry(draw, label, value, x, y, 500, label_fill, value_fill, accent, fonts)


def _draw_entry(
    draw: ImageDraw.ImageDraw,
    label: str,
    value: str,
    x: int,
    y: int,
    max_width: int,
    label_fill: tuple[int, int, int],
    value_fill: tuple[int, int, int],
    accent: tuple[int, int, int],
    fonts: dict[str, ImageFont.FreeTypeFont],
) -> int:
    label_text = f"{label} : "
    label_box = draw.textbbox((0, 0), label_text, font=fonts["label"])
    label_width = label_box[2] - label_box[0]
    wrapped = _wrap_text(draw, value.strip(), fonts["body"], max_width - label_width)

    if label == "मुलाचे नाव":
        label_fill = accent

    draw.text((x, y), label_text, fill=label_fill, font=fonts["label"])

    for index, line in enumerate(wrapped):
        draw.text((x + label_width, y + (index * 48)), line, fill=value_fill, font=fonts["body"])

    return y + max(58, len(wrapped) * 48)


def _draw_footer(
    draw: ImageDraw.ImageDraw,
    template_settings: TemplateSettings,
    fonts: dict[str, ImageFont.FreeTypeFont],
) -> None:
    footer = template_settings.footer_text.strip() or template_settings.center_name.strip()
    if not footer:
        return

    bbox = draw.textbbox((0, 0), footer, font=fonts["footer"])
    x = (CANVAS_SIZE[0] - (bbox[2] - bbox[0])) // 2
    draw.text((x, 1016), footer, fill=(210, 200, 194), font=fonts["footer"])


def _wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    if not text:
        return [""]

    words = text.split()
    if not words:
        return [text]

    lines: list[str] = []
    current = words[0]

    for word in words[1:]:
        tentative = f"{current} {word}"
        box = draw.textbbox((0, 0), tentative, font=font)
        if box[2] - box[0] <= max_width:
            current = tentative
        else:
            lines.append(current)
            current = word

    lines.append(current)
    return lines[:3]


def _fit_cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_width, target_height = size
    image_ratio = image.width / image.height
    target_ratio = target_width / target_height

    if image_ratio > target_ratio:
        new_height = target_height
        new_width = int(new_height * image_ratio)
    else:
        new_width = target_width
        new_height = int(new_width / image_ratio)

    resized = image.resize((new_width, new_height))
    left = max((new_width - target_width) // 2, 0)
    top = max((new_height - target_height) // 2, 0)
    return resized.crop((left, top, left + target_width, top + target_height))


def _parse_color(color_value: str) -> tuple[int, int, int]:
    try:
        return ImageColor.getrgb(color_value)
    except ValueError:
        return ImageColor.getrgb("#9a2d15")


def _mix(base: tuple[int, int, int], target: tuple[int, int, int], ratio: float) -> tuple[int, int, int]:
    return tuple(int(base[index] * (1 - ratio) + target[index] * ratio) for index in range(3))


def _join_non_empty(*values: str) -> str:
    return " ".join(value.strip() for value in values if value and value.strip())


@lru_cache
def _load_fonts() -> dict[str, ImageFont.FreeTypeFont]:
    settings = get_settings()
    regular_path = Path(settings.font_regular_path)
    bold_path = Path(settings.font_bold_path)

    return {
        "title": ImageFont.truetype(str(bold_path), 58),
        "id": ImageFont.truetype(str(bold_path), 44),
        "label": ImageFont.truetype(str(bold_path), 28),
        "body": ImageFont.truetype(str(bold_path), 28),
        "watermark": ImageFont.truetype(str(regular_path), 52),
        "footer": ImageFont.truetype(str(regular_path), 40),
    }
