from __future__ import annotations

import httpx
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import Response

from app.schemas import (
    OcrPreviewResponse,
    PreviewMetadata,
    RenderRequest,
    ReparseRequest,
    ReparseResponse,
    StructuredFields,
)
from app.services.images import UnsupportedDocumentError, inspect_pdf, load_document_images, uploaded_photo_to_data_url
from app.services.ocr import OcrService
from app.services.parser import extract_template_settings, parse_structured_fields
from app.services.render import render_biodata, render_biodata_preview

router = APIRouter(prefix="/api")
ocr_service = OcrService()


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/transliterate")
async def transliterate_text(text: str = Query(...), lang: str = Query(default="mr")) -> dict:
    url = (
        f"https://inputtools.google.com/request"
        f"?text={text}&itc={lang}-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8"
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            data = resp.json()
        if data[0] == "SUCCESS" and data[1] and data[1][0][1]:
            return {"suggestions": data[1][0][1]}
        return {"suggestions": [text]}
    except Exception:
        return {"suggestions": [text]}


@router.post("/ocr/preview", response_model=OcrPreviewResponse)
async def preview_ocr(
    document: UploadFile = File(...),
    photo: UploadFile | None = File(default=None),
) -> OcrPreviewResponse:
    document_bytes = await document.read()
    photo_bytes = await photo.read() if photo else None

    if not document_bytes:
        raise HTTPException(status_code=400, detail="Uploaded document is empty.")

    try:
        extracted_pdf_text = ""
        warnings: list[str] = []
        page_count = 1

        if document.filename and document.filename.lower().endswith(".pdf"):
            extracted_pdf_text, pdf_page_count = inspect_pdf(document_bytes)
            page_count = pdf_page_count or 1

        metadata_engine = "pdf-text" if len(extracted_pdf_text.strip()) > 20 else ""
        extracted_from_pdf_text = bool(metadata_engine)

        if extracted_from_pdf_text:
            raw_text = extracted_pdf_text
            segments = [{"text": line, "confidence": 1.0} for line in raw_text.splitlines() if line.strip()]
        else:
            images = load_document_images(document.filename or "upload", document_bytes)
            page_count = len(images)
            ocr_result = ocr_service.extract_text(images)
            metadata_engine = ocr_result.engine_used
            warnings.extend(ocr_result.warnings)
            segments = [{"text": line.text, "confidence": line.confidence} for line in ocr_result.lines]
            raw_text = "\n".join(line.text for line in ocr_result.lines)

        structured_fields_dict, missing_fields, low_confidence_fields = parse_structured_fields(raw_text, segments)
        template_settings_dict = extract_template_settings(raw_text)
        photo_data_url = None

        if photo_bytes:
            photo_data_url = uploaded_photo_to_data_url(photo_bytes, photo.content_type)

        return OcrPreviewResponse(
            raw_ocr_text=raw_text,
            structured_fields=StructuredFields.model_validate(structured_fields_dict),
            template_settings=template_settings_dict,
            missing_fields=missing_fields,
            low_confidence_fields=low_confidence_fields,
            metadata=PreviewMetadata(
                engine_used=metadata_engine or "none",
                page_count=page_count,
                warnings=warnings,
                extracted_from_pdf_text=extracted_from_pdf_text,
            ),
            photo_data_url=photo_data_url,
        )
    except UnsupportedDocumentError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Preview तयार होताना error आला: {error}") from error


@router.post("/ocr/reparse", response_model=ReparseResponse)
def reparse_ocr(request: ReparseRequest) -> ReparseResponse:
    structured_fields_dict, missing_fields, low_confidence_fields = parse_structured_fields(request.raw_ocr_text)
    return ReparseResponse(
        structured_fields=StructuredFields.model_validate(structured_fields_dict),
        missing_fields=missing_fields,
        low_confidence_fields=low_confidence_fields,
    )


@router.post("/render/jpg")
def render_jpg(request: RenderRequest) -> Response:
    if request.template_id != "basic-marathi-v1":
        raise HTTPException(status_code=400, detail="Only basic-marathi-v1 is supported in this MVP.")

    try:
        jpg_bytes = render_biodata(request.structured_fields, request.template_settings, request.photo_data_url)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"JPG render failed: {error}") from error

    headers = {"Content-Disposition": 'inline; filename="marathi-biodata.jpg"'}
    return Response(content=jpg_bytes, media_type="image/jpeg", headers=headers)


@router.post("/render/preview")
def render_preview(request: RenderRequest) -> Response:
    if request.template_id != "basic-marathi-v1":
        raise HTTPException(status_code=400, detail="Only basic-marathi-v1 is supported in this MVP.")

    try:
        png_bytes = render_biodata_preview(request.structured_fields, request.template_settings, request.photo_data_url)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Preview render failed: {error}") from error

    headers = {"Content-Disposition": 'inline; filename="marathi-biodata-preview.png"'}
    return Response(content=png_bytes, media_type="image/png", headers=headers)
