const SYNC_STORAGE_KEYS = {
  lastSynced: 'asistente_facturas_last_synced',
  syncStatus: 'asistente_facturas_sync_status',
  apiToken: 'vencely_api_token',
};

const SYNC_CONFIG = window.SYNC_CONFIG || {
  API_BASE_URL: '',
  AUTO_SYNC_INTERVAL_MS: 5 * 60 * 1000,
  REQUEST_TIMEOUT_MS: 15000,
  SYNC_RETRY_ATTEMPTS: 3,
  SYNC_RETRY_DELAY_MS: 1500,
  SYNC_DEBOUNCE_MS: 2500,
};

let syncState = {
  online: navigator.onLine,
  syncing: false,
  lastSynced: null,
  lastError: null,
  authBlocked: false,
};

let autoSyncTimer = null;
let syncRetryTimer = null;
let debouncedSyncTimer = null;

function getApiBaseUrl() {
  const url = (SYNC_CONFIG.API_BASE_URL || '').trim().replace(/\/$/, '');
  if (!url || url.includes('TU_API')) return '';
  return url;
}

function isSyncEnabled() {
  return Boolean(getApiBaseUrl());
}

function getUserIdFromToken() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json);
    return data.userId || null;
  } catch {
    return null;
  }
}

function getUserId() {
  const fromToken = getUserIdFromToken();
  if (fromToken) return fromToken;

  if (typeof getCurrentUser === 'function') {
    const user = getCurrentUser();
    return user?.id || user?.email || null;
  }
  return null;
}

function getAuthToken() {
  try {
    return localStorage.getItem(SYNC_STORAGE_KEYS.apiToken) || '';
  } catch {
    return '';
  }
}

function saveAuthToken(token) {
  if (token) {
    localStorage.setItem(SYNC_STORAGE_KEYS.apiToken, token);
    syncState.authBlocked = false;
    syncState.lastError = null;
  } else {
    localStorage.removeItem(SYNC_STORAGE_KEYS.apiToken);
  }
}

function parseTokenPayload(token) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const data = parseTokenPayload(token || getAuthToken());
  if (!data?.exp) return false;
  return Date.now() >= data.exp;
}

function markLocalSessionOnly(message) {
  syncState.authBlocked = true;
  syncState.lastError =
    message || 'Inicia sesión de nuevo para activar la sincronización en la nube';
  updateSyncUI();
}

async function ensureAuthForSync() {
  if (!isSyncEnabled()) return { ok: false, reason: 'disabled' };

  const userId = getUserId();
  if (!userId) return { ok: false, reason: 'no-user' };

  const token = getAuthToken();
  if (!token) {
    markLocalSessionOnly();
    return {
      ok: false,
      reason: 'local-session',
      message: syncState.lastError,
    };
  }

  if (isTokenExpired(token)) {
    saveAuthToken('');
    markLocalSessionOnly('Sesión expirada — inicia sesión de nuevo');
    return {
      ok: false,
      reason: 'expired',
      message: syncState.lastError,
    };
  }

  syncState.authBlocked = false;
  return { ok: true };
}

function loadLastSynced() {
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEYS.lastSynced);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastSynced(iso) {
  localStorage.setItem(SYNC_STORAGE_KEYS.lastSynced, JSON.stringify(iso));
  syncState.lastSynced = iso;
}

function withUpdatedAt(items) {
  const now = new Date().toISOString();
  return (items || []).map((item) => ({
    ...item,
    updatedAt: item.updatedAt || now,
  }));
}

function mergeByLastWrite(localItems, remoteItems) {
  const map = new Map();

  [...(remoteItems || []), ...(localItems || [])].forEach((item) => {
    if (!item?.id) return;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      return;
    }
    const existingTime = new Date(existing.updatedAt || 0).getTime();
    const itemTime = new Date(item.updatedAt || 0).getTime();
    map.set(item.id, itemTime >= existingTime ? item : existing);
  });

  return Array.from(map.values());
}

async function apiFetch(path, options = {}) {
  const base = getApiBaseUrl();
  if (!base) throw new Error('API no configurada');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYNC_CONFIG.REQUEST_TIMEOUT_MS || 15000);

  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const error = new Error(errBody.error || `Error HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function sessionFromApiUser(user, provider) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    picture: user.picture || '',
    googleId: user.googleId || '',
    provider: provider || user.provider || 'email',
    country: user.country || 'CO',
    currency: user.currency || 'COP',
    loggedInAt: new Date().toISOString(),
  };
}

function applyAuthResponse(data, provider) {
  if (data?.token) saveAuthToken(data.token);
  if (data?.user && typeof window.saveSession === 'function') {
    window.saveSession(sessionFromApiUser(data.user, provider));
  }
  return data;
}

async function syncUserProfile() {
  const userId = getUserId();
  if (!userId || !isSyncEnabled()) return null;

  const user = getCurrentUser();
  const data = await apiFetch('/api/auth/sync-user', {
    method: 'POST',
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      picture: user.picture,
      googleId: user.googleId,
      provider: user.provider,
      country: user.country || 'CO',
      currency: user.currency || 'COP',
      appVersion: window.VencelyApp?.version || undefined,
      locale: navigator.language || 'es-CO',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
    }),
  });
  if (data.token) saveAuthToken(data.token);
  if (data.user && typeof window.saveSession === 'function') {
    window.saveSession(sessionFromApiUser(data.user, user.provider));
  }
  return data;
}

async function apiLogin(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return applyAuthResponse(data, 'email');
}

async function apiRegister({ email, password, name, phone }) {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, phone }),
  });
  return applyAuthResponse(data, 'email');
}

async function apiGoogleLogin({ email, googleId, name, picture, phone, idToken }) {
  const data = await apiFetch('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ email, googleId, name, picture, phone, idToken }),
  });
  return applyAuthResponse(data, 'google');
}

async function apiMe() {
  return apiFetch('/api/auth/me');
}

async function pullAccounts() {
  const data = await apiFetch('/api/sync/accounts');
  return data.accounts || [];
}

async function pullSedes() {
  const data = await apiFetch('/api/sync/sedes');
  return data.sedes || [];
}

async function pushAccounts(accounts) {
  return apiFetch('/api/sync/accounts', {
    method: 'POST',
    body: JSON.stringify({ accounts }),
  });
}

async function pushSedes(sedes) {
  return apiFetch('/api/sync/sedes', {
    method: 'POST',
    body: JSON.stringify({ sedes }),
  });
}

function updateSyncUI() {
  const indicator = document.getElementById('syncStatusIndicator');
  const statusText = document.getElementById('syncStatusText');
  const lastSyncedEl = document.getElementById('syncLastSynced');
  const syncBtn = document.getElementById('btnSyncNow');
  const profileIndicator = document.getElementById('profileSyncIndicator');
  const profileStatusText = document.getElementById('profileSyncText');
  const profileLastSyncedEl = document.getElementById('profileLastSynced');
  const profileSyncBtn = document.getElementById('btnProfileSyncNow');

  if (!indicator || !statusText) return;

  const indicators = [indicator, profileIndicator].filter(Boolean);
  const statusTexts = [statusText, profileStatusText].filter(Boolean);
  const lastSyncedEls = [lastSyncedEl, profileLastSyncedEl].filter(Boolean);
  const syncBtns = [syncBtn, profileSyncBtn].filter(Boolean);

  indicators.forEach((el) => {
    el.classList.remove('sync-online', 'sync-offline', 'sync-syncing', 'sync-error');
  });

  let statusMessage = '';
  let lastSyncedMessage = '';
  let disabled = false;
  let indicatorClass = 'sync-offline';

  if (!isSyncEnabled()) {
    indicatorClass = 'sync-offline';
    statusMessage = 'Sincronización no configurada';
    lastSyncedMessage = 'Configura sync-config.js o API_BASE_URL para activar la nube';
    disabled = true;
  } else if (syncState.syncing) {
    indicatorClass = 'sync-syncing';
    statusMessage = 'Sincronizando…';
  } else if (!syncState.online) {
    indicatorClass = 'sync-offline';
    statusMessage = 'Sin conexión';
    lastSyncedMessage = 'Los cambios se guardan localmente y se sincronizarán al reconectar';
  } else if (syncState.authBlocked || syncState.lastError) {
    indicatorClass = 'sync-error';
    statusMessage = syncState.authBlocked
      ? syncState.lastError
      : `Error: ${syncState.lastError}`;
    lastSyncedMessage = syncRetryTimer
      ? 'Reintentando automáticamente…'
      : 'Se reintentará cuando haya conexión';
  } else {
    indicatorClass = 'sync-online';
    statusMessage = 'Sincronizado';
  }

  if (isSyncEnabled()) {
    if (!lastSyncedMessage) {
      if (syncState.lastSynced) {
        const date = new Date(syncState.lastSynced);
        lastSyncedMessage = `Última sync: ${date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}`;
      } else if (!syncState.syncing && syncState.online && !syncState.lastError) {
        lastSyncedMessage = 'Sincronización automática activa';
      } else if (!syncState.lastSynced && syncState.online && !syncState.authBlocked) {
        lastSyncedMessage = 'Pendiente de primera sincronización';
      }
    }
    disabled = syncState.syncing || !syncState.online || syncState.authBlocked;
  }

  indicators.forEach((el) => el.classList.add(indicatorClass));
  statusTexts.forEach((el) => { el.textContent = statusMessage; });
  lastSyncedEls.forEach((el) => { el.textContent = lastSyncedMessage; });
  syncBtns.forEach((btn) => { btn.disabled = disabled; });
}

function scheduleSyncRetry() {
  if (syncRetryTimer || !isSyncEnabled() || !getUserId() || syncState.authBlocked) return;
  const delay = SYNC_CONFIG.SYNC_RETRY_DELAY_MS || 1500;
  syncRetryTimer = setTimeout(() => {
    syncRetryTimer = null;
    updateSyncUI();
    if (navigator.onLine && getUserId() && getAuthToken() && !isTokenExpired()) {
      performSync({ silent: true });
    }
  }, delay);
  updateSyncUI();
}

function scheduleDebouncedSync() {
  if (!isSyncEnabled() || syncState.authBlocked) return;
  if (debouncedSyncTimer) clearTimeout(debouncedSyncTimer);
  const delay = SYNC_CONFIG.SYNC_DEBOUNCE_MS || 2500;
  debouncedSyncTimer = setTimeout(() => {
    debouncedSyncTimer = null;
    if (navigator.onLine && getUserId()) {
      performSync({ silent: true });
    }
  }, delay);
}

async function performSync({ silent = false, attempt = 1, force = false } = {}) {
  if (!isSyncEnabled()) {
    updateSyncUI();
    return { ok: false, reason: 'disabled' };
  }

  if (!navigator.onLine) {
    syncState.online = false;
    if (!syncState.authBlocked) syncState.lastError = null;
    updateSyncUI();
    if (!silent) showToast?.('Sin conexión. Los datos se guardan localmente.');
    return { ok: false, reason: 'offline' };
  }

  if (syncState.syncing) return { ok: false, reason: 'busy' };

  const authCheck = await ensureAuthForSync();
  if (!authCheck.ok) {
    updateSyncUI();
    if (!silent && authCheck.message) showToast?.(authCheck.message);
    return authCheck;
  }

  syncState.syncing = true;
  syncState.online = true;
  syncState.lastError = null;
  updateSyncUI();

  try {
    await syncUserProfile();

    const getLocalAccounts = window.VencelyData?.getAccounts || (() => []);
    const getLocalSedes = window.VencelyData?.getSedes || (() => []);
    const setLocalAccounts = window.VencelyData?.setAccounts;
    const setLocalSedes = window.VencelyData?.setSedes;

    const localAccounts = withUpdatedAt(getLocalAccounts());
    const localSedes = withUpdatedAt(getLocalSedes());

    const [remoteAccounts, remoteSedes] = await Promise.all([
      pullAccounts(),
      pullSedes(),
    ]);

    const mergedAccounts = mergeByLastWrite(localAccounts, remoteAccounts);
    const mergedSedes = mergeByLastWrite(localSedes, remoteSedes);

    if (setLocalAccounts) setLocalAccounts(mergedAccounts, { skipSync: true });
    if (setLocalSedes) setLocalSedes(mergedSedes, { skipSync: true });

    await Promise.all([
      pushAccounts(mergedAccounts),
      pushSedes(mergedSedes),
    ]);

    const now = new Date().toISOString();
    saveLastSynced(now);
    syncState.lastError = null;

    if (!silent) showToast?.('✓ Datos sincronizados con la nube');
    window.VencelyData?.onSyncComplete?.();
    registerBackgroundSync();

    return { ok: true, syncedAt: now };
  } catch (err) {
    console.warn('Sync error:', err);

    if (err.status === 401 || err.message === 'Sesión no autorizada') {
      saveAuthToken('');
      markLocalSessionOnly('Sesión no autorizada — inicia sesión de nuevo');
      if (!silent) showToast?.(syncState.lastError);
      return { ok: false, reason: 'unauthorized', error: err };
    }

    syncState.lastError = err.name === 'AbortError' ? 'Tiempo de espera agotado' : err.message;

    const maxAttempts = SYNC_CONFIG.SYNC_RETRY_ATTEMPTS || 3;
    if (attempt < maxAttempts && navigator.onLine && !syncState.authBlocked) {
      const backoff = (SYNC_CONFIG.SYNC_RETRY_DELAY_MS || 1500) * attempt;
      await new Promise((r) => setTimeout(r, backoff));
      syncState.syncing = false;
      return performSync({ silent: true, attempt: attempt + 1, force });
    }

    if (!silent) showToast?.('No se pudo sincronizar. Sigues trabajando en modo local.');
    scheduleSyncRetry();
    return { ok: false, reason: 'error', error: err };
  } finally {
    syncState.syncing = false;
    updateSyncUI();
  }
}

async function extractInvoiceFromFile(file, country = 'CO') {
  const base = getApiBaseUrl();
  if (!base || !navigator.onLine) return null;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('country', country);
  const userId = getUserId();
  if (userId) formData.append('userId', userId);

  try {
    const data = await apiFetch('/api/invoices/extract', {
      method: 'POST',
      body: formData,
    });
    return {
      extracted: data.extracted || null,
      invoiceId: data.invoiceId,
      processingStatus: data.processingStatus,
      provider: data.provider,
    };
  } catch (err) {
    console.warn('Invoice API unavailable:', err.message);
    return null;
  }
}

function scheduleAutoSync() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  const interval = SYNC_CONFIG.AUTO_SYNC_INTERVAL_MS ?? 5 * 60 * 1000;
  if (!interval || !isSyncEnabled()) return;

  autoSyncTimer = setInterval(() => {
    if (
      document.visibilityState === 'visible' &&
      getUserId() &&
      getAuthToken() &&
      !isTokenExpired() &&
      navigator.onLine
    ) {
      performSync({ silent: true });
    }
  }, interval);
}

async function registerBackgroundSync() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  if (!isSyncEnabled() || !getAuthToken()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('vencely-sync');
  } catch {
    // Background Sync no disponible en este navegador
  }
}

function initSync() {
  syncState.lastSynced = loadLastSynced();
  syncState.online = navigator.onLine;

  window.addEventListener('online', () => {
    syncState.online = true;
    if (!syncState.authBlocked) syncState.lastError = null;
    updateSyncUI();
    if (getUserId() && getAuthToken()) performSync({ silent: true });
  });

  window.addEventListener('offline', () => {
    syncState.online = false;
    updateSyncUI();
  });

  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'visible' &&
      getUserId() &&
      getAuthToken() &&
      !isTokenExpired() &&
      navigator.onLine
    ) {
      performSync({ silent: true });
    }
  });

  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'SYNC_REQUEST' && getUserId() && getAuthToken()) {
      performSync({ silent: true });
    }
  });

  const bindForceSync = (btn) => {
    btn?.addEventListener('click', () => {
      performSync({ silent: false, force: true });
    });
  };
  bindForceSync(document.getElementById('btnSyncNow'));
  bindForceSync(document.getElementById('btnProfileSyncNow'));

  updateSyncUI();
  scheduleAutoSync();
}

async function onLoginSync() {
  if (!isSyncEnabled() || !getUserId()) {
    updateSyncUI();
    return;
  }
  if (!getAuthToken()) {
    markLocalSessionOnly();
    return;
  }
  const result = await performSync({ silent: true });
  if (result.ok) registerBackgroundSync();
}

window.VencelySync = {
  initSync,
  onLoginSync,
  performSync,
  scheduleDebouncedSync,
  syncUserProfile,
  apiLogin,
  apiRegister,
  apiGoogleLogin,
  apiMe,
  extractInvoiceFromFile,
  isSyncEnabled,
  getApiBaseUrl,
  getAuthToken,
  saveAuthToken,
  markLocalSessionOnly,
  updateSyncUI,
  getUserId,
  isTokenExpired,
};
