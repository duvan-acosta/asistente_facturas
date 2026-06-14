# Vencely — Asistente de Cuentas por Pagar

App web **híbrida** (local + nube) para registrar y recordar pagos del hogar y la empresa: servicios públicos, telefonía, tarjetas de crédito, créditos bancarios y más.

Optimizada **mobile-first** para Android y navegadores móviles (~80 % de usuarios).

## Arquitectura híbrida

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  App web/PWA    │     │  APK Android    │     │  Otro navegador │
│  (localStorage) │     │  (Capacitor)    │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │ HTTPS / REST
                                 ▼
                    ┌────────────────────────┐
                    │   API Node.js :3000    │
                    │   Express + JSON DB    │
                    └────────────────────────┘
```

| Capa | Rol |
|------|-----|
| **Cliente (app.js + sync.js)** | Fuente de verdad offline en `localStorage`. Funciona sin conexión. |
| **API (server/)** | Sincroniza cuentas y sedes por usuario. Extrae datos de facturas (imagen/PDF). |
| **Persistencia** | JSON en `server/data/` (demo). Escalable a PostgreSQL/SQLite en producción. |

### Cómo funciona la sincronización

1. Tras **iniciar sesión**, la app registra el perfil en `/api/auth/sync-user`.
2. **Pull**: descarga cuentas y sedes del servidor.
3. **Merge**: combina local + remoto con estrategia **última escritura gana** (`updatedAt`).
4. **Push**: sube el resultado fusionado al servidor.
5. Se repite al **añadir/editar** cuentas o sedes, al **volver online**, cada **5 minutos** (configurable) o con el botón **Sincronizar ahora** en Avisos.

Si el API no está disponible, la app sigue funcionando 100 % en modo local.

## Funcionalidades

- **Registro e inicio de sesión** con correo/contraseña o Google (Google Identity Services)
- **Sincronización en la nube** de cuentas y sedes entre dispositivos
- Registro manual, por **foto/factura** (extracción IA o mock), o chat con bot
- Pagos recurrentes y puntuales con fechas y período sin mora
- Recordatorios configurables (WhatsApp, correo, chat en app)
- Dashboard, listado de cuentas y calendario
- Navegación inferior en móvil, barra lateral en escritorio
- PWA instalable en Android
- Preparada para empaquetar con Capacitor (APK)

## Ejecución local (stack completo)

### Requisitos

- Node.js 18+

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno (opcional)

```bash
cp .env.example .env
```

Edita `.env` si quieres extracción real de facturas con OpenAI o una API personalizada. Sin claves, el API devuelve datos simulados.

### 3. Configurar sincronización en el cliente

```bash
cp sync-config.example.js sync-config.js
```

Por defecto apunta a `http://localhost:3000`. En producción cambia `API_BASE_URL` a tu dominio del API.

> `sync-config.js` y `.env` están en `.gitignore` — no subas secretos.

### 4. Arrancar web + API

```bash
npm run dev
```

| Servicio | URL |
|----------|-----|
| App web | [http://localhost:8080](http://localhost:8080) |
| API | [http://localhost:3000](http://localhost:3000) |
| Health check | [http://localhost:3000/api/health](http://localhost:3000/api/health) |

### Scripts npm

| Script | Descripción |
|--------|-------------|
| `npm start` | Solo frontend en puerto 8080 |
| `npm run server` | Solo API en puerto 3000 |
| `npm run dev` | Frontend + API en paralelo |
| `npm run copy:web` | Copia assets a `www/` (Capacitor) |
| `npm run cap:sync` | Sincroniza con proyecto Android |
| `npm run build:apk` | Compila APK de depuración |

## API — Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servicio |
| POST | `/api/auth/sync-user` | Registrar/actualizar perfil de usuario |
| GET | `/api/sync/accounts?userId=` | Obtener cuentas del usuario |
| POST | `/api/sync/accounts` | Guardar cuentas `{ userId, accounts }` |
| GET | `/api/sync/sedes?userId=` | Obtener sedes del usuario |
| POST | `/api/sync/sedes` | Guardar sedes `{ userId, sedes }` |
| POST | `/api/invoices/extract` | Extraer datos de factura (multipart `file` o JSON `base64`) |

### Extracción de facturas — configuración

El proveedor es **pluggable** (`server/services/invoiceExtractor.js`):

| Prioridad | Variable | Comportamiento |
|-----------|----------|----------------|
| 1 | `INVOICE_API_URL` | POST a tu API con `{ file: base64, mimeType, country }` |
| 2 | `OPENAI_API_KEY` | OpenAI Vision (`gpt-4o-mini` por defecto) |
| 3 | *(ninguna)* | Mock estructurado + nota informativa |

Respuesta de extracción:

```json
{
  "ok": true,
  "extracted": {
    "provider": "Enel Colombia",
    "amount": 92500,
    "dueDate": "2026-06-18",
    "category": "servicios",
    "title": "Factura de servicios",
    "confidence": 0.72,
    "source": "mock",
    "note": "Extracción simulada..."
  }
}
```

En la app, al subir foto o PDF:
1. Muestra *"Extrayendo datos de la factura…"*
2. Llama a `POST /api/invoices/extract`
3. Rellena proveedor, monto, vencimiento y categoría
4. Si el API falla → fallback a extracción local simulada

## Autenticación y Google Sign-In

La app muestra una pantalla de **inicio de sesión / registro** antes del contenido principal. Puedes:

- **Registrarte con correo**: nombre completo, correo, teléfono (opcional) y contraseña
- **Iniciar sesión** con las mismas credenciales
- **Continuar con Google** si configuras OAuth (opcional)

> **Demo local:** los usuarios y la sesión se guardan en `localStorage`. Las contraseñas usan hash SHA-256 solo para demostración. **En producción** usa autenticación segura en el backend.

### Configurar Google OAuth (opcional)

1. Entra en [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**
4. Tipo de aplicación: **Aplicación web**
5. En **Orígenes autorizados de JavaScript**, añade:
   - `http://localhost:8080`
   - `https://tu-dominio.com`
6. Copia el **ID de cliente**
7. `cp auth-config.example.js auth-config.js` y pega tu Client ID
8. Reinicia el servidor y recarga la app

## Docker (web + API)

> **Requisito:** Docker Desktop debe estar **abierto y en ejecución**.

```bash
# Opcional: claves para extracción IA
cp .env.example .env
# Edita OPENAI_API_KEY si lo deseas

docker compose up -d --build
```

| Servicio | Puerto |
|----------|--------|
| Web (nginx) | [http://localhost:8080](http://localhost:8080) |
| API (Node) | [http://localhost:3000](http://localhost:3000) |

Los datos del API persisten en el volumen Docker `vencely-data`.

```bash
docker compose down
```

## Uso en móvil y Android

### Navegación móvil

- **Barra inferior**: Inicio, Cuentas, botón **+** (registrar), Calendario y Avisos
- El botón **+** abre un panel inferior con opciones de registro (manual, foto, factura, bot)
- En **Avisos → Sincronización en la nube** ves el estado (en línea / sin conexión / sincronizando) y el botón **Sincronizar ahora**

### Instalar como PWA en Android

1. Sirve la app con HTTPS o en `localhost` (`npm run dev` o Docker)
2. Abre la URL en **Chrome** en tu teléfono Android
3. Menú **⋮** → **Instalar aplicación**
4. Confirma el nombre **Vencely**

### APK con Capacitor

Antes de compilar, configura `sync-config.js` con la URL pública de tu API (no `localhost` si pruebas en dispositivo físico):

```js
window.SYNC_CONFIG = {
  API_BASE_URL: 'https://api.tu-dominio.com',
  AUTO_SYNC_INTERVAL_MS: 5 * 60 * 1000,
};
```

```powershell
npm install
npm run build:apk
```

APK generado: `android\app\build\outputs\apk\debug\app-debug.apk`

## Estructura del proyecto

| Archivo / carpeta | Descripción |
|-------------------|-------------|
| `index.html` | Interfaz de la app |
| `styles.css` | Estilos mobile-first |
| `app.js` | Lógica de UI, localStorage, extracción de facturas |
| `auth.js` | Registro, login, Google Sign-In |
| `sync.js` | Capa de sincronización local ↔ nube |
| `sync-config.example.js` | Plantilla URL del API |
| `auth-config.example.js` | Plantilla Google Client ID |
| `server/` | API Express (auth, sync, facturas) |
| `server/services/invoiceExtractor.js` | Proveedor pluggable de extracción |
| `server/services/db.js` | Persistencia JSON por usuario |
| `.env.example` | Variables del API (OpenAI, CORS, etc.) |
| `docker-compose.yml` | Orquestación web :8080 + api :3000 |
| `capacitor.config.json` | Config Capacitor (`com.vencely.app`) |
| `android/` | Proyecto nativo Android |

## Solución de problemas

| Problema | Solución |
|----------|----------|
| `sync-config.js` 404 en consola | `cp sync-config.example.js sync-config.js` o ignora si usas el default inline |
| No sincroniza en el móvil | `API_BASE_URL` debe ser accesible desde el teléfono (IP LAN o dominio público) |
| Extracción siempre simulada | Configura `OPENAI_API_KEY` o `INVOICE_API_URL` en `.env` y reinicia el API |
| CORS bloqueado | Añade tu origen en `CORS_ORIGINS` del `.env` |
| Puerto 8080/3000 ocupado | Cambia puertos en `package.json` o `docker-compose.yml` |
| Docker API sin datos tras reinicio | Verifica el volumen `vencely-data` |

## Próximos pasos

- Autenticación JWT en el API
- Base de datos PostgreSQL / SQLite en producción
- Notificaciones push nativas (Capacitor)
- Notificaciones reales (WhatsApp, correo)
- OCR on-device como fallback sin red
