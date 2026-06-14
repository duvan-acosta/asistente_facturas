const MOCK_SAMPLES = [
  {
    provider: 'Enel Colombia',
    invoice_number: 'ENEL-2026-001234',
    amount: 92500,
    dueDate: '2026-06-18',
    category: 'servicios',
    title: 'Energía eléctrica',
    tax: 14750,
    currency: 'COP',
    confidence: 0.72,
    fieldConfidence: { provider: 0.72, amount: 0.72, dueDate: 0.68, category: 0.75, invoiceNumber: 0.5 },
    line_items: [{ description: 'Consumo kWh', amount: 77750 }],
  },
  {
    provider: 'Claro Colombia',
    invoice_number: 'CLARO-889900',
    amount: 48900,
    dueDate: '2026-06-22',
    category: 'telefonia',
    title: 'Internet y TV',
    tax: 7800,
    currency: 'COP',
    confidence: 0.68,
    fieldConfidence: { provider: 0.68, amount: 0.7, dueDate: 0.65, category: 0.7, invoiceNumber: 0.45 },
    line_items: [{ description: 'Plan hogar 300MB', amount: 41100 }],
  },
  {
    provider: 'Bancolombia - Tarjeta',
    invoice_number: 'BC-4567890123',
    amount: 320000,
    dueDate: '2026-06-25',
    category: 'tarjeta',
    title: 'Estado de cuenta tarjeta',
    tax: null,
    currency: 'COP',
    confidence: 0.75,
    fieldConfidence: { provider: 0.75, amount: 0.78, dueDate: 0.72, category: 0.8, invoiceNumber: 0.55 },
    line_items: [{ description: 'Pago mínimo', amount: 320000 }],
  },
];

function getMockExtraction() {
  const sample = MOCK_SAMPLES[Math.floor(Math.random() * MOCK_SAMPLES.length)];
  return {
    ...sample,
    source: 'mock',
    note: 'Extracción simulada (INVOICE_PROVIDER=mock o sin claves). Configura GEMINI_API_KEY, OPENAI_API_KEY o INVOICE_PROVIDER=tesseract para OCR real.',
    rawText: null,
  };
}

async function extractWithMock() {
  return getMockExtraction();
}

module.exports = {
  extractWithMock,
  getMockExtraction,
};
