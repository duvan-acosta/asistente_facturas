const WEAK_JWT_SECRETS = new Set([
  'vencely-user-demo-secret-change-me',
  'vencely-jwt-change-me',
  'cambia-este-secreto-jwt-en-produccion',
]);

const WEAK_ADMIN_JWT_SECRETS = new Set([
  'vencely-admin-demo-secret-change-me',
  'cambia-este-secreto-admin-en-produccion',
]);

const DEFAULT_ADMIN_PASSWORD = 'admin123';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isWeakSecret(value, weakSet) {
  if (!value || typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (trimmed.length < 32) return true;
  return weakSet.has(trimmed);
}

function assertProductionConfig() {
  if (!isProduction()) return;

  const errors = [];

  if (isWeakSecret(process.env.JWT_SECRET, WEAK_JWT_SECRETS)) {
    errors.push('JWT_SECRET debe ser un valor aleatorio de al menos 32 caracteres');
  }
  if (isWeakSecret(process.env.ADMIN_JWT_SECRET, WEAK_ADMIN_JWT_SECRETS)) {
    errors.push('ADMIN_JWT_SECRET debe ser un valor aleatorio de al menos 32 caracteres');
  }
  if ((process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD) === DEFAULT_ADMIN_PASSWORD) {
    errors.push('ADMIN_PASSWORD no puede ser la contraseña demo (admin123) en producción');
  }

  if (errors.length) {
    throw new Error(`Configuración insegura en producción:\n- ${errors.join('\n- ')}`);
  }
}

function validateCorsOrigins(origins) {
  if (isProduction() && origins.includes('*')) {
    throw new Error('CORS_ORIGINS no puede incluir * en producción');
  }
}

module.exports = {
  isProduction,
  assertProductionConfig,
  validateCorsOrigins,
  DEFAULT_ADMIN_PASSWORD,
};
