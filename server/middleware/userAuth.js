const crypto = require('crypto');
const { extractBearerToken } = require('./adminAuth');

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getJwtSecret() {
  if (process.env.NODE_ENV === 'production') {
    return process.env.JWT_SECRET;
  }
  return process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'vencely-user-demo-secret-change-me';
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

function signUserToken(user) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      role: 'user',
      userId: user.id,
      email: user.email,
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

function verifyUserToken(token) {
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
    if (data.role !== 'user' || !data.userId) return null;
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function optionalUser(req, _res, next) {
  const token = extractBearerToken(req);
  const payload = verifyUserToken(token);
  if (payload) {
    req.authUser = payload;
  }
  next();
}

function requireUser(req, res, next) {
  const token = extractBearerToken(req);
  const payload = verifyUserToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesión no autorizada' });
  }
  req.authUser = payload;
  next();
}

function resolveUserId(req) {
  return req.authUser?.userId || null;
}

module.exports = {
  signUserToken,
  verifyUserToken,
  optionalUser,
  requireUser,
  resolveUserId,
  TOKEN_TTL_MS,
};
