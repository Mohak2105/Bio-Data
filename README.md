# Marathi Biodata Portal

Stateless admin portal for Marathi biodata intake. The admin uploads a biodata PDF/image and a separate photo, reviews OCR text, edits fields, previews the biodata card, and exports a final JPG.

## Stack

- Frontend: `React + Vite + TypeScript`
- Backend: `Node.js + Express`
- OCR pipeline: direct PDF text extraction first, then `Tesseract.js` OCR for images and scanned PDFs

## Project Layout

- `frontend/` React admin UI
- `server/` Express API, OCR/parser services, production web server
- `backend/` legacy Python backend kept for reference during migration

## Local Development

```bash
cd server
npm install
node index.js
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Environment variables:

- `PORT` backend port. Default: `8001`
- `VITE_API_BASE_URL` frontend API base URL. Default in dev: proxy via Vite
- `NODE_ENV` set to `production` in containerized deploys

## Production Docker

This repo now includes a production `Dockerfile` for platforms like Coolify.

Build locally:

```bash
docker build -t marathi-biodata .
```

Run locally:

```bash
docker run --rm -p 8001:8001 -e PORT=8001 marathi-biodata
```

The container:

- builds the frontend into `frontend/dist`
- installs production server dependencies
- starts the Express server with `node server/index.js`
- serves the built frontend and API from the same container

## API Endpoints

- `POST /api/ocr/preview` multipart upload with `document` and optional `photo`
- `POST /api/ocr/reparse` JSON re-parse of edited OCR text
- `GET /api/health` health check

## Notes

- The app does not use a database.
- Uploaded files are processed in memory for each request and are not persisted.
- One biodata template is included in the current MVP.
