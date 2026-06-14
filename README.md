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
                    │   Express + PostgreSQL │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  PostgreSQL (Docker)   │
                    │  cuentas, facturas,    │
                    │  pagos, eventos        │
                    └────────────────────────┘
```

| Capa | Rol |
|------|-----|
| **Cliente (app.js + sync.js)** | Fuente de verdad offline en `localStorage`. Funciona sin conexión. |
| **API (server/)** | Sincroniza cuentas y sedes por usuario. Extrae datos de facturas (imagen/PDF). Auth JWT + admin. |
| **Persistencia** | **PostgreSQL** en Docker (`postgres` service). Facturas en volumen `invoice_uploads`. |

### Cómo funciona la sincronización

1. Tras **iniciar sesión**, la app registra el perfil en `/api/auth/sync-user`.
2. **Pull**: descarga cuentas y sedes del servidor.
3. **Merge**: combina local + remoto con estrategia **última escritura gana** (`updatedAt`).
4. **Push**: sube el resultado fusionado al servidor.
5. Se repite al **añadir/editar** cuentas o sedes, al **volver online**, cada **5 minutos** (configurable) o con el botón **Sincronizar ahora** en Avisos.

Si el API no está disponible, la app sigue funcionando 100 % en modo local.

## Funcionalidades

- **Registro e inicio de sesión** con correo/contraseña o Google (navegador GIS + nativo en APK Android)
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

Edita `.env` si quieres extracción real de facturas con Google Gemini, OpenAI o una API personalizada. Sin claves, el API devuelve datos simulados.

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
| `npm run copy:web` | Copia assets a `www/` (Capacitor) e inyecta `CLOUD_API_URL` |
| `npm run cap:sync` | Sincroniza con proyecto Android |
| `npm run build:apk` | Compila APK con URL del API desde `.env` |
| `npm run build:mobile` | Alias de `build:apk` |

## API — Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servicio y conexión PostgreSQL |
| POST | `/api/auth/register` | Registro `{ email, password, name, phone? }` → JWT |
| POST | `/api/auth/login` | Login `{ email, password }` → JWT |
| POST | `/api/auth/google` | Login Google `{ email, googleId, name, picture }` → JWT |
| GET | `/api/auth/me` | Perfil del usuario (Bearer JWT) |
| POST | `/api/auth/sync-user` | Registrar/actualizar perfil de usuario |
| GET | `/api/sync/accounts?userId=` | Obtener cuentas del usuario |
| POST | `/api/sync/accounts` | Guardar cuentas `{ userId, accounts }` |
| GET | `/api/sync/sedes?userId=` | Obtener sedes del usuario |
| POST | `/api/sync/sedes` | Guardar sedes `{ userId, sedes }` |
| POST | `/api/invoices/extract` | Extraer datos de factura (multipart `file` o JSON `base64`) |
| GET | `/api/payments?userId=` | Historial de pagos del usuario |
| POST | `/api/payments` | Registrar pago `{ userId, accountId, amount, method?, ... }` |

### Endpoints administrador (requieren token Bearer)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/admin/login` | Inicio de sesión admin → JWT (8 h) |
| GET | `/api/admin/stats` | Totales: usuarios, cuentas, sedes, montos pendientes |
| GET | `/api/admin/users` | Lista de usuarios registrados en el servidor |
| GET | `/api/admin/users/:userId/accounts` | Cuentas de un usuario |
| GET | `/api/admin/users/:userId/sedes` | Sedes de un usuario |
| GET | `/api/admin/accounts` | Todas las cuentas (filtros: `status`, `context`, `search`, paginación) |
| GET | `/api/admin/users/:userId/analytics-summary` | Resumen analítico (pagos, facturas, eventos) |
| GET | `/api/admin/sync-log` | Actividad reciente de sincronización |

## Panel administrador

Acceso **separado** del login de usuarios finales. Permite visualizar toda la información sincronizada en el servidor desplegado.

### Cómo entrar

1. Arranca el stack (`npm run dev`) con el API accesible desde `sync-config.js`.
2. En la pantalla de inicio de sesión, pulsa **Acceso administrador** (o abre `#admin`).
3. Credenciales demo por defecto:
   - **Correo:** `admin@vencely.app`
   - **Contraseña:** `admin123`
4. Tras el login verás KPIs, usuarios, cuentas globales y log de sincronización.
5. **Cerrar sesión** devuelve a la app normal (si había sesión de usuario) o a la pantalla de login.

### Variables de entorno

```env
ADMIN_EMAIL=admin@vencely.app
ADMIN_PASSWORD=admin123
ADMIN_JWT_SECRET=cambia-este-secreto-en-produccion
```

Si defines `ADMIN_EMAIL` y/o `ADMIN_PASSWORD` en `.env`, esas credenciales tienen prioridad sobre `vencely.json`. También puedes guardar un admin en `server/data/vencely.json` bajo la clave `admin` con `email` y `passwordHash` (SHA-256 con el mismo salt que la app demo).

> **Seguridad demo:** el token admin es un JWT firmado con HMAC; las rutas `/api/admin/*` (excepto login) exigen `Authorization: Bearer <token>`. En producción usa HTTPS, contraseñas fuertes, rotación de secretos y roles en base de datos.

### Seguridad (producción)

| Área | Qué hacer |
|------|-----------|
| Secretos | Define `JWT_SECRET`, `ADMIN_JWT_SECRET` (≥32 chars aleatorios) y `ADMIN_PASSWORD` fuerte en `.env`. El API **no arranca** en `NODE_ENV=production` con valores demo. |
| Docker | `docker compose` exige esos secretos en `.env`. Postgres no se expone al host. La imagen web usa un stub sin credenciales demo. |
| API | Rutas `/api/sync/*`, `/api/payments` e `/api/invoices/extract` requieren JWT de usuario. Google OAuth exige `idToken` verificado en producción. Rate limit en login. |
| CORS | Configura `CORS_ORIGINS` con tu dominio exacto (sin `*`). |
| Frontend | El JWT de usuario se guarda en `localStorage` (riesgo XSS; mitigado con escape HTML). No hay cookies `httpOnly` en esta SPA. |
| Demo local | `dev-credentials.js` solo en localhost de desarrollo; no va en la imagen Docker de producción. |

Riesgos residuales: tokens en `localStorage`, Google Sign-In sin verificación server-side en modo dev, CSP con `'unsafe-inline'` por Google OAuth.

### Qué datos muestra

- Usuarios registrados en PostgreSQL (sync, login o registro API)
- Cuentas, sedes, pagos e facturas procesadas
- Montos pendientes, vencidas y eventos (`user_events`, `sync_log`)

### Extracción de facturas — pipeline híbrido

Arquitectura en `server/services/invoiceProcessor.js`:

```
[Upload imagen/PDF] → [1. sharp: rotar/redimensionar/contraste]
                   → [2. OCR: Gemini | OpenAI | Tesseract.js | mock]
                   → [3. invoiceParser: heurísticas CO]
                   → [4. PostgreSQL invoices + user_events]
                   → [JSON al frontend → formulario pre-llenado]
```

| Variable | Valores | Comportamiento |
|----------|---------|----------------|
| `INVOICE_PROVIDER` | `auto`, `gemini`, `openai`, `tesseract`, `mock` | Fuerza o elige cadena de fallback |
| `GEMINI_API_KEY` | clave Google AI | Gemini Vision para extracción estructurada (prioridad en `auto`) |
| `GEMINI_MODEL` | p. ej. `gemini-2.0-flash` | Modelo Gemini con visión (default `gemini-2.0-flash`) |
| `OPENAI_API_KEY` | clave OpenAI | Vision API como fallback o alternativa |
| `INVOICE_API_URL` | URL custom | POST `{ file, mimeType, country }` (prioridad en `auto`) |

Cadena **auto** (por defecto): Gemini (si hay `GEMINI_API_KEY`) → OpenAI (si hay clave) → Tesseract + regex colombiano → mock.

### Obtener clave de Google Gemini

1. Entra en [Google AI Studio](https://aistudio.google.com/apikey).
2. Crea un proyecto (o usa uno existente) y pulsa **Create API key**.
3. Copia la clave en `.env` como `GEMINI_API_KEY=...`.
4. Reinicia el API (`npm run server` o `docker compose up -d --build api`).

Ejemplo `.env` para Gemini:

```env
INVOICE_PROVIDER=auto
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.0-flash
```

Respuesta de extracción:

```json
{
  "ok": true,
  "processingStatus": "completed",
  "provider": "mock",
  "invoiceId": 42,
  "extracted": {
    "provider": "Enel Colombia",
    "invoice_number": "ENEL-2026-001234",
    "amount": 92500,
    "dueDate": "2026-06-18",
    "category": "servicios",
    "title": "Energía eléctrica",
    "tax": 14750,
    "currency": "COP",
    "line_items": [{ "description": "Consumo kWh", "amount": 77750 }],
    "confidence": 0.72,
    "fieldConfidence": { "provider": 0.72, "amount": 0.72, "dueDate": 0.68 },
    "source": "mock"
  }
}
```

En la app, al subir foto o PDF:
1. Muestra *"Extrayendo datos de la factura…"*
2. Llama a `POST /api/invoices/extract` (multipart, funciona en Docker/LAN/APK)
3. Rellena nombre, proveedor, monto, vencimiento, categoría y confianza
4. Sin API → mensaje claro + fallback simulado local

## Autenticación y Google Sign-In

La app muestra una pantalla de **inicio de sesión / registro** antes del contenido principal. Puedes:

- **Registrarte con correo**: nombre completo, correo, teléfono (opcional) y contraseña
- **Iniciar sesión** con las mismas credenciales
- **Continuar con Google** en navegador/PWA (Google Identity Services) o en APK Android (plugin nativo)

Tras iniciar sesión con Google, la app guarda `googleId`, `email`, `name` y `picture` en la sesión local y, si el API está configurado, sincroniza el perfil con `/api/auth/sync-user`. El **celular para WhatsApp es opcional**: si falta, se muestra un paso breve para agregarlo u omitirlo.

> **Demo local:** los usuarios y la sesión se guardan en `localStorage`. Las contraseñas usan hash SHA-256 solo para demostración. **En producción** usa autenticación segura en el backend.

### Cómo funciona el login según plataforma

| Plataforma | Método | Client ID usado |
|------------|--------|-----------------|
| **Navegador / PWA** (Chrome móvil o escritorio) | Botón Google Identity Services (GIS) + One Tap opcional en móvil | `GOOGLE_CLIENT_ID` (tipo **Aplicación web**) |
| **APK Android** (Capacitor) | Selector de cuenta Google del dispositivo vía `@capgo/capacitor-social-login` | `GOOGLE_CLIENT_ID` como `webClientId` + cliente **Android** con SHA-1 |

La app detecta automáticamente si corre en Capacitor nativo (`window.Capacitor.isNativePlatform()`) y muestra el botón nativo en lugar del iframe de GIS.

### Configurar Google OAuth (navegador / PWA)

1. Entra en [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**
4. Tipo de aplicación: **Aplicación web**
5. En **Orígenes autorizados de JavaScript**, añade:
   - `http://localhost:8080`
   - `https://tu-dominio.com`
   - `https://localhost` (útil si pruebas GIS dentro del WebView de Capacitor)
6. Copia el **ID de cliente web**
7. `cp auth-config.example.js auth-config.js` y pega el Client ID en `GOOGLE_CLIENT_ID`
8. Reinicia el servidor y recarga la app

> `auth-config.js` está en `.gitignore` — no subas claves reales al repositorio.

### Configurar Google OAuth para APK Android

Necesitas **dos** credenciales OAuth en el mismo proyecto de Google Cloud:

#### 1. Cliente Web (obligatorio)

Igual que arriba. Ese ID va en `GOOGLE_CLIENT_ID` de `auth-config.js`. El plugin nativo lo usa como `webClientId`.

#### 2. Cliente Android (obligatorio para APK)

1. En **Credenciales → Crear credenciales → ID de cliente de OAuth**
2. Tipo: **Android**
3. **Nombre del paquete:** `com.vencely.app`
4. **Huella digital SHA-1:** obtén la del keystore de depuración:

```powershell
cd android
.\gradlew.bat signingReport
```

Busca la variante `debug` y copia el SHA-1 (formato `AA:BB:CC:…`).

5. Crea el cliente y copia su ID en `GOOGLE_ANDROID_CLIENT_ID` de `auth-config.js` (referencia; el login nativo usa principalmente el web client + SHA-1 registrado).

#### 3. Si publicas en Google Play

Añade **otro** cliente Android (o edita el existente) con el SHA-1 de **App signing** que muestra Play Console en **Test and release → Setup → App signing**. Sin el SHA-1 correcto el login falla sin un error claro en la app.

#### 4. Compilar e instalar

```powershell
cp auth-config.example.js auth-config.js
# Edita GOOGLE_CLIENT_ID y GOOGLE_ANDROID_CLIENT_ID

npm install
npm run cap:sync
npm run build:apk
```

Instala `android\app\build\outputs\apk\debug\app-debug.apk` en el dispositivo. Usa un emulador o teléfono con **Google Play Services**.

#### 5. Capacitor — URL y esquema

`capacitor.config.json` usa `androidScheme: "https"` y `hostname: "localhost"`, por lo que el WebView carga `https://localhost`. El login nativo no depende de ese origen; GIS en navegador sí requiere orígenes autorizados en Google Cloud.

### Resumen de archivos de configuración

| Archivo | Contenido |
|---------|-----------|
| `auth-config.js` | `GOOGLE_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID` (local, no commitear) |
| `auth-config.example.js` | Plantilla |
| `capacitor.config.json` | `com.vencely.app`, esquema `https://localhost` |
| `scripts/capacitor-auth-entry.js` | Bridge al plugin `@capgo/capacitor-social-login` |
| `android/.../MainActivity.java` | Callback de Google Sign-In nativo |

### Solución de problemas — Google en Android

| Problema | Solución |
|----------|----------|
| Login Google falla en APK sin mensaje claro | Casi siempre SHA-1 incorrecto. Verifica `signingReport` y Play App Signing |
| Botón Google no aparece en APK | `auth-config.js` debe existir en `www/` (`npm run cap:sync` lo copia si está en la raíz) |
| GIS no carga en Chrome móvil | Añade tu dominio/origen en Google Cloud; desactiva bloqueadores de terceros |
| `capacitor-auth.js` 404 | Ejecuta `npm run copy:web` o `npm run cap:sync` |

## Docker (web + API + PostgreSQL)

> **Requisito:** Docker Desktop debe estar **abierto y en ejecución** (icono de la ballena en la bandeja del sistema). Si `docker compose` falla con *"failed to connect to the docker API"* o *"dockerDesktopLinuxEngine"*, abre **Docker Desktop** desde el menú Inicio y espera a que indique *Engine running*.

> **Conflicto de puertos:** `npm run dev` usa los mismos puertos (8080 web, 3000 API). Detén el dev server (`Ctrl+C` en la terminal) antes de levantar Docker, o cambia los puertos en `docker-compose.yml`.

```bash
cp .env.example .env
# Edita GEMINI_API_KEY, OPENAI_API_KEY, JWT_SECRET, ADMIN_* si lo deseas

docker compose up -d --build
docker compose ps          # postgres, api y web deben estar Up (healthy)
docker compose logs -f api # migraciones y seed al arrancar
```

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Web (nginx) | [http://localhost:8080](http://localhost:8080) | Frontend PWA |
| API (Node) | [http://localhost:3000](http://localhost:3000) | REST + migraciones |
| PostgreSQL | `5432` (interno) | Base de datos persistente |

**Volúmenes Docker:** `postgres_data` (BD), `invoice_uploads` (archivos de facturas).

Al primer arranque con BD vacía se crean automáticamente:
- Admin: `admin@vencely.app` / `admin123`
- Cliente demo: `maria@vencely.app` / `cliente123`

```bash
docker compose down          # detener servicios
docker compose down -v       # ⚠️ borra volúmenes (datos)
```

### Desarrollo local sin Docker (solo API + Postgres)

Levanta PostgreSQL (por ejemplo con Docker solo la BD):

```bash
docker compose up -d postgres
cp .env.example .env
npm install
npm run server
```

O apunta `DATABASE_URL` a tu instancia PostgreSQL existente.

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

#### Requisitos previos

- **Node.js 18+**
- **JDK 17** (Android Gradle Plugin)
- **Android SDK** (Android Studio o command-line tools)
- Variables de entorno `ANDROID_HOME` / `JAVA_HOME` configuradas

#### Configurar URL del API en la nube

La APK embebe la URL del API en `www/sync-config.js` al compilar. Tres formas de configurarla:

**Opción A — variable en `.env` (recomendado para CI/CD y builds repetibles):**

```env
CLOUD_API_URL=https://api.tudominio.com
# o SYNC_API_URL=https://api.tudominio.com
```

**Opción B — editar `sync-config.js` manualmente:**

```bash
cp sync-config.example.js sync-config.js
# Edita API_BASE_URL
```

**Opción C — prueba en LAN (teléfono y PC en la misma WiFi):**

```env
CLOUD_API_URL=http://192.168.1.50:3000
```

> En dispositivo físico, `localhost` apunta al teléfono, no a tu PC. Usa la IP LAN de tu PC o un dominio público.

#### Compilar e instalar APK

```powershell
npm install
cp auth-config.example.js auth-config.js   # Google Sign-In opcional
# Edita .env con CLOUD_API_URL=https://api.tudominio.com

npm run build:apk
```

El script `scripts/build-mobile.js`:

1. Lee `CLOUD_API_URL` / `SYNC_API_URL` de `.env`
2. Genera `sync-config.js` e inyecta la URL en `www/`
3. Ejecuta `cap sync` y compila con Gradle

APK generado: `android\app\build\outputs\apk\debug\app-debug.apk`

Instálalo en el dispositivo y verifica en **Avisos → Sincronización en la nube** que el estado sea «En línea y sincronizado».

#### Login y sync en APK

Con `API_BASE_URL` configurada:

- **Registro / login** van al servidor (`/api/auth/register`, `/api/auth/login`) y guardan JWT en `localStorage`
- **Google Sign-In** nativo llama `/api/auth/google` y obtiene JWT
- **Cuentas y sedes** se sincronizan offline-first: caché local + push/pull al volver online
- El indicador de sync aparece en **Avisos** (en línea / sin conexión / sincronizando / error)

## Despliegue en la nube (VPS + Docker)

Flujo recomendado para producción:

```
┌──────────────┐     HTTPS      ┌─────────────────┐
│  APK Android │ ─────────────► │  API :443/:3000 │
│  (Capacitor) │   Bearer JWT   │  Docker + PG    │
└──────────────┘                └─────────────────┘
```

### 1. Preparar el VPS

```bash
git clone https://github.com/tu-usuario/asistente_facturas.git
cd asistente_facturas
cp .env.example .env
```

Edita `.env`:

```env
# Secreto JWT — obligatorio en producción
JWT_SECRET=genera-un-secreto-largo-y-aleatorio

# CORS: incluye orígenes Capacitor para APK
CORS_ORIGINS=https://tu-dominio.com,https://localhost,capacitor://localhost,http://localhost

POSTGRES_PASSWORD=password-seguro
ADMIN_PASSWORD=password-admin-seguro
GEMINI_API_KEY=AIza...   # recomendado para extracción IA
OPENAI_API_KEY=sk-...    # opcional (fallback)
```

### 2. Levantar servicios

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:3000/api/health
```

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| API | 3000 | REST + PostgreSQL |
| Web (PWA) | 8080 | Frontend nginx (opcional si solo usas APK) |
| PostgreSQL | interno | Base de datos persistente |

### 3. Exponer con HTTPS (recomendado)

Usa un reverse proxy (Caddy, nginx, Traefik) delante del puerto 3000:

```text
api.tudominio.com  →  localhost:3000
```

En producción la APK debe apuntar a `https://api.tudominio.com`, no HTTP.

### 4. Compilar APK apuntando al servidor

En tu PC de desarrollo:

```env
CLOUD_API_URL=https://api.tudominio.com
```

```powershell
npm run build:apk
```

Instala el APK en el teléfono. Regístrate o inicia sesión — los datos se sincronizarán con PostgreSQL en el VPS.

### 5. Prueba local con teléfono (misma WiFi)

Script automático (recomendado):

```powershell
.\scripts\setup-lan.ps1
# Con compilación de APK:
.\scripts\setup-lan.ps1 -BuildApk
```

El script detecta tu IP LAN, actualiza `.env` (`CLOUD_API_URL`, `CORS_ORIGINS`), regenera `sync-config.js` / `www/`, reinicia el API Docker y comprueba `/api/health`.

Manual:

1. Obtén la IP LAN de tu PC: `ipconfig` (Windows) → ej. `192.168.1.50`
2. Firewall Windows — permite TCP 3000 (API) y 8080 (web opcional):

   ```powershell
   New-NetFirewallRule -DisplayName "Vencely API" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   New-NetFirewallRule -DisplayName "Vencely Web" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
   ```

3. En `.env`: `CLOUD_API_URL=http://192.168.1.50:3000` y añade `http://192.168.1.50:8080` a `CORS_ORIGINS`
4. Arranca: `docker compose up -d api postgres` o `npm run dev`
5. Compila: `npm run build:apk` e instala en el teléfono

**Live reload (opción B):** con `npm run dev`, pon en `capacitor.config.json` → `"server": { "url": "http://TU_IP:8080", "cleartext": true }` y ejecuta `npx cap sync android && npx cap run android`.

### Variables clave

| Variable | Dónde | Propósito |
|----------|-------|-----------|
| `CLOUD_API_URL` | `.env` (build APK) | URL inyectada en `sync-config.js` |
| `CORS_ORIGINS` | `.env` (servidor) | Orígenes permitidos incl. Capacitor |
| `JWT_SECRET` | `.env` (servidor) | Firma tokens de usuario |
| `GOOGLE_CLIENT_ID` | `auth-config.js` | Google Sign-In web + APK |


## Estructura del proyecto

| Archivo / carpeta | Descripción |
|-------------------|-------------|
| `index.html` | Interfaz de la app |
| `styles.css` | Estilos mobile-first |
| `app.js` | Lógica de UI, localStorage, extracción de facturas |
| `auth.js` | Registro, login, Google Sign-In (web + nativo Android) |
| `sync.js` | Capa de sincronización local ↔ nube |
| `sync-config.example.js` | Plantilla URL del API |
| `scripts/inject-sync-config.js` | Inyecta `CLOUD_API_URL` en sync-config |
| `scripts/build-mobile.js` | Build APK con config de nube |
| `auth-config.example.js` | Plantilla Google Client ID |
| `server/` | API Express (auth, sync, facturas, pagos) |
| `server/db/` | Conexión PostgreSQL, migraciones SQL, seed |
| `server/services/invoiceProcessor.js` | Pipeline híbrido de extracción (sharp → OCR → parser → BD) |
| `server/services/invoiceParser.js` | Heurísticas colombianas (Enel, Claro, montos, fechas) |
| `server/services/ocr/*.js` | Proveedores Gemini, OpenAI, Tesseract y mock |
| `server/services/db.js` | Capa de datos PostgreSQL |
| `server/routes/admin.js` | API del panel administrador |
| `server/middleware/adminAuth.js` | JWT admin y middleware de protección |
| `server/middleware/userAuth.js` | JWT usuarios (opcional en sync) |
| `admin.js` | UI del panel administrador |
| `.env.example` | Variables del API (PostgreSQL, JWT, Gemini, OpenAI, CORS) |
| `docker-compose.yml` | Orquestación web :8080 + api :3000 + postgres |
| `capacitor.config.json` | Config Capacitor (`com.vencely.app`, `https://localhost`) |
| `android/` | Proyecto nativo Android |

## Solución de problemas

| Problema | Solución |
|----------|----------|
| `sync-config.js` 404 en consola | `cp sync-config.example.js sync-config.js` o ignora si usas el default inline |
| No sincroniza en el móvil | `API_BASE_URL` debe ser accesible desde el teléfono (IP LAN o dominio público) |
| Extracción siempre simulada | Configura `GEMINI_API_KEY`, `OPENAI_API_KEY` o `INVOICE_API_URL` en `.env` y reinicia el API |
| CORS bloqueado | Añade tu origen en `CORS_ORIGINS` del `.env` |
| Puerto 8080/3000 ocupado | Detén `npm run dev` o cambia puertos en `package.json` / `docker-compose.yml` |
| Docker daemon no disponible | Abre Docker Desktop y espera *Engine running*; reinicia Docker Desktop si persiste |
| UI en blanco o scripts 404 | Reconstruye: `docker compose up --build -d` (incluye `admin.js`, `dev-credentials.js`, etc.) |
| `capacitor-auth.js` 404 en APK | Ejecuta `npm run cap:sync` para generar el bundle nativo |
| Docker API sin datos tras reinicio | Verifica volúmenes `postgres_data` e `invoice_uploads` |
| API no conecta a PostgreSQL | Espera healthcheck de `postgres`; revisa `DATABASE_URL` en logs del API |
| Migrar desde JSON antiguo | Importa manualmente desde `server/data/vencely.json` vía sync o script; la BD nueva arranca vacía y se seedea con demo |

## Próximos pasos

- Notificaciones push nativas (Capacitor)
- Notificaciones reales (WhatsApp, correo)
- OCR on-device como fallback sin red
- Dashboard analítico avanzado con datos de `user_events`
