# Marathi Biodata Portal

Stateless admin portal for Marathi biodata intake. The admin uploads a biodata PDF/image and a separate photo, reviews OCR text, edits fields, previews the biodata card, and exports a final JPG.

## Stack

- Frontend: `React + Vite + TypeScript`
- Backend: `FastAPI + Pillow + PyMuPDF`
- OCR priority: `PaddleOCR` first, `Tesseract Marathi` fallback, and direct PDF text extraction when a PDF already contains selectable text

## Project Layout

- `frontend/` React admin UI
- `backend/` FastAPI API, OCR/parser services, JPG renderer

## Backend Setup

```bash
cd backend
python -m venv .venv
\.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Optional OCR improvements:

1. Install `PaddlePaddle` first for your OS/Python, then install `paddleocr` for the primary Marathi OCR engine.
2. Install `Tesseract OCR` with Marathi language data (`mar.traineddata`) if you want the fallback engine.
3. Set `TESSERACT_CMD` if the `tesseract` executable is not on `PATH`.

Environment variables:

- `PORTAL_CORS_ORIGINS` comma-separated list. Default: `http://localhost:5173,http://127.0.0.1:5173`
- `TESSERACT_CMD` optional full path to `tesseract.exe`
- `PADDLEOCR_LANG` optional Paddle language code. Default: `mr`

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Environment variables:

- `VITE_API_BASE_URL` default: `http://localhost:8000`

## API Endpoints

- `POST /api/ocr/preview` multipart upload with `document` and optional `photo`
- `POST /api/ocr/reparse` JSON re-parse of edited OCR text
- `POST /api/render/jpg` JSON render request returning `image/jpeg`
- `GET /api/health` health check

## Notes

- The app does not use a database.
- Uploaded files are processed in memory for each request and are not persisted.
- One biodata template is included: `basic-marathi-v1`.
