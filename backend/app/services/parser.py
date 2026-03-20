from __future__ import annotations

import re
from copy import deepcopy
from typing import Iterable


STRUCTURED_DEFAULTS = {
    "personal": {
        "full_name": "",
        "birth_date": "",
        "birth_time": "",
        "birth_place": "",
        "birth_day": "",
        "height": "",
        "education": "",
        "occupation": "",
        "income": "",
        "caste": "",
        "sub_caste": "",
        "complexion": "",
    },
    "horoscope": {
        "kuldevat": "",
        "rashi": "",
        "nakshatra": "",
        "nadi": "",
        "gan": "",
        "devak": "",
        "blood_group": "",
        "varna": "",
        "gotra": "",
    },
    "family": {
        "father": "",
        "mother": "",
        "address": "",
        "native_place": "",
        "siblings": "",
        "relatives": "",
    },
    "contacts": {
        "self_contact": "",
        "parent_contact": "",
        "office_contact": "",
    },
    "preferences": {
        "expectation": "",
        "notes": "",
    },
}

FIELD_ALIASES = {
    "personal.full_name": ["मुलाचे नाव", "मुलीचे नाव", "वराचे नाव", "वधूचे नाव", "पूर्ण नाव", "नाव"],
    "personal.birth_date": ["जन्मतारीख", "जन्म तारीख", "जन्म दिनांक",
                            "जनमतारीख", "जनमताराख", "जनमतारख"],
    "personal.birth_time": ["जन्मवेळ", "जन्म वेळ", "जन्म वेळा", "वेळ",
                            "जनमवेळ", "जनम वेळ"],
    "personal.birth_place": ["जन्मठिकाण", "जन्म ठिकाण", "जन्मस्थान", "जन्म स्थान",
                             "जनमठिकाण", "जनम ठिकाण"],
    "personal.birth_day": ["जन्म वार", "वार", "जन्म दिवस"],
    "personal.height": ["उंची", "हाइट"],
    "personal.education": ["शिक्षण", "शिक्षन", "शिक्शन", "शैक्षणिक पात्रता", "शिक्शण"],
    "personal.occupation": ["व्यवसाय", "नोकरी", "काम", "ऑक्युपेशन"],
    "personal.income": ["उत्पन्न", "उतपन", "वार्षिक उत्पन्न", "पगार"],
    "personal.caste": ["जात", "धर्म", "जाती"],
    "personal.sub_caste": ["पोटजात", "उपजात"],
    "personal.complexion": ["रंग", "त्वचा रंग"],
    "horoscope.kuldevat": ["कुलदेवत", "कुळदेवत", "कुलदेवता", "कुळदेवता"],
    "horoscope.rashi": ["रास", "राशी", "रासी", "राश"],
    "horoscope.nakshatra": ["नक्षत्र", "नक्शत्र"],
    "horoscope.nadi": ["नाडी", "नाडि"],
    "horoscope.gan": ["गण"],
    "horoscope.devak": ["देवक"],
    "horoscope.blood_group": ["रक्तगट", "रक्त गट", "ब्लड ग्रुप", "ब्लडग्रुप"],
    "horoscope.varna": ["वर्ण"],
    "horoscope.gotra": ["गोत्र"],
    "family.father": ["वडील", "वडिल", "पिताजी", "फादर", "वडिलांचे नाव", "वडीलांचे नाव"],
    "family.mother": ["आई", "माता", "मदर", "आईचे नाव"],
    "family.address": ["पत्ता", "सध्याचा पत्ता", "संपूर्ण पत्ता", "राहण्याचा पत्ता"],
    "family.native_place": ["गाव", "मूळ गाव", "गाव पत्ता", "मुळ गाव", "गावपत्ता", "मूळगाव"],
    "family.siblings": ["भावंडे", "भाऊ", "बहीण", "भाऊ बहिणी"],
    "family.relatives": ["नातेवाईक", "नाते संबंध", "नातेसंबंध"],
    "contacts.self_contact": ["मोबाईल", "मोबाईल नं", "स्वतःचा संपर्क", "स्वतःचा मोबाईल", "संपर्क", "फोन",
                              "मोबाइल", "मो.नं", "मो. नं"],
    "contacts.parent_contact": ["पालक संपर्क", "पालक मोबाईल", "वडिलांचा मोबाईल", "आईचा मोबाईल"],
    "contacts.office_contact": ["ऑफिस संपर्क", "ऑफीस संपर्क", "ऑफिस नंबर", "ऑफीस नंबर", "कार्यालय संपर्क"],
    "preferences.expectation": ["अपेक्षा", "जोडीदार अपेक्षा", "वधू अपेक्षा", "वर अपेक्षा"],
    "preferences.notes": ["इतर माहिती", "विशेष नोंद", "नोंद", "टीप"],
}

SECTION_HEADINGS = {
    "वैयक्तिक माहिती",
    "कौटुंबिक माहिती",
    "पत्रिका माहिती",
    "व्यक्तिगत माहिती",
    "बायोडाटा",
}

REQUIRED_FIELDS = [
    "personal.full_name",
    "personal.birth_date",
    "personal.education",
    "personal.occupation",
    "contacts.parent_contact",
    "family.address",
]

DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")


def blank_structured_fields() -> dict:
    return deepcopy(STRUCTURED_DEFAULTS)


def normalize_text(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").translate(DEVANAGARI_DIGITS)
    normalized = normalized.replace("ः", ":")
    normalized = normalized.replace("–", "-").replace("—", "-")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def parse_structured_fields(
    raw_text: str,
    segments: Iterable[dict[str, float | str]] | None = None,
) -> tuple[dict, list[str], list[str]]:
    normalized = normalize_text(raw_text)
    lines_with_confidence = _prepare_lines(normalized, segments)
    fields = blank_structured_fields()
    low_confidence_fields: set[str] = set()
    current_field: str | None = None
    continuation_count = 0
    max_continuations = 2

    for line, confidence in lines_with_confidence:
        if not line:
            continue

        # Check if line is a section heading (exact match or contained)
        if line in SECTION_HEADINGS or any(heading in line for heading in SECTION_HEADINGS):
            current_field = None
            continuation_count = 0
            continue

        pairs = _extract_inline_pairs(line)
        leading_pair = _extract_leading_pair(line)

        if not pairs and leading_pair:
            pairs = [leading_pair]

        if pairs:
            for label, value in pairs:
                field_path = _resolve_field(label)
                if not field_path:
                    continue
                _store_value(fields, field_path, value)
                if confidence < 0.74:
                    low_confidence_fields.add(field_path)
                current_field = field_path
                continuation_count = 0
            continue

        bare_field = _resolve_label_only(line)
        if bare_field:
            current_field = bare_field
            continuation_count = 0
            if confidence < 0.74:
                low_confidence_fields.add(bare_field)
            continue

        if current_field and not _looks_like_new_label(line) and continuation_count < max_continuations:
            _append_value(fields, current_field, line)
            continuation_count += 1
            if confidence < 0.74:
                low_confidence_fields.add(current_field)
        else:
            current_field = None
            continuation_count = 0

    _post_process_contacts(fields, normalized)
    _post_process_multiline_text(fields)

    missing_fields = [
        field_path
        for field_path in REQUIRED_FIELDS
        if not _read_value(fields, field_path)
    ]

    return fields, missing_fields, sorted(low_confidence_fields)


def extract_template_settings(raw_text: str) -> dict[str, str | bool]:
    normalized = normalize_text(raw_text)
    lines = [line.strip() for line in normalized.splitlines() if line.strip()]
    center_name = ""
    id_label = "आयडी क्रमांक"
    id_value = ""

    for line in lines[:6]:
        if _extract_inline_pairs(line):
            continue
        if any(keyword in line for keyword in ("सूचक केंद्र", "वधू वर", "केंद्र")):
            center_name = line
            break

    id_match = re.search(r"(आयडी\s*(?:क्रमांक|क्र\.?|नं\.?)?)\s*[:\-]*\s*([A-Za-z0-9/.-]+)", normalized)
    if id_match:
        id_label = id_match.group(1).strip() or id_label
        id_value = id_match.group(2).strip()

    resolved_center = center_name or "भैरवनाथ वधू वर सूचक केंद्र"

    return {
        "center_name": resolved_center,
        "id_label": id_label,
        "id_value": id_value,
        "watermark_text": resolved_center,
        "footer_text": resolved_center,
        "accent_color": "#9a2d15",
        "show_watermark": True,
    }


def _prepare_lines(
    normalized_text: str,
    segments: Iterable[dict[str, float | str]] | None,
) -> list[tuple[str, float]]:
    if segments:
        prepared: list[tuple[str, float]] = []
        for segment in segments:
            text = normalize_text(str(segment.get("text", "")))
            if not text:
                continue
            confidence = float(segment.get("confidence", 1.0))
            for line in text.splitlines():
                stripped = line.strip()
                if stripped:
                    prepared.append((stripped, confidence))
        return prepared

    return [(line.strip(), 1.0) for line in normalized_text.splitlines() if line.strip()]


def _extract_inline_pairs(line: str) -> list[tuple[str, str]]:
    matches = list(LABEL_REGEX.finditer(line))
    pairs: list[tuple[str, str]] = []

    for index, match in enumerate(matches):
        label = re.sub(r"[:：\-ः ]+$", "", match.group(0)).strip()
        value_start = match.end()
        value_end = matches[index + 1].start() if index + 1 < len(matches) else len(line)
        value = line[value_start:value_end].strip(" :-ः")
        if value:
            pairs.append((label, value))

    return pairs


def _resolve_field(label: str) -> str | None:
    return ALIAS_TO_FIELD.get(_normalize_label(label))


def _resolve_label_only(line: str) -> str | None:
    stripped = line.strip().strip(":：- ")
    return _resolve_field(stripped)


def _normalize_label(label: str) -> str:
    lowered = label.lower().strip()
    lowered = lowered.replace("(", " ").replace(")", " ")
    lowered = re.sub(r"[^a-zA-Z0-9ऀ-ॿ]+", "", lowered)
    return lowered


def _looks_like_new_label(line: str) -> bool:
    if _resolve_label_only(line):
        return True

    if _extract_inline_pairs(line):
        return True

    return _extract_leading_pair(line) is not None


def _extract_leading_pair(line: str) -> tuple[str, str] | None:
    stripped = line.strip()

    for alias in SORTED_ALIASES:
        pattern = rf"^{re.escape(alias)}(?:\s*[:：\-ः]\s*|\s+)(.+)$"
        match = re.match(pattern, stripped)
        if not match:
            continue

        value = match.group(1).strip()
        field_path = _resolve_field(alias)
        if field_path and value:
            return alias, value

    return None


def _store_value(fields: dict, field_path: str, value: str) -> None:
    section, key = field_path.split(".")
    cleaned = value.strip(" -")

    if not fields[section][key]:
        fields[section][key] = cleaned
        return

    if cleaned not in fields[section][key]:
        fields[section][key] = f"{fields[section][key]} {cleaned}".strip()


def _append_value(fields: dict, field_path: str, value: str) -> None:
    section, key = field_path.split(".")
    existing = fields[section][key]
    if not existing:
        fields[section][key] = value
        return

    fields[section][key] = f"{existing} {value}".strip()


def _read_value(fields: dict, field_path: str) -> str:
    section, key = field_path.split(".")
    return str(fields[section][key]).strip()


def _post_process_contacts(fields: dict, normalized_text: str) -> None:
    numbers = re.findall(r"(?:\+?91[- ]?)?[6-9]\d{9}", normalized_text)
    cleaned_numbers = [_clean_phone_number(number) for number in numbers]

    if cleaned_numbers and not fields["contacts"]["self_contact"]:
        fields["contacts"]["self_contact"] = cleaned_numbers[0]

    if len(cleaned_numbers) > 1 and not fields["contacts"]["parent_contact"]:
        fields["contacts"]["parent_contact"] = " / ".join(cleaned_numbers[1:3])


def _clean_phone_number(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) > 10:
        digits = digits[-10:]
    return digits


def _post_process_multiline_text(fields: dict) -> None:
    for section in fields.values():
        for key, value in section.items():
            section[key] = re.sub(r"\s{2,}", " ", value).strip(" /,-")


ALIAS_TO_FIELD = {
    _normalize_label(alias): field_path
    for field_path, aliases in FIELD_ALIASES.items()
    for alias in aliases
}

LABEL_PATTERN = "|".join(
    re.escape(alias)
    for alias in sorted(
        {alias for aliases in FIELD_ALIASES.values() for alias in aliases},
        key=len,
        reverse=True,
    )
)

LABEL_REGEX = re.compile(rf"(?P<label>{LABEL_PATTERN})\s*[:：\-ः]")

SORTED_ALIASES = sorted(
    {alias for aliases in FIELD_ALIASES.values() for alias in aliases},
    key=len,
    reverse=True,
)
