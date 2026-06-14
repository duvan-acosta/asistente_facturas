/**
 * Copia este archivo como sync-config.js y ajusta API_BASE_URL.
 *
 * cp sync-config.example.js sync-config.js
 */
window.SYNC_CONFIG = {
  /** URL base del API (sin barra final). Ej: http://localhost:3000 */
  API_BASE_URL: 'http://localhost:3000',

  /** Intervalo de sincronización automática en ms (0 = desactivado) */
  AUTO_SYNC_INTERVAL_MS: 5 * 60 * 1000,

  /** Timeout de peticiones al API en ms */
  REQUEST_TIMEOUT_MS: 15000,
};
