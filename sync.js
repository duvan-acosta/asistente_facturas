const SYNC_STORAGE_KEYS = {
  lastSynced: 'asistente_facturas_last_synced',
  syncStatus: 'asistente_facturas_sync_status',
};

const SYNC_CONFIG = window.SYNC_CONFIG || { API_BASE_URL: '', AUTO_SYNC_INTERVAL_MS: 0, REQUEST_TIMEOUT_MS: 15000 };

let syncState = {
  online: navigator.onLine,
  syncing: false,
  lastSynced: null,
  lastError: null,
};

let autoSyncTimer = null;

function getApiBaseUrl() {
  const url = (SYNC_CONFIG.API_BASE_URL || '').trim().replace(/\/$/, '');
  if (!url || url.includes('TU_API')) return '';
  return url;
}

function isSyncEnabled() {
  return Boolean(getApiBaseUrl());
}

function getUserId() {
  if (typeof getCurrentUser === 'function') {
    const user = getCurrentUser();
    return user?.id || user?.email || null;
  }
  return null;
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
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Error HTTP ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function syncUserProfile() {
  const userId = getUserId();
  if (!userId || !isSyncEnabled()) return null;

  const user = getCurrentUser();
  return apiFetch('/api/auth/sync-user', {
    method: 'POST',
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      picture: user.picture,
      googleId: user.googleId,
      provider: user.provider,
    }),
  });
}

async function pullAccounts(userId) {
  const data = await apiFetch(`/api/sync/accounts?userId=${encodeURIComponent(userId)}`);
  return data.accounts || [];
}

async function pullSedes(userId) {
  const data = await apiFetch(`/api/sync/sedes?userId=${encodeURIComponent(userId)}`);
  return data.sedes || [];
}

async function pushAccounts(userId, accounts) {
  return apiFetch('/api/sync/accounts', {
    method: 'POST',
    body: JSON.stringify({ userId, accounts }),
  });
}

async function pushSedes(userId, sedes) {
  return apiFetch('/api/sync/sedes', {
    method: 'POST',
    body: JSON.stringify({ userId, sedes }),
  });
}

function updateSyncUI() {
  const indicator = document.getElementById('syncStatusIndicator');
  const statusText = document.getElementById('syncStatusText');
  const lastSyncedEl = document.getElementById('syncLastSynced');
  const syncBtn = document.getElementById('btnSyncNow');

  if (!indicator || !statusText) return;

  indicator.classList.remove('sync-online', 'sync-offline', 'sync-syncing', 'sync-error');

  if (!isSyncEnabled()) {
    indicator.classList.add('sync-offline');
    statusText.textContent = 'Sincronización no configurada';
    if (lastSyncedEl) lastSyncedEl.textContent = 'Configura sync-config.js para activar la nube';
    if (syncBtn) syncBtn.disabled = true;
    return;
  }

  if (syncState.syncing) {
    indicator.classList.add('sync-syncing');
    statusText.textContent = 'Sincronizando…';
  } else if (!syncState.online) {
    indicator.classList.add('sync-offline');
    statusText.textContent = 'Sin conexión — datos locales';
  } else if (syncState.lastError) {
    indicator.classList.add('sync-error');
    statusText.textContent = `Error: ${syncState.lastError}`;
  } else {
    indicator.classList.add('sync-online');
    statusText.textContent = 'En línea y sincronizado';
  }

  if (lastSyncedEl) {
    if (syncState.lastSynced) {
      const date = new Date(syncState.lastSynced);
      lastSyncedEl.textContent = `Última sync: ${date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}`;
    } else {
      lastSyncedEl.textContent = 'Aún no se ha sincronizado';
    }
  }

  if (syncBtn) syncBtn.disabled = syncState.syncing || !syncState.online;
}

async function performSync({ silent = false } = {}) {
  if (!isSyncEnabled()) {
    updateSyncUI();
    return { ok: false, reason: 'disabled' };
  }

  const userId = getUserId();
  if (!userId) return { ok: false, reason: 'no-user' };

  if (!navigator.onLine) {
    syncState.online = false;
    syncState.lastError = null;
    updateSyncUI();
    if (!silent) showToast?.('Sin conexión. Los datos se guardan localmente.');
    return { ok: false, reason: 'offline' };
  }

  if (syncState.syncing) return { ok: false, reason: 'busy' };

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
      pullAccounts(userId),
      pullSedes(userId),
    ]);

    const mergedAccounts = mergeByLastWrite(localAccounts, remoteAccounts);
    const mergedSedes = mergeByLastWrite(localSedes, remoteSedes);

    if (setLocalAccounts) setLocalAccounts(mergedAccounts, { skipSync: true });
    if (setLocalSedes) setLocalSedes(mergedSedes, { skipSync: true });

    await Promise.all([
      pushAccounts(userId, mergedAccounts),
      pushSedes(userId, mergedSedes),
    ]);

    const now = new Date().toISOString();
    saveLastSynced(now);
    syncState.lastError = null;

    if (!silent) showToast?.('✓ Datos sincronizados con la nube');
    window.VencelyData?.onSyncComplete?.();

    return { ok: true, syncedAt: now };
  } catch (err) {
    console.warn('Sync error:', err);
    syncState.lastError = err.name === 'AbortError' ? 'Tiempo de espera agotado' : err.message;
    if (!silent) showToast?.('No se pudo sincronizar. Sigues trabajando en modo local.');
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

  try {
    const data = await apiFetch('/api/invoices/extract', {
      method: 'POST',
      body: formData,
    });
    return data.extracted || null;
  } catch (err) {
    console.warn('Invoice API unavailable:', err.message);
    return null;
  }
}

function scheduleAutoSync() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  const interval = SYNC_CONFIG.AUTO_SYNC_INTERVAL_MS || 0;
  if (!interval || !isSyncEnabled()) return;

  autoSyncTimer = setInterval(() => {
    if (getUserId() && navigator.onLine) {
      performSync({ silent: true });
    }
  }, interval);
}

function initSync() {
  syncState.lastSynced = loadLastSynced();
  syncState.online = navigator.onLine;

  window.addEventListener('online', () => {
    syncState.online = true;
    syncState.lastError = null;
    updateSyncUI();
    if (getUserId()) performSync({ silent: true });
  });

  window.addEventListener('offline', () => {
    syncState.online = false;
    updateSyncUI();
  });

  document.getElementById('btnSyncNow')?.addEventListener('click', () => {
    performSync({ silent: false });
  });

  updateSyncUI();
  scheduleAutoSync();
}

async function onLoginSync() {
  if (!isSyncEnabled() || !getUserId()) {
    updateSyncUI();
    return;
  }
  await performSync({ silent: true });
}

window.VencelySync = {
  initSync,
  onLoginSync,
  performSync,
  syncUserProfile,
  extractInvoiceFromFile,
  isSyncEnabled,
  getApiBaseUrl,
  updateSyncUI,
};
