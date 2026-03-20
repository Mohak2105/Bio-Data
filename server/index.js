import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import Tesseract from "tesseract.js";
import * as mupdf from "mupdf";
import sharp from "sharp";
import { parseStructuredFields, extractTemplateSettings } from "./parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

const PORT = process.env.PORT || 8001;

// Prevent server crashes from Tesseract worker errors (but NOT startup errors)
let serverStarted = false;
process.on("uncaughtException", (err) => {
  if (!serverStarted) {
    console.error("Fatal startup error:", err.message);
    process.exit(1);
  }
  console.error("Uncaught exception (server still running):", err.message);
});
process.on("unhandledRejection", (err) => {
  if (!serverStarted) {
    console.error("Fatal startup rejection:", err);
    process.exit(1);
  }
  console.error("Unhandled rejection (server still running):", err);
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors());
app.use(express.json({ limit: "20mb" }));

// Serve frontend static files (production)
const frontendDist = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(frontendDist));

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// Transliterate (proxy Google Input Tools)
// ---------------------------------------------------------------------------

app.get("/api/transliterate", async (req, res) => {
  const { text, lang = "mr" } = req.query;
  if (!text) return res.json({ suggestions: [] });

  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=${lang}-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();

    if (data[0] === "SUCCESS" && data[1] && data[1][0] && data[1][0][1]) {
      return res.json({ suggestions: data[1][0][1] });
    }
    res.json({ suggestions: [text] });
  } catch {
    res.json({ suggestions: [text] });
  }
});

// ---------------------------------------------------------------------------
// OCR Preview: upload document → OCR.space → parse
// ---------------------------------------------------------------------------

app.post("/api/ocr/preview", upload.fields([{ name: "document", maxCount: 1 }, { name: "photo", maxCount: 1 }]), async (req, res) => {
  try {
    const documentFile = req.files?.document?.[0];
    if (!documentFile || !documentFile.buffer.length) {
      return res.status(400).json({ detail: "Uploaded document is empty." });
    }

    const photoFile = req.files?.photo?.[0];
    const filename = documentFile.originalname || "upload";
    const ext = path.extname(filename).toLowerCase();

    let rawText = "";
    let segments = [];
    let engineUsed = "none";
    let warnings = [];
    let pageCount = 1;
    let extractedFromPdfText = false;

    // Try PDF text extraction first
    if (ext === ".pdf") {
      const pdfResult = await extractPdfText(documentFile.buffer);
      pageCount = pdfResult.pageCount || 1;

      if (pdfResult.text && pdfResult.text.trim().length > 20) {
        rawText = pdfResult.text;
        segments = rawText.split("\n").filter((l) => l.trim()).map((l) => ({ text: l, confidence: 1.0 }));
        engineUsed = "pdf-text";
        extractedFromPdfText = true;
      }
    }

    // If no PDF text, run Tesseract OCR
    if (!extractedFromPdfText) {
      if (![".pdf", ".jpg", ".jpeg", ".png"].includes(ext)) {
        return res.status(400).json({ detail: "Only PDF, JPG and PNG files are supported." });
      }

      let imageBuffers = [];

      if (ext === ".pdf") {
        // Scanned PDF — convert pages to images first
        console.log("PDF: converting pages to images for OCR...");
        imageBuffers = pdfToImages(documentFile.buffer);
        pageCount = imageBuffers.length;
        console.log(`PDF: ${imageBuffers.length} pages converted to images`);
        if (imageBuffers.length === 0) {
          warnings.push("PDF pages render झाले नाही. PDF corrupt असू शकतो.");
        }
      } else {
        imageBuffers = [documentFile.buffer];
      }

      // Run OCR on all images and combine results
      // Note: PDF-rendered images are already large (3x/216DPI) — runOcr will skip upscaling
      let allLines = [];
      for (let i = 0; i < imageBuffers.length; i++) {
        console.log(`OCR: processing ${ext === ".pdf" ? `page ${i + 1}/${imageBuffers.length}` : "image"}...`);
        try {
          const ocrResult = await runOcr(imageBuffers[i], ext === ".pdf" ? ".png" : ext);
          allLines.push(...ocrResult.lines);
          if (ocrResult.warnings.length) warnings.push(...ocrResult.warnings);
          if (ocrResult.engineUsed !== "none") engineUsed = ocrResult.engineUsed;
        } catch (ocrErr) {
          console.error(`OCR error on ${ext === ".pdf" ? `page ${i + 1}` : "image"}:`, ocrErr.message);
          warnings.push(`OCR error: ${ocrErr.message}`);
        }
      }

      segments = allLines.map((l) => ({ text: l.text, confidence: l.confidence }));
      rawText = allLines.map((l) => l.text).join("\n");
    }

    // Parse structured fields
    const { fields, missingFields, lowConfidenceFields } = parseStructuredFields(rawText, segments);
    const templateSettings = extractTemplateSettings(rawText);

    // Apply default for office contact if not extracted by OCR
    if (!fields.contacts.office_contact) fields.contacts.office_contact = "9975285800";

    // Make sure 9975285800 is NOT in self_contact or parent_contact — only office
    if (fields.contacts.self_contact === "9975285800") fields.contacts.self_contact = "";
    if (fields.contacts.parent_contact && fields.contacts.parent_contact.includes("9975285800")) {
      fields.contacts.parent_contact = fields.contacts.parent_contact
        .replace(/9975285800/g, "").replace(/^\s*[\/,\s]+|[\/,\s]+$/g, "").trim();
    }

    // Handle photo
    let photoDataUrl = null;
    if (photoFile && photoFile.buffer.length) {
      const mimeType = photoFile.mimetype === "image/png" ? "image/png" : "image/jpeg";
      photoDataUrl = `data:${mimeType};base64,${photoFile.buffer.toString("base64")}`;
    }

    // Return camelCase response (matching Python's CamelModel)
    res.json({
      rawOcrText: rawText,
      structuredFields: snakeToCamelFields(fields),
      templateSettings: snakeToCamel(templateSettings),
      missingFields,
      lowConfidenceFields,
      metadata: {
        engineUsed: engineUsed,
        pageCount,
        warnings,
        extractedFromPdfText,
      },
      photoDataUrl,
    });
  } catch (error) {
    console.error("OCR preview error:", error);
    res.status(500).json({ detail: `Preview तयार होताना error आला: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// Reparse: re-parse raw text
// ---------------------------------------------------------------------------

app.post("/api/ocr/reparse", (req, res) => {
  try {
    const rawOcrText = req.body.rawOcrText || req.body.raw_ocr_text || "";
    const { fields, missingFields, lowConfidenceFields } = parseStructuredFields(rawOcrText);

    res.json({
      structuredFields: snakeToCamelFields(fields),
      missingFields,
      lowConfidenceFields,
    });
  } catch (error) {
    console.error("Reparse error:", error);
    res.status(500).json({ detail: `Reparse error: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// Catch-all: serve frontend for client-side routing
// ---------------------------------------------------------------------------

app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// ---------------------------------------------------------------------------
// OCR.space API call
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tesseract worker (single worker — saves RAM on shared hosting)
// ---------------------------------------------------------------------------
let tesseractWorker = null;

async function getTesseractWorker() {
  if (tesseractWorker) return tesseractWorker;
  console.log("OCR: Initializing Tesseract worker (mar+eng)...");
  const worker = await Tesseract.createWorker("mar+eng", Tesseract.OEM.LSTM_ONLY, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        process.stdout.write(`\rOCR: ${(m.progress * 100).toFixed(0)}%`);
      }
    },
  });
  await worker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: "6", // Assume single uniform block — better for table layouts
  });
  tesseractWorker = worker;
  console.log("\nOCR: Tesseract worker ready.");
  return worker;
}

// ---------------------------------------------------------------------------
// Image preprocessing (sharp)
// ---------------------------------------------------------------------------

async function getImageMetadata(buf) {
  try { return await sharp(buf).metadata(); }
  catch { return { width: 0, height: 0, format: "unknown" }; }
}

function upscaleTo(buf, w, h, target) {
  const maxDim = Math.max(w, h);
  if (maxDim >= target) return null; // already large enough
  const scale = target / maxDim;
  return sharp(buf).resize({
    width: Math.round(w * scale), height: Math.round(h * scale),
    fit: "fill", kernel: "lanczos3",
  });
}

/** Crop decorative borders (golden frames etc.) — only if edges look decorative (colored/textured).
 *  Plain/white edges are NOT cropped to avoid cutting off text that starts near the margin. */
async function cropBorders(buf, w, h) {
  const cropX = Math.round(w * 0.08);
  const cropY = Math.round(h * 0.04);
  const newW = w - cropX * 2;
  const newH = h - cropY * 2;
  if (newW < 200 || newH < 200) return { buf, w, h }; // too small to crop

  try {
    // Sample a thin strip from the left edge to check if it's decorative
    const stripW = Math.max(4, Math.round(w * 0.03));
    const leftStrip = await sharp(buf)
      .extract({ left: 0, top: Math.round(h * 0.2), width: stripW, height: Math.round(h * 0.6) })
      .resize({ width: 1, height: 1, fit: "cover" }) // average color
      .raw().toBuffer();

    const r = leftStrip[0], g = leftStrip[1], b = leftStrip[2];
    // If the edge is near-white (all channels > 200) or near-black text on white, skip crop
    const brightness = (r + g + b) / 3;
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);
    if (brightness > 200 || (brightness > 180 && saturation < 30)) {
      console.log(`cropBorders: edge is plain (rgb=${r},${g},${b}, bright=${brightness.toFixed(0)}), skipping crop`);
      return { buf, w, h };
    }

    console.log(`cropBorders: edge looks decorative (rgb=${r},${g},${b}, bright=${brightness.toFixed(0)}), cropping ${cropX}px sides`);
    const cropped = await sharp(buf)
      .extract({ left: cropX, top: cropY, width: newW, height: newH })
      .png().toBuffer();
    return { buf: cropped, w: newW, h: newH };
  } catch {
    return { buf, w, h };
  }
}

/** Pass 1: Upscale + keep original colors (best for colorful biodatas) */
async function prepColor(buf, w, h) {
  const pipeline = upscaleTo(buf, w, h, 5000);
  if (!pipeline) return buf;
  return await pipeline.sharpen({ sigma: 0.5 }).png().toBuffer();
}

/** Pass 2: Upscale + grayscale + normalize (for low contrast images) */
async function prepGray(buf, w, h) {
  const maxDim = Math.max(w, h);
  const scale = maxDim < 5000 ? 5000 / maxDim : 1;
  return await sharp(buf)
    .resize({ width: Math.round(w * scale), height: Math.round(h * scale), fit: "fill", kernel: "lanczos3" })
    .grayscale().normalize().sharpen({ sigma: 1.2 })
    .png().toBuffer();
}

/** Pass 3: Upscale + high contrast (for very faint/blurry text) */
async function prepContrast(buf, w, h) {
  const maxDim = Math.max(w, h);
  const scale = maxDim < 5000 ? 5000 / maxDim : 1;
  return await sharp(buf)
    .resize({ width: Math.round(w * scale), height: Math.round(h * scale), fit: "fill", kernel: "lanczos3" })
    .grayscale().normalize().linear(1.5, -30).sharpen({ sigma: 1.5 })
    .png().toBuffer();
}

// ---------------------------------------------------------------------------
// Single OCR pass
// ---------------------------------------------------------------------------

async function runSinglePass(worker, buffer, passName) {
  try {
    const { data } = await Promise.race([
      worker.recognize(buffer),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 120000)),
    ]);

    const fullText = (data.text || "").trim();
    const confidence = data.confidence || 0;
    const lines = [];
    for (const line of fullText.split("\n")) {
      const t = line.trim();
      if (t) lines.push({ text: t, confidence: confidence / 100 });
    }
    const devChars = (fullText.match(/[\u0900-\u097F]/g) || []).length;
    const totalChars = fullText.replace(/\s/g, "").length;

    console.log(`  ${passName}: ${lines.length} lines, conf=${confidence.toFixed(0)}%, devanagari=${devChars}/${totalChars}`);
    return { text: fullText, lines, confidence, devChars, totalChars };
  } catch (err) {
    console.error(`  ${passName} error:`, err.message);
    return { text: "", lines: [], confidence: 0, devChars: 0, totalChars: 0 };
  }
}

// ---------------------------------------------------------------------------
// Smart multi-pass OCR: max 3 passes, early exit, single worker
// ---------------------------------------------------------------------------

async function runOcr(fileBuffer, ext) {
  try {
    console.log(`OCR: file size=${(fileBuffer.length / 1024).toFixed(0)}KB, ext=${ext}`);

    if (!fileBuffer || fileBuffer.length < 100) {
      return { lines: [], engineUsed: "none", warnings: ["Image buffer खूप लहान आहे."] };
    }

    const meta = await getImageMetadata(fileBuffer);
    const w = meta.width || 800;
    const h = meta.height || 800;
    const maxDim = Math.max(w, h);
    console.log(`OCR: input ${w}x${h}, format=${meta.format}`);

    const worker = await getTesseractWorker();

    // Crop decorative borders (golden frames, etc.) to reduce OCR noise
    const cropped = await cropBorders(fileBuffer, w, h);
    const srcBuf = cropped.buf;
    const srcW = cropped.w;
    const srcH = cropped.h;
    if (srcW !== w || srcH !== h) {
      console.log(`OCR: cropped borders → ${srcW}x${srcH}`);
    }

    // --- Pass 1: Color + upscale (works best for most biodatas) ---
    console.log("Pass 1/3: color + upscale...");
    let buf1;
    try { buf1 = await prepColor(srcBuf, srcW, srcH); } catch { buf1 = srcBuf; }
    const r1 = await runSinglePass(worker, buf1, "P1-color");
    buf1 = null; // free memory

    // EARLY EXIT: strict criteria — high confidence AND good Devanagari ratio
    const r1DevRatio = r1.totalChars > 0 ? r1.devChars / r1.totalChars : 0;
    if (r1.lines.length >= 15 && r1.confidence >= 70 && r1.devChars > 100 && r1DevRatio > 0.5) {
      console.log(`=> Pass 1 GOOD ENOUGH (${r1.lines.length} lines, ${r1.confidence.toFixed(0)}%, dev=${r1.devChars}, ratio=${r1DevRatio.toFixed(2)})`);
      console.log(`OCR text:\n---\n${r1.text.substring(0, 600)}\n---`);
      return { lines: r1.lines, engineUsed: "tesseract", warnings: [] };
    }

    // --- Pass 2: Grayscale + normalize ---
    console.log("Pass 2/3: grayscale + normalize...");
    let buf2;
    try { buf2 = await prepGray(srcBuf, srcW, srcH); } catch { buf2 = srcBuf; }
    const r2 = await runSinglePass(worker, buf2, "P2-gray");
    buf2 = null;

    // EARLY EXIT: strict criteria
    const r2DevRatio = r2.totalChars > 0 ? r2.devChars / r2.totalChars : 0;
    if (r2.lines.length >= 15 && r2.confidence >= 70 && r2.devChars > 100 && r2DevRatio > 0.5) {
      console.log(`=> Pass 2 GOOD ENOUGH (${r2.lines.length} lines, ${r2.confidence.toFixed(0)}%, dev=${r2.devChars}, ratio=${r2DevRatio.toFixed(2)})`);
      console.log(`OCR text:\n---\n${r2.text.substring(0, 600)}\n---`);
      return { lines: r2.lines, engineUsed: "tesseract", warnings: [] };
    }

    // --- Pass 3: High contrast (last resort) ---
    console.log("Pass 3/3: high contrast...");
    let buf3;
    try { buf3 = await prepContrast(srcBuf, srcW, srcH); } catch { buf3 = srcBuf; }
    const r3 = await runSinglePass(worker, buf3, "P3-contrast");
    buf3 = null;

    // --- Pick best across all 3 passes ---
    const allResults = [r1, r2, r3].filter((r) => r.lines.length > 0);

    if (allResults.length === 0) {
      return { lines: [], engineUsed: "none", warnings: ["Text सापडला नाही. Original clear image upload करा."] };
    }

    // Score: devChars weighted by confidence, penalize table border noise (=, |)
    const best = allResults.reduce((a, b) => {
      const noiseA = (a.text.match(/[=|]/g) || []).length;
      const noiseB = (b.text.match(/[=|]/g) || []).length;
      const scoreA = a.devChars * (a.confidence / 100) + a.lines.length - noiseA * 0.5;
      const scoreB = b.devChars * (b.confidence / 100) + b.lines.length - noiseB * 0.5;
      return scoreA >= scoreB ? a : b;
    });

    const passNames = ["P1-color", "P2-gray", "P3-contrast"];
    const idx = [r1, r2, r3].indexOf(best);
    console.log(`\n=> Best: ${passNames[idx]} (${best.lines.length} lines, conf=${best.confidence.toFixed(0)}%, dev=${best.devChars})`);
    console.log(`OCR text:\n---\n${best.text.substring(0, 600)}\n---`);

    return { lines: best.lines, engineUsed: "tesseract", warnings: [] };
  } catch (error) {
    console.error("OCR error:", error);
    try { await tesseractWorker?.terminate(); } catch {}
    tesseractWorker = null;
    return { lines: [], engineUsed: "none", warnings: [`OCR scan झाले नाही: ${error.message}`] };
  }
}

// ---------------------------------------------------------------------------
// PDF text extraction (pure JS)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PDF to images (for scanned PDFs)
// ---------------------------------------------------------------------------

function pdfToImages(pdfBuffer) {
  try {
    const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
    const images = [];
    const pageCount = doc.countPages();

    for (let i = 0; i < pageCount; i++) {
      try {
        const page = doc.loadPage(i);
        // Render at 3x scale (216 DPI) for good OCR quality with Devanagari
        const pixmap = page.toPixmap(mupdf.Matrix.scale(3, 3), mupdf.ColorSpace.DeviceRGB, false, true);
        const pngBuffer = pixmap.asPNG();
        const buf = Buffer.from(pngBuffer);
        // Validate it's a valid PNG (starts with PNG magic bytes)
        if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
          console.log(`PDF page ${i + 1}: rendered ${pixmap.getWidth()}x${pixmap.getHeight()}px (${(buf.length / 1024).toFixed(0)}KB)`);
          images.push(buf);
        } else {
          console.error(`PDF page ${i + 1}: invalid PNG output (${buf.length} bytes), skipping`);
        }
      } catch (pageErr) {
        console.error(`PDF page ${i + 1} render error:`, pageErr.message);
      }
    }

    return images;
  } catch (error) {
    console.error("mupdf PDF-to-images error:", error.message);
    return [];
  }
}

async function extractPdfText(buffer) {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return { text: data.text || "", pageCount: data.numpages || 0 };
  } catch (error) {
    console.error("PDF parse error:", error);
    return { text: "", pageCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// snake_case → camelCase conversion (to match Python's CamelModel output)
// ---------------------------------------------------------------------------

function snakeToCamelKey(key) {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function snakeToCamel(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamelKey(key)] = value;
  }
  return result;
}

function snakeToCamelFields(fields) {
  const result = {};
  for (const [section, sectionData] of Object.entries(fields)) {
    result[section] = snakeToCamel(sectionData);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  serverStarted = true;
  console.log(`Server running on http://localhost:${PORT}`);
});
