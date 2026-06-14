/**
 * Copia este archivo como sync-config.js y ajusta API_BASE_URL.
 * También puedes definir CLOUD_API_URL o SYNC_API_URL en .env;
 * scripts/ensure-config.js y npm run build:apk lo inyectan automáticamente.
 *
 * cp sync-config.example.js sync-config.js
 */
window.SYNC_CONFIG = {
  /** URL base del API (sin barra final). Ejemplos:
   *  - Desarrollo PC: http://localhost:3000
   *  - APK en teléfono (misma WiFi): http://192.168.1.50:3000
   *  - Producción: https://api.tudominio.com
   */
  API_BASE_URL: 'https://TU_API.tudominio.com',

  /** Intervalo de sincronización automática en ms (0 = desactivado) */
  AUTO_SYNC_INTERVAL_MS: 5 * 60 * 1000,

  /** Espera antes de sincronizar tras cambios locales (ms) */
  SYNC_DEBOUNCE_MS: 2500,

  /** Timeout de peticiones al API en ms */
  REQUEST_TIMEOUT_MS: 15000,

  /** Reintentos automáticos tras error de red */
  SYNC_RETRY_ATTEMPTS: 3,
  SYNC_RETRY_DELAY_MS: 1500,
};
