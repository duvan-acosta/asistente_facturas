const MOCK_SAMPLES = [
  {
    provider: 'Enel Colombia',
    amount: 92500,
    dueDate: '2026-06-18',
    category: 'servicios',
    title: 'Factura de servicios',
    confidence: 0.72,
  },
  {
    provider: 'Claro Colombia',
    amount: 48900,
    dueDate: '2026-06-22',
    category: 'telefonia',
    title: 'Internet y TV',
    confidence: 0.68,
  },
  {
    provider: 'Bancolombia - Tarjeta',
    amount: 320000,
    dueDate: '2026-06-25',
    category: 'tarjeta',
    title: 'Estado de cuenta',
    confidence: 0.75,
  },
];

function getMockExtraction() {
  const sample = MOCK_SAMPLES[Math.floor(Math.random() * MOCK_SAMPLES.length)];
  return {
    ...sample,
    source: 'mock',
    note: 'Extracción simulada. Configura OPENAI_API_KEY o INVOICE_API_URL en .env para usar IA real.',
  };
}

async function extractWithOpenAI(buffer, mimeType, country = 'CO') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const base64 = buffer.toString('base64');
  const isPdf = mimeType === 'application/pdf';
  const imageUrl = isPdf
    ? null
    : `data:${mimeType};base64,${base64}`;

  const systemPrompt = `Eres un asistente que extrae datos de facturas colombianas/latinoamericanas.
Responde SOLO con JSON válido con estos campos:
provider (string), amount (number), dueDate (YYYY-MM-DD), category (servicios|telefonia|tarjeta|credito|otro), title (string), confidence (0-1).
País del usuario: ${country}. Montos en moneda local sin símbolos.`;

  let userContent;
  if (isPdf) {
    userContent = [
      {
        type: 'text',
        text: 'Extrae los datos de esta factura PDF (contenido en base64). Devuelve solo JSON.',
      },
      { type: 'text', text: base64.slice(0, 12000) },
    ];
  } else {
    userContent = [
      { type: 'text', text: 'Extrae los datos de esta imagen de factura. Devuelve solo JSON.' },
      { type: 'image_url', image_url: { url: imageUrl } },
    ];
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI no devolvió contenido');

  const parsed = JSON.parse(content);
  return {
    provider: String(parsed.provider || 'Proveedor'),
    amount: Number(parsed.amount) || 0,
    dueDate: parsed.dueDate || new Date().toISOString().slice(0, 10),
    category: parsed.category || 'otro',
    title: parsed.title || parsed.provider || 'Factura',
    confidence: Number(parsed.confidence) || 0.8,
    source: 'openai',
    note: null,
  };
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
  return {
    provider: String(parsed.provider || 'Proveedor'),
    amount: Number(parsed.amount) || 0,
    dueDate: parsed.dueDate || new Date().toISOString().slice(0, 10),
    category: parsed.category || 'otro',
    title: parsed.title || parsed.provider || 'Factura',
    confidence: Number(parsed.confidence) || 0.8,
    source: 'custom',
    note: parsed.note || null,
  };
}

async function extractInvoice({ buffer, mimeType, country = 'CO' }) {
  if (process.env.INVOICE_API_URL) {
    try {
      return await extractWithCustomApi(buffer, mimeType, country);
    } catch (err) {
      console.warn('Custom invoice API failed:', err.message);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await extractWithOpenAI(buffer, mimeType, country);
    } catch (err) {
      console.warn('OpenAI extraction failed:', err.message);
    }
  }

  return getMockExtraction();
}

module.exports = {
  extractInvoice,
  getMockExtraction,
};
