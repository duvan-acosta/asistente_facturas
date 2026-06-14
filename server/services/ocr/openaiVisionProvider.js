const { normalizeExtraction } = require('../invoiceParser');

const SYSTEM_PROMPT = `Eres un asistente experto en facturas colombianas y latinoamericanas.
Extrae datos de la imagen o documento y responde SOLO con JSON válido con estos campos:
- provider (string): nombre del emisor (Enel, Claro, EPM, banco, etc.)
- invoice_number (string|null): número de factura o referencia
- amount (number): total a pagar en moneda local, sin símbolos
- dueDate (string): fecha de vencimiento YYYY-MM-DD
- category (string): uno de servicios|telefonia|tarjeta|credito|otro
- title (string): título corto para mostrar al usuario
- line_items (array): [{ description, amount }] si hay desglose visible
- tax (number|null): IVA u otros impuestos si aparecen
- currency (string): COP por defecto en Colombia
- confidence (number 0-1): confianza global
- field_confidence (object): { provider, amount, dueDate, category, invoiceNumber } cada uno 0-1

Montos colombianos: interpreta $ 123.456 como 123456 COP. País del usuario: Colombia salvo indicación contraria.`;

async function extractWithOpenAI(buffer, mimeType, country = 'CO') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const base64 = buffer.toString('base64');
  const isPdf = mimeType === 'application/pdf';

  let userContent;
  if (isPdf) {
    userContent = [
      {
        type: 'text',
        text: 'Documento PDF de factura (contenido base64 truncado). Extrae los campos solicitados. Devuelve solo JSON.',
      },
      { type: 'text', text: base64.slice(0, 16000) },
    ];
  } else {
    userContent = [
      { type: 'text', text: 'Extrae los datos de esta imagen de factura. Devuelve solo JSON.' },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
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
        { role: 'system', content: SYSTEM_PROMPT.replace('Colombia', country === 'CO' ? 'Colombia' : country) },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 800,
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
  return normalizeExtraction(
    {
      ...parsed,
      fieldConfidence: parsed.field_confidence || parsed.fieldConfidence,
      confidence: Number(parsed.confidence) || 0.85,
      note: null,
    },
    { source: 'openai', country }
  );
}

module.exports = {
  extractWithOpenAI,
};
