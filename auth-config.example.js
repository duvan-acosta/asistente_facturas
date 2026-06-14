/**
 * Copia este archivo como auth-config.js y reemplaza los Client ID
 * con los de OAuth 2.0 en Google Cloud Console.
 *
 * cp auth-config.example.js auth-config.js
 *
 * Necesitas:
 * - GOOGLE_CLIENT_ID: cliente OAuth tipo "Aplicación web" (GIS en navegador/PWA y webClientId en Android)
 * - GOOGLE_ANDROID_CLIENT_ID: (opcional) cliente OAuth tipo "Android" — solo referencia/documentación;
 *   el plugin nativo usa GOOGLE_CLIENT_ID como webClientId + el Android client registrado con SHA-1.
 */
window.AUTH_CONFIG = {
  GOOGLE_CLIENT_ID: 'TU_CLIENT_ID_WEB.apps.googleusercontent.com',
  GOOGLE_ANDROID_CLIENT_ID: 'TU_CLIENT_ID_ANDROID.apps.googleusercontent.com',
};
