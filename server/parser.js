// Marathi biodata text parser — ported from Python parser.py

const STRUCTURED_DEFAULTS = {
  personal: {
    full_name: "",
    birth_date: "",
    birth_time: "",
    birth_place: "",
    birth_day: "",
    height: "",
    education: "",
    occupation: "",
    income: "",
    caste: "",
    sub_caste: "",
    complexion: "",
  },
  horoscope: {
    kuldevat: "",
    rashi: "",
    nakshatra: "",
    nadi: "",
    gan: "",
    devak: "",
    blood_group: "",
    varna: "",
    gotra: "",
  },
  family: {
    father: "",
    mother: "",
    address: "",
    native_place: "",
    siblings: "",
    relatives: "",
  },
  contacts: {
    self_contact: "",
    parent_contact: "",
    office_contact: "",
  },
  preferences: {
    expectation: "",
    notes: "",
  },
};

const FIELD_ALIASES = {
  "personal.full_name": ["मुलाचे नाव", "मुलीचे नाव", "वराचे नाव", "वधूचे नाव", "पूर्ण नाव"],
  "personal.birth_date": ["जन्मतारीख", "जन्म तारीख", "जन्म दिनांक", "जनमतारीख", "जनमताराख", "जनमतारख"],
  "personal.birth_time": ["जन्मवेळ", "जन्म वेळ", "जन्म वेळा", "वेळ", "जनमवेळ", "जनम वेळ", "जन्म देळ", "जनम देळ"],
  "personal.birth_place": ["जन्मठिकाण", "जन्म ठिकाण", "जन्मस्थान", "जन्म स्थान", "जनमठिकाण", "जनम ठिकाण", "जन्मस्थळ", "जन्म स्थळ"],
  "personal.birth_day": ["जन्म वार", "वार", "जन्म दिवस", "जन्मवार"],
  "personal.height": ["उंची", "हाइट"],
  "personal.education": ["शिक्षण", "शिक्षन", "शिक्शन", "शैक्षणिक पात्रता", "शिक्शण"],
  "personal.occupation": ["व्यवसाय", "नोकरी", "काम", "ऑक्युपेशन", "नोकरी /व्यवसाय", "नोकरी/व्यवसाय", "नोकरी / व्यवसाय"],
  "personal.income": ["उत्पन्न", "उतपन", "वार्षिक उत्पन्न", "पगार"],
  "personal.caste": ["जात", "धर्म", "जाती"],
  "personal.sub_caste": ["पोटजात", "उपजात"],
  "personal.complexion": ["रंग", "त्वचा रंग", "वर्ण"],
  "horoscope.kuldevat": ["कुलदेवत", "कुळदेवत", "कुलदेवता", "कुळदेवता", "कुलदैवत"],
  "horoscope.rashi": ["रास", "राशी", "रासी", "राश"],
  "horoscope.nakshatra": ["नक्षत्र", "नक्शत्र", "जन्म नक्षत्र"],
  "horoscope.nadi": ["नाडी", "नाडि", "नाड", "नाडे"],
  "horoscope.gan": ["गण"],
  "horoscope.devak": ["देवक"],
  "horoscope.blood_group": ["रक्तगट", "रक्त गट", "ब्लड ग्रुप", "ब्लडग्रुप"],
  "horoscope.varna": [],
  "horoscope.gotra": ["गोत्र", "नावरस नाव", "नावरस"],
  "family.father": ["वडील", "वडिल", "पिताजी", "फादर", "वडिलांचे नाव", "वडीलांचे नाव"],
  "family.mother": ["आई", "माता", "मदर", "आईचे नाव"],
  "family.address": ["पत्ता", "सध्याचा पत्ता", "सद्याचा पत्ता", "सध्याचापत्ता", "संपूर्ण पत्ता", "राहण्याचा पत्ता", "निवास पत्ता"],
  "family.native_place": ["गाव", "मूळ गाव", "गाव पत्ता", "मुळ गाव", "गावपत्ता", "मूळगाव", "गावचापत्ता", "गावचा पत्ता"],
  "family.siblings": ["भावंडे", "भाऊ", "बहीण", "भाऊ बहिणी", "एकूण भाऊ"],
  "family.relatives": ["नातेवाईक", "नाते संबंध", "नातेसंबंध", "मामाचे नाव", "मामा", "चुलते", "आजोबांचे नाव", "काकांचे नाव"],
  "contacts.self_contact": ["मोबाईल", "मोबाईल नं", "स्वतःचा संपर्क", "स्वतःचा मोबाईल", "संपर्क", "फोन", "मोबाइल", "मो.नं", "मो. नं"],
  "contacts.parent_contact": ["पालक संपर्क", "पालक मोबाईल", "वडिलांचा मोबाईल", "आईचा मोबाईल"],
  "contacts.office_contact": ["ऑफिस संपर्क", "ऑफीस संपर्क", "ऑफिस नंबर", "ऑफीस नंबर", "कार्यालय संपर्क"],
  "preferences.expectation": ["अपेक्षा", "जोडीदार अपेक्षा", "वधू अपेक्षा", "वर अपेक्षा"],
  "preferences.notes": ["इतर माहिती", "विशेष नोंद", "नोंद", "टीप"],
};

const SECTION_HEADINGS = new Set([
  "वैयक्तिक माहिती",
  "कौटुंबिक माहिती",
  "पत्रिका माहिती",
  "व्यक्तिगत माहिती",
  "बायोडाटा",
  "वैयक्तिक तपशील",
  "कौटुंबिक तपशील",
  "पत्रिका तपशील",
  "संपर्क माहिती",
  "शिक्षण व नोकरी",
]);

const REQUIRED_FIELDS = [
  "personal.full_name",
  "personal.birth_date",
  "personal.education",
  "personal.occupation",
  "contacts.parent_contact",
  "family.address",
];

// Devanagari digit translation map
const DEVANAGARI_DIGIT_MAP = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

// Build reverse lookup: normalized alias → field path
const ALIAS_TO_FIELD = new Map();
for (const [fieldPath, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_FIELD.set(normalizeLabel(alias), fieldPath);
  }
}

// Build suffix lookup for fuzzy matching truncated OCR labels.
// OCR often drops the first 1-3 characters of Devanagari labels.
// e.g., "लाचे नाव" (truncated) should match "मुलाचे नाव" via suffix "लाचे नाव".
// Only create suffixes for aliases with 4+ characters (to avoid false positives).
const SUFFIX_TO_FIELD = new Map();
for (const [fieldPath, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const alias of aliases) {
    const norm = normalizeLabel(alias);
    // Generate suffixes by removing 1, 2, 3 chars from start
    for (let drop = 1; drop <= 3 && drop < norm.length - 2; drop++) {
      const suffix = norm.slice(drop);
      if (suffix.length >= 3 && !ALIAS_TO_FIELD.has(suffix) && !SUFFIX_TO_FIELD.has(suffix)) {
        SUFFIX_TO_FIELD.set(suffix, fieldPath);
      }
    }
  }
}

// All aliases sorted by length (longest first) for greedy matching
const ALL_ALIASES = [];
for (const aliases of Object.values(FIELD_ALIASES)) {
  for (const alias of aliases) {
    ALL_ALIASES.push(alias);
  }
}
const SORTED_ALIASES = ALL_ALIASES.sort((a, b) => b.length - a.length);

// Build label regex: matches any known alias followed by separator
const LABEL_PATTERN = SORTED_ALIASES.map(escapeRegex).join("|");
const LABEL_REGEX = new RegExp(`(?<label>${LABEL_PATTERN})\\s*[:：\\-ः]`, "g");

// --- Helpers ---

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function blankStructuredFields() {
  return deepClone(STRUCTURED_DEFAULTS);
}

function translateDevanagariDigits(text) {
  return text.replace(/[०-९]/g, (ch) => DEVANAGARI_DIGIT_MAP[ch] || ch);
}

function normalizeText(text) {
  let normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  normalized = translateDevanagariDigits(normalized);
  normalized = normalized.replace(/ः/g, ":");
  normalized = normalized.replace(/–/g, "-").replace(/—/g, "-");
  // Remove zero-width characters (ZWJ, ZWNJ, etc.) that break alias matching
  normalized = normalized.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, "");
  normalized = normalized.replace(/[ \t]+/g, " ");
  normalized = normalized.replace(/\n{3,}/g, "\n\n");
  return normalized.trim();
}

/**
 * Clean a single OCR line — remove trailing ASCII garbage from decorative elements.
 * Biodata images have decorative borders/watermarks that OCR picks up as random ASCII.
 */
function cleanOcrLine(line) {
  // Remove table border characters (=, |, -, —, _) that OCR reads from table structures
  let cleaned = line.replace(/^[\s=|—\-_]+|[\s=|—\-_]+$/g, "").trim();
  // Remove leading single chars like "A ", "B= ", "| " from table borders
  cleaned = cleaned.replace(/^[A-Z=|]\s+/g, "").trim();
  // Remove sequences of underscores (table cell borders)
  cleaned = cleaned.replace(/_{2,}/g, " ").trim();
  // Remove leading "।" (table border misread as danda)
  cleaned = cleaned.replace(/^[।॥]+\s*/g, "").trim();

  // Remove trailing ASCII-only sequences (2+ chars of Latin letters/symbols with no Devanagari)
  // e.g., "चि. सुहास संजय देशमुख pr" → "चि. सुहास संजय देशमुख"
  cleaned = cleaned.replace(/\s+[a-zA-Z\s|\\/<>=\[\]{}\$#@!~^*&%`]+$/g, "").trim();

  // Remove trailing isolated symbols
  cleaned = cleaned.replace(/\s*[|\\/<>=\[\]{}\$#@!~^*&%`।॥]+\s*$/g, "").trim();

  // Remove trailing single ASCII chars (common OCR noise)
  cleaned = cleaned.replace(/\s+[a-zA-Z]\s*$/g, "").trim();

  // Remove inline table separators: " = " patterns
  cleaned = cleaned.replace(/\s*=\s*/g, " ").trim();

  return cleaned;
}

function normalizeLabel(label) {
  let lowered = label.toLowerCase().trim();
  lowered = lowered.replace(/\(/g, " ").replace(/\)/g, " ");
  lowered = lowered.replace(/[^a-zA-Z0-9\u0900-\u097F]/g, "");
  return lowered;
}

function resolveField(label) {
  const norm = normalizeLabel(label);
  // Exact match first
  const exact = ALIAS_TO_FIELD.get(norm);
  if (exact) return exact;
  // Suffix match for truncated OCR labels (e.g., "लाचे नाव" → "मुलाचे नाव")
  return SUFFIX_TO_FIELD.get(norm) || null;
}

function resolveLabelOnly(line) {
  const stripped = line.trim().replace(/^[:：\- ]+|[:：\- ]+$/g, "");
  return resolveField(stripped);
}

function looksLikeNewLabel(line) {
  if (resolveLabelOnly(line)) return true;
  if (extractInlinePairs(line).length > 0) return true;
  return extractLeadingPair(line) !== null;
}

function extractInlinePairs(line) {
  LABEL_REGEX.lastIndex = 0; // reset global regex
  const matches = [];
  let m;
  while ((m = LABEL_REGEX.exec(line)) !== null) {
    matches.push({ index: m.index, end: m.index + m[0].length, fullMatch: m[0] });
  }

  const pairs = [];
  for (let i = 0; i < matches.length; i++) {
    const label = matches[i].fullMatch.replace(/[:：\-ः ]+$/g, "").trim();
    const valueStart = matches[i].end;
    const valueEnd = i + 1 < matches.length ? matches[i + 1].index : line.length;
    const value = line.slice(valueStart, valueEnd).trim().replace(/^[ :\-ः]+|[ :\-ः]+$/g, "");
    if (value) {
      pairs.push([label, value]);
    }
  }

  return pairs;
}

function extractLeadingPair(line) {
  const stripped = line.trim();

  // First try exact alias matching
  for (const alias of SORTED_ALIASES) {
    const pattern = new RegExp(`^${escapeRegex(alias)}(?:\\s*[:：\\-ः]\\s*|\\s+)(.+)$`);
    const match = stripped.match(pattern);
    if (!match) continue;

    const value = match[1].trim();
    const fieldPath = resolveField(alias);
    if (fieldPath && value) {
      return [alias, value];
    }
  }

  // Fallback: generic "label: value" pattern, resolve label via fuzzy/suffix match.
  // Handles OCR-truncated labels like "लाचे नाव:" (from "मुलाचे नाव:").
  const genericMatch = stripped.match(/^([\u0900-\u097F][\u0900-\u097F\s.\/]{1,30}?)\s*[:：\-ः]\s*(.+)$/);
  if (genericMatch) {
    const label = genericMatch[1].trim();
    const value = genericMatch[2].trim();
    const fieldPath = resolveField(label);
    if (fieldPath && value) {
      return [label, value];
    }
  }

  return null;
}

function storeValue(fields, fieldPath, value) {
  const [section, key] = fieldPath.split(".");
  // Clean OCR noise: quotes, special chars, trailing garbage
  let cleaned = value
    .replace(/^[ \-"'`:.]+|[ \-"'`]+$/g, "")
    .replace(/\s*[|\\/<>=\[\]{}\$#@!~^*&%`।॥]+\s*$/g, "")
    .trim();

  // For name fields: extract clean name, remove phone numbers and garbage
  if (key === "full_name") {
    // Remove phone numbers
    cleaned = cleaned.replace(/\(?\s*(?:मो\.?\s*(?:नं\.?)?\s*)?[\d\s\-]{7,}\s*\)?/g, "").trim();
    // Remove quoted garbage: "वकसन...", "असि etc
    cleaned = cleaned.replace(/\s*[""'"'`].+$/g, "").trim();
    // Remove ... and everything after
    cleaned = cleaned.replace(/\s*\.{2,}.*$/g, "").trim();
    // Remove trailing ASCII words/noise
    cleaned = cleaned.replace(/\s+[a-zA-Z0-9\.\,\(\)]{2,}.*$/g, "").trim();
    // Remove trailing numbers, dots, colons, semicolons
    cleaned = cleaned.replace(/[\s\d.:,;!@#$%^&*]+$/g, "").trim();
    // Only keep Devanagari name part — find last Devanagari char and truncate after it
    const lastDevMatch = cleaned.match(/^(.*[\u0900-\u097F])/);
    if (lastDevMatch) cleaned = lastDevMatch[1].trim();
    // Remove trailing single non-Devanagari chars
    cleaned = cleaned.replace(/\s+[^ा-ू\u0900-\u097F\s]$/g, "").trim();
    // Normalize "चि ." → "चि."
    cleaned = cleaned.replace(/चि\s*\.\s*/g, "चि. ").trim();
    cleaned = cleaned.replace(/कु\s*\.\s*/g, "कु. ").trim();
    // Remove trailing dots
    cleaned = cleaned.replace(/\s*\.+\s*$/g, "").trim();
  }

  // For date fields: extract just the date pattern
  if (key === "birth_date") {
    // Try DD-MM-YYYY or DD/MM/YYYY first
    let dateMatch = cleaned.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/);
    if (!dateMatch) {
      // Try DDMMYYYY (8 digits without separators)
      dateMatch = cleaned.match(/(\d{8})/);
      if (dateMatch) {
        const d = dateMatch[1];
        cleaned = `${d.slice(0,2)}-${d.slice(2,4)}-${d.slice(4)}`;
      }
    } else {
      cleaned = dateMatch[0];
    }
  }

  // For time fields: extract just the time
  if (key === "birth_time") {
    const timeMatch = cleaned.match(/\d{1,2}[:\.]?\d{0,2}\s*(?:AM|PM|am|pm|सकाळी|दुपारी|सायंकाळी|रात्री)?(?:\s+\d{1,2}\s*(?:बाजून|वाजून)\s*\d{1,2}\s*मिनिटे?)?/);
    if (timeMatch) cleaned = timeMatch[0];
  }

  // For height fields: normalize OCR output to readable format
  if (key === "height") {
    // First strip all OCR noise
    cleaned = cleaned.replace(/[""'"'`।॥\[\]{}]/g, "").trim();

    let feet = null, inches = null;

    // "5 फूट 9 इंच" or "5फूट9इंच" (already correct format)
    let hm = cleaned.match(/([4-7])\s*फूट\s*(\d{1,2})\s*इंच/);
    if (hm) { feet = hm[1]; inches = hm[2]; }

    // "5.9", "5.6" → feet.inches
    if (!feet) { hm = cleaned.match(/([4-7])\s*\.\s*(\d{1,2})/); if (hm) { feet = hm[1]; inches = hm[2]; } }

    // "5'9", "5'.9", "5′9″", "5'.9""
    if (!feet) { hm = cleaned.match(/([4-7])\s*['′']\s*\.?\s*(\d{1,2})\s*["″"]?/); if (hm) { feet = hm[1]; inches = hm[2]; } }

    // "5 feet 9 in" or "5ft 9in" or "5 ft 6 in" or "51 6in"
    if (!feet) { hm = cleaned.match(/([4-7])\s*(?:feet|ft|foot)?\s*(\d{1,2})\s*(?:inches|inch|in)\b/i); if (hm) { feet = hm[1]; inches = hm[2]; } }

    // "5 1 6in" → might be "5' 6in" with OCR noise
    if (!feet) { hm = cleaned.match(/([4-7])\s+\d?\s*(\d{1,2})\s*(?:in|इंच)/i); if (hm) { feet = hm[1]; inches = hm[2]; } }

    // "5 feet 9" or "5 foot 9" or "5 फुट 9"
    if (!feet) { hm = cleaned.match(/([4-7])\s*(?:feet|foot|ft|फुट)\s*(\d{1,2})/i); if (hm) { feet = hm[1]; inches = hm[2]; } }

    // "516" → 5 feet, 6 inches (first=feet, last=inches, middle=noise)
    if (!feet) { hm = cleaned.match(/^([4-7])(\d)(\d)\s*$/); if (hm) { feet = hm[1]; inches = hm[3]; } }

    // "56" → 5'6"
    if (!feet) { hm = cleaned.match(/^([4-7])(\d)\s*$/); if (hm) { feet = hm[1]; inches = hm[2]; } }

    // "5 9" → 5 feet 9 inches
    if (!feet) { hm = cleaned.match(/^([4-7])\s+(\d{1,2})$/); if (hm) { feet = hm[1]; inches = hm[2]; } }

    if (feet && inches) {
      cleaned = `${feet} फूट ${inches} इंच`;
    }
  }

  // For blood group: clean quotes and standardize
  if (key === "blood_group") {
    cleaned = cleaned.replace(/[""'"'`]/g, "").trim();
    // Extract just the blood group pattern
    const bgMatch = cleaned.match(/(?:A|B|AB|O)\s*[+-]?\s*(?:positive|negative|pos|neg)?/i);
    if (bgMatch) cleaned = bgMatch[0].trim();
  }

  // For caste: normalize separator to dash, remove noise
  if (key === "caste") {
    // Remove trailing OCR garbage (mixed Devanagari+ASCII noise like "कःEa", "ति oy")
    cleaned = cleaned.replace(/\s+[a-zA-Z]{1,4}$/g, "").trim(); // trailing short ASCII
    cleaned = cleaned.replace(/\s*[.:]\s*[a-zA-Z\u0900-\u097F]{1,3}$/g, "").trim(); // ". कःEa"
    cleaned = cleaned.replace(/\s*कः\w*$/g, "").trim(); // "कःEa" specifically
    // Comma → dash
    cleaned = cleaned.replace(/\s*,\s*/g, "-");
    // Remove dots
    cleaned = cleaned.replace(/\s*\.\s*/g, "");
    // Remove कुळी with numbers
    cleaned = cleaned.replace(/\d+\s*कुळी/g, "").trim();
    // Clean dashes
    cleaned = cleaned.replace(/\s*-\s*/g, "-");
    // Remove trailing dash
    cleaned = cleaned.replace(/-+$/g, "").trim();
  }

  // Clean trailing ASCII noise from the value
  cleaned = cleanOcrLine(cleaned);

  // General OCR garbage cleanup for ALL fields
  // Remove isolated short garbage at end: "ति oy", "क off A", "कःEa"
  cleaned = cleaned.replace(/\s+[a-zA-Z]{1,5}\s*$/g, "").trim();
  // Remove trailing special chars + short text
  cleaned = cleaned.replace(/\s*[.:;,!@#$%^&*(){}\[\]]+\s*[a-zA-Z0-9]{0,3}\s*$/g, "").trim();
  // Remove trailing single Devanagari + ASCII combos (OCR noise)
  cleaned = cleaned.replace(/\s+[\u0900-\u097F]{1,2}[a-zA-Z]+\s*$/g, "").trim();

  // Final cleanup: remove trailing dots, spaces, dashes
  cleaned = cleaned.replace(/\s*[.\-:;,]+\s*$/, "").trim();

  if (!fields[section][key]) {
    fields[section][key] = cleaned;
    return;
  }

  if (!fields[section][key].includes(cleaned)) {
    fields[section][key] = `${fields[section][key]} ${cleaned}`.trim();
  }
}

function appendValue(fields, fieldPath, value) {
  const [section, key] = fieldPath.split(".");
  const existing = fields[section][key];
  if (!existing) {
    fields[section][key] = value;
    return;
  }
  fields[section][key] = `${existing} ${value}`.trim();
}

function readValue(fields, fieldPath) {
  const [section, key] = fieldPath.split(".");
  return String(fields[section][key]).trim();
}

function prepareLines(normalizedText, segments) {
  if (segments && segments.length > 0) {
    const prepared = [];
    for (const segment of segments) {
      const text = normalizeText(String(segment.text || ""));
      if (!text) continue;
      const confidence = Number(segment.confidence ?? 1.0);
      for (const line of text.split("\n")) {
        const cleaned = cleanOcrLine(line.trim());
        if (cleaned) {
          prepared.push([cleaned, confidence]);
        }
      }
    }
    return prepared;
  }

  return normalizedText.split("\n")
    .map((line) => cleanOcrLine(line.trim()))
    .filter((line) => line)
    .map((line) => [line, 1.0]);
}

function cleanPhoneNumber(phone) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
}

// Office contact number — should ONLY go in office_contact, never in self/parent
const OFFICE_NUMBER = "9975285800";

// Numbers commonly found in biodata headers (organization founders/coordinators)
// These should be excluded from self_contact and parent_contact extraction
const HEADER_NUMBERS = new Set([
  "9975285800", "9766611355", "9765652223", "8805281006",
  "9767326677", "9763022098", "9850087429",
]);

function postProcessContacts(fields, normalizedText) {
  const numberMatches = normalizedText.match(/(?:\+?91[- ]?)?[6-9]\d{9}/g) || [];
  const cleanedNumbers = numberMatches.map(cleanPhoneNumber);

  // Filter out header/organization numbers — only keep actual biodata person's numbers
  const personalNumbers = cleanedNumbers.filter((n) => !HEADER_NUMBERS.has(n));

  if (personalNumbers.length > 0 && !fields.contacts.self_contact) {
    fields.contacts.self_contact = personalNumbers[0];
  }

  if (personalNumbers.length > 1 && !fields.contacts.parent_contact) {
    fields.contacts.parent_contact = personalNumbers.slice(1, 3).join(" / ");
  }
}

/**
 * Fallback: if birth_time is empty, scan raw text for time patterns.
 * OCR often misreads the label "जन्म वेळ" but the time value (01:30 AM, दुपारी ३ वाजून) is readable.
 */
function postProcessBirthTime(fields, normalizedText) {
  if (fields.personal.birth_time) return; // already extracted

  const lines = normalizedText.split("\n");
  for (const line of lines) {
    // Match "HH:MM AM/PM" pattern
    const ampm = line.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\b/);
    if (ampm) {
      fields.personal.birth_time = ampm[1].trim();
      return;
    }
    // Match "सकाळी 05.32.18 वाजता" or "दुपारी 3 वाजून 15 मिनिटे"
    const marTime = line.match(/((?:सकाळी|दुपारी|सायंकाळी|रात्री)\s+\d{1,2}[.:]\d{1,2}(?:[.:]\d{1,2})?\s*(?:वाजता|वाजून|बाजून)(?:\s*\d{1,2}\s*मिनिटे?)?)/);
    if (marTime) {
      fields.personal.birth_time = marTime[1].trim();
      return;
    }
    // Match "HH:MM" standalone (if near time-related context)
    const hhmm = line.match(/\b(\d{1,2}:\d{2})\b/);
    if (hhmm && /(?:वेळ|time|AM|PM|सकाळ|दुपार|रात्र)/i.test(line)) {
      fields.personal.birth_time = hhmm[1].trim();
      return;
    }
  }
}

/**
 * Calculate birth day (वार) from birth date if not extracted.
 */
function postProcessBirthDay(fields) {
  if (fields.personal.birth_day) return; // already extracted
  if (!fields.personal.birth_date) return; // no date to calculate from

  const dateStr = fields.personal.birth_date;
  // Try to parse DD-MM-YYYY or DD/MM/YYYY
  const dm = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (!dm) return;

  let [, day, month, year] = dm.map(Number);
  if (year < 100) year += 1900;
  if (year < 1950) year += 100; // handle 2-digit years

  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return;

  const days = ["रविवार", "सोमवार", "मंगळवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];
  fields.personal.birth_day = days[date.getDay()];
}

function postProcessMultilineText(fields) {
  for (const section of Object.values(fields)) {
    for (const key of Object.keys(section)) {
      section[key] = section[key].replace(/\s{2,}/g, " ").replace(/^[ /,\-]+|[ /,\-]+$/g, "");
    }
  }
}

// --- Main exports ---

export function parseStructuredFields(rawText, segments = null) {
  const normalized = normalizeText(rawText);
  const linesWithConfidence = prepareLines(normalized, segments);
  const fields = blankStructuredFields();
  const lowConfidenceFields = new Set();
  let currentField = null;
  let continuationCount = 0;
  const maxContinuations = 1;

  for (const [line, confidence] of linesWithConfidence) {
    if (!line) continue;

    // Skip lines that are mostly ASCII noise (less than 30% Devanagari)
    const devanagariChars = (line.match(/[\u0900-\u097F]/g) || []).length;
    const totalChars = line.replace(/\s/g, "").length;
    if (totalChars > 3 && devanagariChars === 0 && !/\d{4,}/.test(line)) {
      // Pure ASCII line with no Devanagari and no long numbers — skip as noise
      continue;
    }

    // Check if line is a section heading
    if (SECTION_HEADINGS.has(line) || [...SECTION_HEADINGS].some((h) => line.includes(h))) {
      currentField = null;
      continuationCount = 0;
      continue;
    }

    const pairs = extractInlinePairs(line);
    const leadingPair = extractLeadingPair(line);

    let effectivePairs = pairs;
    if (effectivePairs.length === 0 && leadingPair) {
      effectivePairs = [leadingPair];
    }

    if (effectivePairs.length > 0) {
      for (const [label, value] of effectivePairs) {
        const fieldPath = resolveField(label);
        if (!fieldPath) continue;
        storeValue(fields, fieldPath, value);
        if (confidence < 0.74) {
          lowConfidenceFields.add(fieldPath);
        }
        currentField = fieldPath;
        continuationCount = 0;
      }
      continue;
    }

    const bareField = resolveLabelOnly(line);
    if (bareField) {
      currentField = bareField;
      continuationCount = 0;
      if (confidence < 0.74) {
        lowConfidenceFields.add(bareField);
      }
      continue;
    }

    // Fields that should NOT have continuations (single-line values only)
    // Fields that should NOT have continuations (single-line values only)
    const noContinuationFields = new Set([
      "personal.full_name", "personal.birth_date", "personal.birth_time",
      "personal.birth_day", "personal.birth_place", "personal.height",
      "personal.caste", "personal.sub_caste", "personal.complexion",
      "personal.income", "horoscope.rashi", "horoscope.nadi",
      "horoscope.gan", "horoscope.devak", "horoscope.blood_group",
      "horoscope.varna", "horoscope.gotra", "horoscope.nakshatra",
      "horoscope.kuldevat",
    ]);

    if (currentField && !noContinuationFields.has(currentField) && !looksLikeNewLabel(line) && continuationCount < maxContinuations) {
      appendValue(fields, currentField, line);
      continuationCount++;
      if (confidence < 0.74) {
        lowConfidenceFields.add(currentField);
      }
    } else {
      currentField = null;
      continuationCount = 0;
    }
  }

  postProcessContacts(fields, normalized);
  postProcessBirthTime(fields, normalized);
  postProcessBirthDay(fields);
  postProcessMultilineText(fields);

  const missingFields = REQUIRED_FIELDS.filter((fp) => !readValue(fields, fp));

  return {
    fields,
    missingFields,
    lowConfidenceFields: [...lowConfidenceFields].sort(),
  };
}

export function extractTemplateSettings(rawText) {
  const normalized = normalizeText(rawText);
  const lines = normalized.split("\n").map((l) => l.trim()).filter((l) => l);
  let centerName = "";
  const idLabel = "आयडी क्रमांक";
  let idValue = "";

  for (const line of lines.slice(0, 6)) {
    if (extractInlinePairs(line).length > 0) continue;
    if (["सूचक केंद्र", "वधू वर", "केंद्र"].some((kw) => line.includes(kw))) {
      centerName = line;
      break;
    }
  }

  const idMatch = normalized.match(/(आयडी\s*(?:क्रमांक|क्र\.?|नं\.?)?)\s*[:\-]*\s*([A-Za-z0-9/.\-]+)/);
  let resolvedIdLabel = idLabel;
  if (idMatch) {
    resolvedIdLabel = idMatch[1].trim() || idLabel;
    idValue = idMatch[2].trim();
  }

  const resolvedCenter = centerName || "भैरवनाथ वधू वर सूचक केंद्र";

  return {
    center_name: resolvedCenter,
    id_label: resolvedIdLabel,
    id_value: idValue,
    watermark_text: resolvedCenter,
    footer_text: resolvedCenter,
    accent_color: "#9a2d15",
    show_watermark: true,
  };
}
