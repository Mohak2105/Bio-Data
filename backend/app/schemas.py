from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PersonalFields(CamelModel):
    full_name: str = ""
    birth_date: str = ""
    birth_time: str = ""
    birth_place: str = ""
    birth_day: str = ""
    height: str = ""
    education: str = ""
    occupation: str = ""
    income: str = ""
    caste: str = ""
    sub_caste: str = ""
    complexion: str = ""


class HoroscopeFields(CamelModel):
    kuldevat: str = ""
    rashi: str = ""
    nakshatra: str = ""
    nadi: str = ""
    gan: str = ""
    devak: str = ""
    blood_group: str = ""
    varna: str = ""
    gotra: str = ""


class FamilyFields(CamelModel):
    father: str = ""
    mother: str = ""
    address: str = ""
    native_place: str = ""
    siblings: str = ""
    relatives: str = ""


class ContactFields(CamelModel):
    self_contact: str = ""
    parent_contact: str = ""
    office_contact: str = ""


class PreferenceFields(CamelModel):
    expectation: str = ""
    notes: str = ""


class StructuredFields(CamelModel):
    personal: PersonalFields = Field(default_factory=PersonalFields)
    horoscope: HoroscopeFields = Field(default_factory=HoroscopeFields)
    family: FamilyFields = Field(default_factory=FamilyFields)
    contacts: ContactFields = Field(default_factory=ContactFields)
    preferences: PreferenceFields = Field(default_factory=PreferenceFields)


class TemplateSettings(CamelModel):
    center_name: str = "भैरवनाथ वधू वर सूचक केंद्र"
    id_label: str = "आयडी क्रमांक"
    id_value: str = ""
    watermark_text: str = "भैरवनाथ वधू वर सूचक केंद्र"
    footer_text: str = "भैरवनाथ वधू वर सूचक केंद्र"
    accent_color: str = "#9a2d15"
    show_watermark: bool = True


class PreviewMetadata(CamelModel):
    engine_used: str
    page_count: int
    warnings: list[str] = Field(default_factory=list)
    extracted_from_pdf_text: bool = False


class OcrPreviewResponse(CamelModel):
    raw_ocr_text: str
    structured_fields: StructuredFields
    template_settings: TemplateSettings = Field(default_factory=TemplateSettings)
    missing_fields: list[str]
    low_confidence_fields: list[str]
    metadata: PreviewMetadata
    photo_data_url: str | None = None


class ReparseRequest(CamelModel):
    raw_ocr_text: str = Field(min_length=0)


class ReparseResponse(CamelModel):
    structured_fields: StructuredFields
    missing_fields: list[str]
    low_confidence_fields: list[str]


class RenderRequest(CamelModel):
    structured_fields: StructuredFields
    template_settings: TemplateSettings = Field(default_factory=TemplateSettings)
    photo_data_url: str | None = None
    template_id: str = "basic-marathi-v1"
