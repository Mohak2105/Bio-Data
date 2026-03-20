# Migration Plan: Python Backend → Node.js

## Why
Hostinger shared hosting supports Node.js only — no Python. The entire Python/FastAPI backend must be replaced with Node.js/Express.

## Key Insight — Minimal Work Needed
The frontend already handles JPG export client-side (html-to-image). The render.py endpoints (`/api/render/jpg`, `/api/render/preview`) are NOT used by the frontend. This means we only need to port 3 things:

1. **OCR.space API call** (simple HTTP POST)
2. **Parser logic** (pure text/regex — ~370 lines)
3. **Transliteration proxy** (simple HTTP GET)

No image rendering, no Canvas, no Sharp needed!

## New Project Structure

```
Bio-Data/
├── frontend/          (unchanged — React/Vite)
│   └── src/
├── server/            (NEW — replaces backend/)
│   ├── package.json
│   ├── index.js       (Express app + all routes)
│   ├── parser.js      (ported from parser.py)
│   ├── .env           (OCR_SPACE_API_KEY)
│   └── node_modules/
├── .gitignore
└── README.md
```

Keeping it flat (single index.js + parser.js) since the backend is small.

## npm Dependencies (all pure JS — no native modules)

```json
{
  "express": "^4.18",
  "cors": "^2.8",
  "multer": "^1.4",
  "dotenv": "^16.4",
  "pdf-parse": "^1.1"
}
```

- `express` — web framework (replaces FastAPI)
- `cors` — CORS middleware
- `multer` — file upload handling (replaces python-multipart)
- `dotenv` — environment variables
- `pdf-parse` — PDF text extraction (replaces PyMuPDF, pure JS)
- Built-in `fetch` — for OCR.space & transliteration API calls (Node 18+)

No EasyOCR fallback (Python-only). OCR.space is the only OCR engine.

## API Endpoints (same contract — frontend unchanged)

| Endpoint | Method | What it does |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/transliterate` | GET | Proxy Google Input Tools |
| `/api/ocr/preview` | POST | Upload doc → OCR.space → parse → return structured fields |
| `/api/ocr/reparse` | POST | Re-parse raw text into structured fields |

Dropped: `/api/render/jpg`, `/api/render/preview` (unused by frontend)

## Implementation Steps

### Step 1: Create `server/package.json` and install deps

### Step 2: Port `parser.py` → `server/parser.js`
- Port STRUCTURED_DEFAULTS, FIELD_ALIASES, SECTION_HEADINGS, REQUIRED_FIELDS
- Port DEVANAGARI_DIGITS translation
- Port normalize_text(), parse_structured_fields(), extract_template_settings()
- Port all helper functions (_extract_inline_pairs, _resolve_field, etc.)
- Port ALIAS_TO_FIELD map, LABEL_REGEX, SORTED_ALIASES

### Step 3: Create `server/index.js` — Express app with all routes
- Health check
- Transliteration proxy (fetch Google Input Tools)
- OCR preview: multer upload → PDF text extract or OCR.space API → parse
- Reparse: JSON body → parse
- Serve frontend static files from `frontend/dist/`

### Step 4: Update frontend
- `vite.config.ts`: Add proxy for `/api` in dev mode
- `api.ts`: Make API_BASE_URL work for both dev and production
- Build frontend: `npm run build`

### Step 5: Update launch.json for local dev

### Step 6: Hostinger deployment setup
- Add start script to server/package.json
- Frontend build served as static files by Express

## What Gets Deleted
- `backend/` folder (entire Python backend)
- No more .venv, requirements.txt, Python dependencies

## Risks & Mitigations
- **PDF image OCR**: pdf-parse only extracts text from text-based PDFs. For scanned PDFs, we send the raw PDF bytes to OCR.space (it accepts PDFs directly). ✅ Covered.
- **OCR.space down**: No EasyOCR fallback. User gets error message. Acceptable tradeoff.
- **File size limit**: OCR.space free tier = 1MB. We compress images as JPEG before sending. ✅ Already handled.
