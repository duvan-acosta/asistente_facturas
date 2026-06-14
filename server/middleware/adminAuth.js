const crypto = require('crypto');
const bcrypt = require('bcrypt');

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;
const LEGACY_SALT = '::asistente_facturas_demo';

function getJwtSecret() {
  if (process.env.NODE_ENV === 'production') {
    return process.env.ADMIN_JWT_SECRET;
  }
  return process.env.ADMIN_JWT_SECRET || 'vencely-admin-demo-secret-change-me';
}

function base64UrlEncode(data) {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function signAdminToken(email) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      role: 'admin',
      email,
      iat: Date.now(),
      exp: Date.now() + TOKEN_TTL_MS,
    })
  );
  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${payload}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null;
  const secret = getJwtSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const data = JSON.parse(base64UrlDecode(payload));
    if (data.role !== 'admin' || !data.email) return null;
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function hashAdminPassword(password) {
  return bcrypt.hashSync(String(password || ''), BCRYPT_ROUNDS);
}

function hashAdminPasswordLegacy(password) {
  return crypto.createHash('sha256').update(`${password}${LEGACY_SALT}`).digest('hex');
}

function verifyAdminPassword(plainPassword, storedHash) {
  if (!storedHash || !plainPassword) return false;

  if (String(storedHash).startsWith('$2')) {
    return bcrypt.compareSync(String(plainPassword), storedHash);
  }

  const legacyHash = hashAdminPasswordLegacy(plainPassword);
  if (legacyHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(legacyHash), Buffer.from(storedHash));
}

function extractBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

function requireAdmin(req, res, next) {
  const token = extractBearerToken(req);
  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Acceso administrador no autorizado' });
  }
  req.admin = payload;
  next();
}

module.exports = {
  signAdminToken,
  verifyAdminToken,
  hashAdminPassword,
  verifyAdminPassword,
  requireAdmin,
  extractBearerToken,
};
