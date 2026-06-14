/**
 * Pipeline de procesamiento de imágenes/PDF de facturas — Vencely
 *
 * Arquitectura híbrida (4 etapas):
 *
 *   [Upload multipart/base64]
 *          │
 *          ▼
 *   ┌──────────────────┐
 *   │ 1. Preprocesado  │  sharp: rotación EXIF, resize ≤2000px, contraste
 *   └────────┬─────────┘
 *            ▼
 *   ┌──────────────────┐
 *   │ 2. OCR / Visión  │  gemini │ openai │ tesseract.js │ mock
 *   └────────┬─────────┘
 *            ▼
 *   ┌──────────────────┐
 *   │ 3. Parser CO     │  invoiceParser: Enel, Claro, EPM, montos, fechas
 *   └────────┬─────────┘
 *            ▼
 *   ┌──────────────────┐
 *   │ 4. Persistencia  │  PostgreSQL invoices + user_events
 *   └────────┬─────────┘
 *            ▼
 *   [JSON → frontend pre-llena formulario]
 *
 * Cadena de fallback (INVOICE_PROVIDER=auto):
 *   Gemini (GEMINI_API_KEY) → OpenAI (OPENAI_API_KEY) → Tesseract + regex → mock
 *
 * Variables: INVOICE_PROVIDER=auto|gemini|openai|tesseract|mock
 *            GEMINI_API_KEY, GEMINI_MODEL, OPENAI_API_KEY
 */

const sharp = require('sharp');
const { extractWithGemini } = require('./ocr/geminiVisionProvider');
const { extractWithOpenAI } = require('./ocr/openaiVisionProvider');
const { extractWithTesseract } = require('./ocr/tesseractProvider');
const { extractWithMock } = require('./ocr/mockProvider');
const { normalizeExtraction } = require('./invoiceParser');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/gif']);

function resolveProviderChain() {
  const forced = (process.env.INVOICE_PROVIDER || 'auto').toLowerCase();
  const visionFallback = ['openai', 'tesseract', 'mock'];

  if (forced === 'mock') return ['mock'];
  if (forced === 'gemini') return ['gemini', ...visionFallback];
  if (forced === 'openai') return ['openai', 'tesseract', 'mock'];
  if (forced === 'tesseract') return ['tesseract', 'mock'];

  if (process.env.INVOICE_API_URL) {
    return ['custom', 'gemini', ...visionFallback];
  }
  if (process.env.GEMINI_API_KEY) {
    return ['gemini', ...visionFallback];
  }
  if (process.env.OPENAI_API_KEY) {
    return ['openai', 'tesseract', 'mock'];
  }
  return ['tesseract', 'mock'];
}

async function preprocessImage(buffer, mimeType) {
  if (!buffer || !IMAGE_MIMES.has(mimeType)) {
    return { buffer, mimeType, preprocessed: false };
  }

  try {
    const processed = await sharp(buffer)
      .rotate()
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .normalize()
      .sharpen({ sigma: 0.8 })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    return { buffer: processed, mimeType: 'image/jpeg', preprocessed: true };
  } catch (err) {
    console.warn('Image preprocessing skipped:', err.message);
    return { buffer, mimeType, preprocessed: false };
  }
}

async function extractWithCustomApi(buffer, mimeType, country) {
  const apiUrl = process.env.INVOICE_API_URL;
  if (!apiUrl) return null;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.INVOICE_API_KEY
        ? { Authorization: `Bearer ${process.env.INVOICE_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      file: buffer.toString('base64'),
      mimeType,
      country,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Invoice API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const parsed = await response.json();
  return normalizeExtraction(parsed, { source: 'custom', country });
}

async function runOcrStage(processedBuffer, mimeType, country) {
  const chain = resolveProviderChain();
  const errors = [];

  for (const provider of chain) {
    try {
      if (provider === 'custom') {
        const result = await extractWithCustomApi(processedBuffer, mimeType, country);
        if (result) return { result, provider: 'custom' };
        continue;
      }
      if (provider === 'gemini') {
        if (!process.env.GEMINI_API_KEY) continue;
        const result = await extractWithGemini(processedBuffer, mimeType, country);
        if (result) return { result, provider: 'gemini' };
        continue;
      }
      if (provider === 'openai') {
        if (!process.env.OPENAI_API_KEY) continue;
        const result = await extractWithOpenAI(processedBuffer, mimeType, country);
        if (result) return { result, provider: 'openai' };
        continue;
      }
      if (provider === 'tesseract') {
        const result = await extractWithTesseract(processedBuffer, mimeType, country);
        if (result && (result.confidence > 0.2 || result.rawText)) {
          return { result, provider: 'tesseract' };
        }
        continue;
      }
      if (provider === 'mock') {
        const result = await extractWithMock();
        return { result, provider: 'mock' };
      }
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
      console.warn(`Invoice provider ${provider} failed:`, err.message);
    }
  }

  throw new Error(errors.join('; ') || 'Ningún proveedor de extracción disponible');
}

/**
 * Procesa un archivo de factura de punta a punta.
 * @returns {{ extracted, rawExtraction, provider, preprocessed }}
 */
async function processInvoice({ buffer, mimeType, country = 'CO' }) {
  const safeMime = mimeType || 'image/jpeg';
  const { buffer: processedBuffer, mimeType: processedMime, preprocessed } = await preprocessImage(
    buffer,
    safeMime
  );

  const { result, provider } = await runOcrStage(processedBuffer, processedMime, country);

  const rawExtraction = {
    provider,
    preprocessed,
    mimeType: safeMime,
    processedMime,
    ocrText: result.rawText || null,
    fieldConfidence: result.fieldConfidence,
    extractedAt: new Date().toISOString(),
  };

  return {
    extracted: result,
    rawExtraction,
    provider,
    preprocessed,
  };
}

function getActiveProviderLabel() {
  const chain = resolveProviderChain();
  return chain[0];
}

module.exports = {
  processInvoice,
  preprocessImage,
  getActiveProviderLabel,
  resolveProviderChain,
};
