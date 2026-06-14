const { GoogleGenerativeAI } = require('@google/generative-ai');
const { normalizeExtraction } = require('../invoiceParser');

const SYSTEM_PROMPT = `Eres un asistente experto en facturas y recibos de pago colombianos.
Analiza la imagen o PDF y extrae los datos para registrar un pago en la app Vencely.

Formatos habituales: Enel, Codensa, EPM, Claro, Movistar, Tigo, ETB, acueducto, gas, bancos (Bancolombia, Davivienda, BBVA, etc.), tarjetas de crédito y créditos.

Responde ÚNICAMENTE con JSON válido (sin markdown ni texto extra) con estos campos:
- provider (string): nombre del emisor (Enel, Claro, EPM, banco, etc.)
- invoice_number (string|null): número de factura, referencia o cuenta
- amount (number): total a pagar en moneda local, sin símbolos ni separadores de miles
- dueDate (string): fecha de vencimiento en formato YYYY-MM-DD
- category (string): uno de servicios|telefonia|tarjeta|credito|otro
- title (string): título corto para mostrar al usuario
- line_items (array): [{ "description": string, "amount": number }] si hay desglose visible
- tax (number|null): IVA u otros impuestos si aparecen
- currency (string): COP por defecto en Colombia
- confidence (number 0-1): confianza global de la extracción
- field_confidence (object): { "provider", "amount", "dueDate", "category", "invoiceNumber" } cada uno 0-1

Reglas para montos colombianos: interpreta "$ 123.456" o "123.456 COP" como 123456.
Si no encuentras un campo, usa null para invoice_number/tax y estima category/title según el emisor.
País del usuario: Colombia salvo indicación contraria.`;

const SUPPORTED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function parseJsonResponse(text) {
  if (!text) throw new Error('Gemini no devolvió contenido');
  let raw = String(text).trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) raw = fenced[1].trim();
  return JSON.parse(raw);
}

async function extractWithGemini(buffer, mimeType, country = 'CO') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const safeMime = mimeType || 'image/jpeg';
  if (!SUPPORTED_MIMES.has(safeMime)) {
    throw new Error(`Gemini no admite mimeType: ${safeMime}`);
  }

  const base64 = buffer.toString('base64');
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const countryLabel = country === 'CO' ? 'Colombia' : country;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      maxOutputTokens: 1024,
    },
  });

  const prompt = `${SYSTEM_PROMPT.replace('Colombia', countryLabel)}

Extrae los datos de este documento de factura o recibo de pago. Devuelve solo JSON.`;

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        data: base64,
        mimeType: safeMime,
      },
    },
  ]);

  const response = result.response;
  const content = response.text();
  const parsed = parseJsonResponse(content);

  return normalizeExtraction(
    {
      ...parsed,
      fieldConfidence: parsed.field_confidence || parsed.fieldConfidence,
      confidence: Number(parsed.confidence) || 0.85,
      note: null,
    },
    { source: 'gemini', country }
  );
}

module.exports = {
  extractWithGemini,
  SYSTEM_PROMPT,
  parseJsonResponse,
};
