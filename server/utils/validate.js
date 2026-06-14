const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_PASSWORD_LEN = 128;
const MAX_NAME_LEN = 120;
const MAX_PHONE_LEN = 20;

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .slice(0, MAX_EMAIL_LEN);
}

function validateEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || !EMAIL_RE.test(normalized)) {
    return { ok: false, error: 'Correo electrónico inválido' };
  }
  return { ok: true, value: normalized };
}

function validatePassword(password, { minLength = 6 } = {}) {
  const value = String(password || '');
  if (value.length < minLength) {
    return { ok: false, error: `La contraseña debe tener al menos ${minLength} caracteres` };
  }
  if (value.length > MAX_PASSWORD_LEN) {
    return { ok: false, error: 'La contraseña es demasiado larga' };
  }
  return { ok: true, value };
}

function validateName(name) {
  const value = String(name || '')
    .trim()
    .slice(0, MAX_NAME_LEN);
  if (value.length < 2) {
    return { ok: false, error: 'El nombre debe tener al menos 2 caracteres' };
  }
  return { ok: true, value };
}

function validatePhone(phone) {
  const value = String(phone || '').trim().slice(0, MAX_PHONE_LEN);
  return { ok: true, value };
}

const ALLOWED_INVOICE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

function validateInvoiceMime(mimeType) {
  const normalized = String(mimeType || '')
    .trim()
    .toLowerCase()
    .split(';')[0];
  if (!ALLOWED_INVOICE_MIMES.has(normalized)) {
    return { ok: false, error: 'Tipo de archivo no permitido. Usa JPEG, PNG, WebP o PDF.' };
  }
  return { ok: true, value: normalized };
}

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validatePhone,
  validateInvoiceMime,
  ALLOWED_INVOICE_MIMES,
};
