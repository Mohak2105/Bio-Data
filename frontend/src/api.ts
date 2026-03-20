import type { OcrPreviewResponse, ReparseResponse, StructuredFields, TemplateSettings } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Compress an image file only if it exceeds the upload limit (8MB).
 * We use local Tesseract.js now — no OCR.space 1MB limit.
 * Bigger image = better OCR quality for Devanagari text.
 */
async function compressImage(file: File, maxBytes = 8_000_000): Promise<File> {
  // Don't compress PDFs
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return file;
  }

  // Only compress if file is very large (>8MB)
  if (file.size <= maxBytes) {
    return file;
  }

  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Only scale down extremely large images (max 5000px)
      const maxDim = 5000;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      // High quality JPEG — preserve detail for OCR
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
            type: 'image/jpeg',
          });
          console.log(`Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);
          resolve(compressed);
        },
        'image/jpeg',
        0.95,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

export async function uploadPreview(documentFile: File, photoFile?: File | null): Promise<OcrPreviewResponse> {
  // Compress image before upload (OCR.space free tier = 1MB limit)
  const compressedDoc = await compressImage(documentFile);

  const formData = new FormData();
  formData.append('document', compressedDoc);

  if (photoFile) {
    formData.append('photo', photoFile);
  }

  const response = await fetch(`${API_BASE_URL}/api/ocr/preview`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json() as Promise<OcrPreviewResponse>;
}

export async function reparseText(rawOcrText: string): Promise<ReparseResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ocr/reparse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rawOcrText }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json() as Promise<ReparseResponse>;
}

export async function renderJpg(
  structuredFields: StructuredFields,
  templateSettings: TemplateSettings,
  photoDataUrl?: string | null,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/render/jpg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredFields,
      templateSettings,
      photoDataUrl,
      templateId: 'basic-marathi-v1',
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.blob();
}

export async function renderPreview(
  structuredFields: StructuredFields,
  templateSettings: TemplateSettings,
  photoDataUrl?: string | null,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/render/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredFields,
      templateSettings,
      photoDataUrl,
      templateId: 'basic-marathi-v1',
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.blob();
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.detail ?? 'Server request failed';
  } catch {
    return 'Server request failed';
  }
}
