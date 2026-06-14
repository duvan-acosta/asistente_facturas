const fs = require('fs');
const path = require('path');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const vars = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function resolveApiBaseUrl(envFileVars = {}) {
  const fromProcess =
    process.env.CLOUD_API_URL ||
    process.env.SYNC_API_URL ||
    process.env.API_BASE_URL ||
    '';
  const fromFile = envFileVars.CLOUD_API_URL || envFileVars.SYNC_API_URL || envFileVars.API_BASE_URL || '';
  return (fromProcess || fromFile).trim().replace(/\/$/, '');
}

function readApiUrlFromSyncConfig(configPath) {
  if (!fs.existsSync(configPath)) return '';
  const content = fs.readFileSync(configPath, 'utf8');
  const match = content.match(/API_BASE_URL:\s*['"]([^'"]+)['"]/);
  if (!match) return '';
  const url = match[1].trim();
  if (!url || url.includes('TU_API')) return '';
  return url.replace(/\/$/, '');
}

function buildSyncConfigContent(apiBaseUrl, source = 'manual') {
  const url = (apiBaseUrl || 'http://localhost:3000').replace(/'/g, "\\'");
  return `/**
 * Configuración de sincronización con la nube.
 * Generado/actualizado por scripts/inject-sync-config.js (${source}).
 *
 * Para desarrollo local: http://localhost:3000
 * Para APK en dispositivo (misma WiFi): http://192.168.x.x:3000
 * Para producción: https://api.tudominio.com
 */
window.SYNC_CONFIG = {
  /** URL base del API (sin barra final) */
  API_BASE_URL: '${url}',

  /** Intervalo de sincronización automática en ms (0 = desactivado) */
  AUTO_SYNC_INTERVAL_MS: ${5 * 60 * 1000},

  /** Timeout de peticiones al API en ms */
  REQUEST_TIMEOUT_MS: 15000,
};
`;
}

function writeSyncConfig(targetPath, apiBaseUrl, source = 'manual') {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buildSyncConfigContent(apiBaseUrl, source), 'utf8');
  console.log(`sync-config.js → API_BASE_URL=${apiBaseUrl || 'http://localhost:3000'}`);
}

function ensureSyncConfig(rootDir) {
  try {
    require('dotenv').config({ path: path.join(rootDir, '.env') });
  } catch {
    // dotenv optional at runtime
  }

  const envFileVars = loadEnvFile(path.join(rootDir, '.env'));
  const targetPath = path.join(rootDir, 'sync-config.js');
  const examplePath = path.join(rootDir, 'sync-config.example.js');
  const envUrl = resolveApiBaseUrl(envFileVars);

  if (!fs.existsSync(targetPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, targetPath);
    console.log('Created sync-config.js from sync-config.example.js');
  }

  if (envUrl) {
    writeSyncConfig(targetPath, envUrl, '.env CLOUD_API_URL/SYNC_API_URL');
    return envUrl;
  }

  const existingUrl = readApiUrlFromSyncConfig(targetPath);
  if (existingUrl) return existingUrl;

  if (!fs.existsSync(targetPath)) {
    writeSyncConfig(targetPath, 'http://localhost:3000', 'default');
  }

  return readApiUrlFromSyncConfig(targetPath) || 'http://localhost:3000';
}

function resolveSyncApiUrl(rootDir) {
  try {
    require('dotenv').config({ path: path.join(rootDir, '.env') });
  } catch {
    // ignore
  }
  const envFileVars = loadEnvFile(path.join(rootDir, '.env'));
  const envUrl = resolveApiBaseUrl(envFileVars);
  if (envUrl) return envUrl;

  const rootConfig = path.join(rootDir, 'sync-config.js');
  const fromRoot = readApiUrlFromSyncConfig(rootConfig);
  if (fromRoot) return fromRoot;

  return 'http://localhost:3000';
}

module.exports = {
  loadEnvFile,
  resolveApiBaseUrl,
  readApiUrlFromSyncConfig,
  buildSyncConfigContent,
  writeSyncConfig,
  ensureSyncConfig,
  resolveSyncApiUrl,
};
