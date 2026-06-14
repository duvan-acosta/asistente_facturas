/**
 * Heurísticas de parsing para facturas colombianas (OCR / texto plano).
 * Detecta proveedores, montos, fechas y categorías comunes (Enel, Claro, EPM, bancos, etc.).
 */

const PROVIDER_PATTERNS = [
  { pattern: /\benel\b/i, provider: 'Enel Colombia', category: 'servicios', title: 'Energía eléctrica' },
  { pattern: /\bepm\b/i, provider: 'EPM', category: 'servicios', title: 'Servicios EPM' },
  { pattern: /\bclaro\b/i, provider: 'Claro Colombia', category: 'telefonia', title: 'Telefonía / Internet Claro' },
  { pattern: /\bmovistar\b/i, provider: 'Movistar Colombia', category: 'telefonia', title: 'Telefonía Movistar' },
  { pattern: /\btigo\b/i, provider: 'Tigo Colombia', category: 'telefonia', title: 'Telefonía Tigo' },
  { pattern: /\betb\b/i, provider: 'ETB', category: 'telefonia', title: 'Internet ETB' },
  { pattern: /\bgas\s*(natural|caribe|nuevo|surtidor)?/i, provider: 'Gas Natural', category: 'servicios', title: 'Gas' },
  { pattern: /\bagua\s*(de\s*)?(bogot[aá]|medell[ií]n|cali)?/i, provider: 'Acueducto', category: 'servicios', title: 'Agua' },
  { pattern: /\bacueducto\b/i, provider: 'Acueducto', category: 'servicios', title: 'Agua' },
  { pattern: /\bveolia\b/i, provider: 'Veolia', category: 'servicios', title: 'Servicios Veolia' },
  { pattern: /\bvirgin\s*mobile\b/i, provider: 'Virgin Mobile', category: 'telefonia', title: 'Virgin Mobile' },
  { pattern: /\bbancolombia\b/i, provider: 'Bancolombia', category: 'tarjeta', title: 'Bancolombia' },
  { pattern: /\bdavivienda\b/i, provider: 'Davivienda', category: 'tarjeta', title: 'Davivienda' },
  { pattern: /\bbbva\b/i, provider: 'BBVA Colombia', category: 'tarjeta', title: 'BBVA' },
  { pattern: /\bbanco\s*de\s*occidente\b/i, provider: 'Banco de Occidente', category: 'tarjeta', title: 'Banco de Occidente' },
  { pattern: /\bav\s*villas\b/i, provider: 'AV Villas', category: 'tarjeta', title: 'AV Villas' },
  { pattern: /\bscotiabank\b|\bcolpatria\b/i, provider: 'Scotiabank Colpatria', category: 'tarjeta', title: 'Scotiabank Colpatria' },
  { pattern: /\bnubank\b/i, provider: 'Nu Colombia', category: 'tarjeta', title: 'Nu' },
  { pattern: /\bvisa\b|\bmastercard\b|\bamex\b/i, provider: 'Tarjeta de crédito', category: 'tarjeta', title: 'Tarjeta de crédito' },
  { pattern: /\bcredito\s*(vehiculo|hipotecario|libre|consumo)?/i, provider: 'Crédito bancario', category: 'credito', title: 'Crédito' },
  { pattern: /\bcolpensiones\b|\bfopep\b/i, provider: 'Colpensiones', category: 'otro', title: 'Pensión' },
  { pattern: /\bsura\b|\bcolsanitas\b|\bcoomeva\b/i, provider: 'EPS / Salud', category: 'otro', title: 'Salud' },
];

const AMOUNT_LABELS = [
  /total\s*a\s*pagar/i,
  /valor\s*a\s*pagar/i,
  /total\s*factura/i,
  /total\s*mes/i,
  /pago\s*minimo/i,
  /pago\s*m[ií]nimo/i,
  /saldo\s*total/i,
  /importe\s*total/i,
  /monto\s*total/i,
];

const DATE_LABELS = [
  /fecha\s*(de\s*)?vencimiento/i,
  /vencimiento/i,
  /fecha\s*l[ií]mite/i,
  /pagar\s*hasta/i,
  /fecha\s*de\s*pago/i,
  /corte/i,
];

const INVOICE_NUMBER_LABELS = [
  /n[uú]mero\s*de\s*factura/i,
  /no\.?\s*factura/i,
  /factura\s*no\.?/i,
  /referencia\s*de\s*pago/i,
  /n[uú]mero\s*de\s*cuenta/i,
];

function parseColombianAmount(raw) {
  if (raw == null || raw === '') return null;
  let s = String(raw).trim();
  s = s.replace(/^(COP|\$)\s*/i, '').replace(/\s*(COP|USD)\s*$/i, '');
  s = s.replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
    s = s.replace(/,/g, '');
  } else {
    s = s.replace(/\./g, '').replace(/,/g, '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function formatAmountCandidates(text) {
  const candidates = [];
  const patterns = [
    /(?:COP|\$)\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/gi,
    /([\d]{1,3}(?:\.\d{3})+(?:,\d{1,2})?)\s*(?:COP|pesos)?/gi,
    /([\d]{1,3}(?:,\d{3})+(?:\.\d{2})?)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const amount = parseColombianAmount(m[1] || m[0]);
      if (amount && amount >= 1000 && amount <= 500000000) {
        candidates.push({ amount, index: m.index, raw: m[0] });
      }
    }
  }
  return candidates;
}

function findLabeledValue(text, labels, valuePattern) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    for (const label of labels) {
      if (label.test(line)) {
        const m = line.match(valuePattern);
        if (m) return m[1] || m[0];
        const idx = lines.indexOf(line);
        if (idx >= 0 && idx + 1 < lines.length) {
          const next = lines[idx + 1].match(valuePattern);
          if (next) return next[1] || next[0];
        }
      }
    }
  }
  return null;
}

function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const dmY = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmY) {
    let [, d, mo, y] = dmY;
    const day = parseInt(d, 10);
    const month = parseInt(mo, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (y.length === 2) y = `20${y}`;
    if (y.length !== 4) return null;
    const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (!Number.isNaN(Date.parse(iso))) return iso;
  }
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return isoMatch[0];
  return null;
}

function extractDatesFromText(text) {
  const dates = [];
  const re = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const parsed = parseDate(m[1]);
    if (parsed) dates.push({ iso: parsed, index: m.index });
  }
  return dates;
}

function findDueDate(text) {
  const labeled = findLabeledValue(
    text,
    DATE_LABELS,
    /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})/
  );
  if (labeled) return parseDate(labeled);

  for (const label of DATE_LABELS) {
    const re = new RegExp(`${label.source}[^\\d]{0,20}(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4})`, 'i');
    const m = text.match(re);
    if (m) return parseDate(m[1]);
  }

  const allDates = extractDatesFromText(text).map((d) => d.iso);
  if (allDates.length) {
    const now = Date.now();
    const future = allDates.filter((d) => new Date(d).getTime() >= now - 86400000 * 30);
    return (future.length ? future : allDates).sort().pop();
  }
  return null;
}

function findAmount(text) {
  for (const label of AMOUNT_LABELS) {
    const re = new RegExp(
      `${label.source}[^\\d$]{0,30}((?:COP|\\$)?\\s*[\\d]{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{1,2})?)`,
      'i'
    );
    const m = text.match(re);
    if (m) {
      const amount = parseColombianAmount(m[1]);
      if (amount) return amount;
    }
  }

  const candidates = formatAmountCandidates(text);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.amount - a.amount);
  return candidates[0].amount;
}

function findProvider(text) {
  for (const entry of PROVIDER_PATTERNS) {
    if (entry.pattern.test(text)) {
      return { provider: entry.provider, category: entry.category, title: entry.title, confidence: 0.75 };
    }
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 3 && l.length < 80);
  const firstLine = lines[0];
  if (firstLine && !/factura|invoice|cuenta|estado/i.test(firstLine)) {
    return { provider: firstLine, category: 'otro', title: firstLine, confidence: 0.35 };
  }
  return { provider: 'Proveedor desconocido', category: 'otro', title: 'Factura', confidence: 0.2 };
}

function findInvoiceNumber(text) {
  const labeled = findLabeledValue(text, INVOICE_NUMBER_LABELS, /([A-Z0-9][A-Z0-9\-]{4,24})/i);
  if (labeled && !/^factura$/i.test(labeled.trim())) return labeled.trim();

  const m = text.match(/(?:factura|invoice|ref\.?)\s*(?:no\.?|n[uú]mero)?[#:\s]*([A-Z0-9][A-Z0-9\-]{4,24})/i);
  return m ? m[1].trim() : null;
}

function findTax(text) {
  const m = text.match(/(?:IVA|impuesto)[^\d]{0,20}((?:COP|\$)?\s*[\d.,]+)/i);
  if (m) return parseColombianAmount(m[1]);
  return null;
}

function findCurrency(text, country = 'CO') {
  if (/\bUSD\b|\bd[oó]lares?\b/i.test(text)) return 'USD';
  if (/\bCOP\b|\bpesos?\b/i.test(text)) return 'COP';
  return country === 'CO' ? 'COP' : 'USD';
}

function parseLineItems(text) {
  const items = [];
  const lineRe = /^(.{3,40}?)\s+([\d.,]+)\s*$/gm;
  let m;
  while ((m = lineRe.exec(text)) !== null && items.length < 10) {
    const desc = m[1].trim();
    const amount = parseColombianAmount(m[2]);
    if (amount && !/total|subtotal|iva|impuesto/i.test(desc)) {
      items.push({ description: desc, amount });
    }
  }
  return items;
}

/**
 * Parsea texto OCR en estructura de factura.
 */
function parseFromText(text, { country = 'CO' } = {}) {
  if (!text || !String(text).trim()) {
    return normalizeExtraction({}, { source: 'tesseract', country });
  }

  const normalized = String(text).replace(/\s+/g, ' ').trim();
  const multiline = String(text);

  const providerInfo = findProvider(multiline);
  const amount = findAmount(multiline);
  const dueDate = findDueDate(multiline);
  const invoiceNumber = findInvoiceNumber(multiline);
  const tax = findTax(multiline);
  const currency = findCurrency(multiline, country);
  const lineItems = parseLineItems(multiline);

  const fieldConfidence = {
    provider: providerInfo.confidence,
    amount: amount ? 0.7 : 0.1,
    dueDate: dueDate ? 0.65 : 0.1,
    category: providerInfo.confidence,
    invoiceNumber: invoiceNumber ? 0.6 : 0.1,
  };

  const scores = Object.values(fieldConfidence).filter((v) => v > 0.1);
  const confidence = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0.25;

  return normalizeExtraction(
    {
      provider: providerInfo.provider,
      title: providerInfo.title,
      category: providerInfo.category,
      amount: amount || 0,
      dueDate: dueDate || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      invoice_number: invoiceNumber,
      tax,
      currency,
      line_items: lineItems,
      confidence: Math.min(0.92, confidence),
      fieldConfidence,
      rawText: normalized.slice(0, 8000),
    },
    { source: 'tesseract', country }
  );
}

/**
 * Normaliza salida de cualquier proveedor al esquema común del frontend.
 */
function normalizeExtraction(data, { source = 'unknown', country = 'CO' } = {}) {
  const dueDate = data.dueDate || data.due_date || null;
  const parsedDue = dueDate ? parseDate(dueDate) || dueDate : null;

  return {
    provider: String(data.provider || 'Proveedor').trim(),
    invoice_number: data.invoice_number || data.invoiceNumber || null,
    amount: Number(data.amount) || 0,
    dueDate: parsedDue || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    category: data.category || 'otro',
    title: String(data.title || data.provider || 'Factura').trim(),
    line_items: Array.isArray(data.line_items) ? data.line_items : (data.lineItems || []),
    tax: data.tax != null ? Number(data.tax) : null,
    currency: data.currency || (country === 'CO' ? 'COP' : 'USD'),
    confidence: Math.min(1, Math.max(0, Number(data.confidence) || 0.5)),
    fieldConfidence: data.fieldConfidence || data.field_confidence || {
      provider: 0.5,
      amount: 0.5,
      dueDate: 0.5,
      category: 0.5,
      invoiceNumber: 0.3,
    },
    source,
    note: data.note || null,
    rawText: data.rawText || null,
  };
}

module.exports = {
  parseFromText,
  normalizeExtraction,
  parseColombianAmount,
  findProvider,
  findAmount,
  findDueDate,
};
