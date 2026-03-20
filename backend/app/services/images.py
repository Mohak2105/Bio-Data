from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps


class UnsupportedDocumentError(RuntimeError):
    pass


def load_document_images(filename: str, payload: bytes) -> list[Image.Image]:
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        return _load_pdf_images(payload)

    if suffix not in {".jpg", ".jpeg", ".png"}:
        raise UnsupportedDocumentError("Only PDF, JPG, and PNG files are supported.")

    with Image.open(BytesIO(payload)) as image:
        return [prepare_image(image)]


def extract_pdf_text(payload: bytes) -> str:
    text, _page_count = inspect_pdf(payload)
    return text


def inspect_pdf(payload: bytes) -> tuple[str, int]:
    try:
        import fitz
    except ImportError:
        return "", 0

    try:
        document = fitz.open(stream=payload, filetype="pdf")
    except Exception:
        return "", 0

    text_parts = []
    page_count = 0

    with document:
        for page in document:
            page_count += 1
            text_parts.append(page.get_text("text"))

    return "\n".join(text_parts).strip(), page_count


def prepare_image(image: Image.Image) -> Image.Image:
    prepared = ImageOps.exif_transpose(image).convert("RGB")
    prepared = ImageOps.autocontrast(prepared)

    min_width = 1800
    if prepared.width < min_width:
        ratio = min_width / prepared.width
        prepared = prepared.resize((int(prepared.width * ratio), int(prepared.height * ratio)))

    return prepared


def image_to_data_url(image: Image.Image, format_name: str = "JPEG") -> str:
    buffer = BytesIO()
    mime_type = "image/jpeg" if format_name.upper() == "JPEG" else "image/png"
    image.save(buffer, format=format_name, quality=94)
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def uploaded_photo_to_data_url(payload: bytes, content_type: str | None) -> str:
    with Image.open(BytesIO(payload)) as image:
        prepared = ImageOps.exif_transpose(image).convert("RGB")
        format_name = "PNG" if content_type == "image/png" else "JPEG"
        return image_to_data_url(prepared, format_name)


def decode_data_url(data_url: str) -> Image.Image:
    _header, encoded = data_url.split(",", 1)
    payload = base64.b64decode(encoded)
    with Image.open(BytesIO(payload)) as image:
        return ImageOps.exif_transpose(image).convert("RGB")


def _load_pdf_images(payload: bytes) -> list[Image.Image]:
    try:
        import fitz
    except ImportError as error:
        raise UnsupportedDocumentError("PyMuPDF is required for PDF uploads.") from error

    document = fitz.open(stream=payload, filetype="pdf")
    images: list[Image.Image] = []

    with document:
        for page in document:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2.2, 2.2), alpha=False)
            image = Image.frombytes("RGB", [pixmap.width, pixmap.height], pixmap.samples)
            images.append(prepare_image(image))

    return images
