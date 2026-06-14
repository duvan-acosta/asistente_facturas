const { createWorker } = require('tesseract.js');
const { parseFromText } = require('../invoiceParser');

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('spa+eng', 1, {
        logger: () => {},
      });
      return worker;
    })();
  }
  return workerPromise;
}

async function extractTextFromPdf(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch {
    return '';
  }
}

async function extractWithTesseract(processedBuffer, mimeType, country = 'CO') {
  let text = '';

  if (mimeType === 'application/pdf') {
    text = await extractTextFromPdf(processedBuffer);
    if (!text.trim()) {
      return parseFromText('', { country });
    }
  } else {
    const worker = await getWorker();
    const { data } = await worker.recognize(processedBuffer);
    text = data.text || '';
  }

  const parsed = parseFromText(text, { country });
  parsed.note = parsed.confidence < 0.5
    ? 'OCR local con baja confianza. Revisa los datos o configura GEMINI_API_KEY u OPENAI_API_KEY para mejor precisión.'
    : 'Datos extraídos por OCR local (Tesseract). Revisa antes de guardar.';
  return parsed;
}

module.exports = {
  extractWithTesseract,
};
