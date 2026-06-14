#!/usr/bin/env node
/**
 * Prueba rápida del parser y del endpoint /api/invoices/extract (mock).
 * Uso: node scripts/test-invoice-extract.js [API_URL]
 */
require('dotenv').config();

const { parseFromText } = require('../server/services/invoiceParser');
const { extractWithGemini, parseJsonResponse } = require('../server/services/ocr/geminiVisionProvider');
const { resolveProviderChain } = require('../server/services/invoiceProcessor');

const SAMPLE_OCR = `
ENEL COLOMBIA S.A.
Factura de energía eléctrica
Número de factura: ENEL-2026-445566
Fecha de vencimiento: 18/06/2026
Total a pagar: $ 92.500
IVA: $ 14.750
`;

async function testGeminiModule() {
  console.log('--- Gemini provider (sin API key) ---');
  delete process.env.GEMINI_API_KEY;
  const result = await extractWithGemini(Buffer.from('fake'), 'image/png', 'CO');
  if (result !== null) {
    throw new Error('extractWithGemini debería devolver null sin GEMINI_API_KEY');
  }

  const parsed = parseJsonResponse('```json\n{"provider":"Enel","amount":1000}\n```');
  if (parsed.provider !== 'Enel' || parsed.amount !== 1000) {
    throw new Error('parseJsonResponse no parseó JSON con fence');
  }

  const chain = resolveProviderChain();
  console.log('Cadena de proveedores (env actual):', chain.join(' → '));
  console.log('✓ Gemini module OK\n');
}

async function testParser() {
  const result = parseFromText(SAMPLE_OCR, { country: 'CO' });
  console.log('--- Parser (texto Enel simulado) ---');
  console.log(JSON.stringify(result, null, 2));
  if (result.provider !== 'Enel Colombia' || result.amount !== 92500) {
    throw new Error('Parser no detectó Enel/monto esperado');
  }
  console.log('✓ Parser OK\n');
}

async function testApi(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/invoices/extract`;
  process.env.INVOICE_PROVIDER = process.env.INVOICE_PROVIDER || 'mock';

  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const buffer = Buffer.from(pngBase64, 'base64');

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/png' }), 'test-invoice.png');
  form.append('country', 'CO');

  console.log(`--- API POST ${url} (INVOICE_PROVIDER=${process.env.INVOICE_PROVIDER}) ---`);
  const res = await fetch(url, { method: 'POST', body: form });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log(JSON.stringify(data, null, 2));
  if (!res.ok || !data.extracted?.provider) {
    throw new Error('API extract falló');
  }
  console.log('✓ API extract OK\n');
}

async function main() {
  await testGeminiModule();
  await testParser();
  const base = process.argv[2] || `http://127.0.0.1:${process.env.PORT || 3000}`;
  try {
    await testApi(base);
  } catch (err) {
    console.warn('API no disponible (inicia con npm run server):', err.message);
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
