const ADMIN_STORAGE_KEY = 'vencely_admin_session';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ADMIN_CONFIG = window.SYNC_CONFIG || { API_BASE_URL: '', REQUEST_TIMEOUT_MS: 15000 };

let adminState = {
  stats: null,
  users: [],
  accounts: [],
  syncLog: [],
  expandedUserId: null,
  userDetails: {},
  loading: false,
};

function getApiBaseUrl() {
  const url = (ADMIN_CONFIG.API_BASE_URL || '').trim().replace(/\/$/, '');
  if (!url || url.includes('TU_API')) return '';
  return url;
}

function isAdminApiEnabled() {
  return Boolean(getApiBaseUrl());
}

function getAdminSession() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAdminSession(session) {
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(session));
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_STORAGE_KEY);
}

function adminShell() {
  return document.getElementById('adminShell');
}

function elAuthScreen() {
  return document.getElementById('authScreen');
}

function elAppShell() {
  return document.getElementById('appShell');
}

function formatCurrency(amount) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: iso.includes('T') ? 'short' : undefined,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusLabel(status) {
  const map = {
    vencido: 'Vencido',
    'por-vencer': 'Por vencer',
    programado: 'Programado',
    pendiente: 'Pendiente',
    pagado: 'Pagado',
    pagada: 'Pagada',
  };
  return map[(status || '').toLowerCase()] || status || '—';
}

function eventTypeLabel(type) {
  const map = {
    user_registered: 'Usuario registrado',
    user_updated: 'Perfil actualizado',
    accounts_synced: 'Cuentas sincronizadas',
    sedes_synced: 'Sedes sincronizadas',
  };
  return map[type] || type || 'Evento';
}

function showAdminError(message) {
  const el = document.getElementById('adminLoginError');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearAdminError() {
  const el = document.getElementById('adminLoginError');
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}

async function adminApiFetch(path, options = {}) {
  const base = getApiBaseUrl();
  if (!base) throw new Error('API no configurada. Revisa sync-config.js');

  const session = getAdminSession();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADMIN_CONFIG.REQUEST_TIMEOUT_MS || 15000);

  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...options.headers,
      },
    });

    if (response.status === 401) {
      clearAdminSession();
      throw new Error('Sesión administrador expirada. Inicia sesión de nuevo.');
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Error HTTP ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function showAdminLoginPanel() {
  document.getElementById('adminLoginPanel')?.classList.remove('hidden');
  document.getElementById('authCardMain')?.classList.add('hidden');
  document.getElementById('googlePhonePrompt')?.classList.add('hidden');
  clearAdminError();
}

function hideAdminLoginPanel() {
  document.getElementById('adminLoginPanel')?.classList.add('hidden');
  document.getElementById('authCardMain')?.classList.remove('hidden');
  clearAdminError();
}

function showAdminShell() {
  elAuthScreen()?.classList.add('hidden');
  elAppShell()?.classList.add('hidden');
  adminShell()?.classList.remove('hidden');
  document.body.classList.add('admin-active');
  document.body.classList.remove('auth-active');
}

function hideAdminShell() {
  adminShell()?.classList.add('hidden');
  document.body.classList.remove('admin-active');
}

async function performAdminLogin(email, password) {
  clearAdminError();

  if (!isAdminApiEnabled()) {
    throw new Error('El API no está configurado. Inicia el servidor y revisa sync-config.js.');
  }

  const normalizedEmail = (email || '').trim().toLowerCase();
  const plainPassword = password || '';

  if (!normalizedEmail || !plainPassword) {
    throw new Error('Ingresa correo y contraseña de administrador.');
  }

  const data = await adminApiFetch('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: normalizedEmail, password: plainPassword }),
  });

  saveAdminSession({
    token: data.token,
    email: data.admin?.email || normalizedEmail,
    loggedInAt: new Date().toISOString(),
  });

  hideAdminLoginPanel();
  showAdminShell();
  location.hash = '#admin';
  await refreshAdminDashboard();
  return data;
}

async function handleAdminLoginSubmit(e) {
  e.preventDefault();
  clearAdminError();

  const form = e.target;
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    await performAdminLogin(email, password);
    form.reset();
  } catch (err) {
    showAdminError(err.message || 'No se pudo iniciar sesión como administrador.');
  } finally {
    btn.disabled = false;
  }
}

function logoutAdmin() {
  clearAdminSession();
  hideAdminShell();
  if (location.hash === '#admin') {
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (typeof getCurrentUser === 'function' && getCurrentUser()) {
    elAppShell()?.classList.remove('hidden');
    document.body.classList.remove('auth-active');
  } else {
    elAuthScreen()?.classList.remove('hidden');
    document.body.classList.add('auth-active');
    hideAdminLoginPanel();
  }
}

function renderAdminKpis(stats) {
  const container = document.getElementById('adminKpis');
  if (!container || !stats) return;

  const cards = [
    { label: 'Usuarios', value: stats.users, icon: '👥', tone: 'aqua' },
    { label: 'Cuentas totales', value: stats.accounts, icon: '📋', tone: 'night' },
    { label: 'Sedes', value: stats.sedes, icon: '🏠', tone: 'deep' },
    { label: 'Monto pendiente', value: formatCurrency(stats.totalPending), icon: '💰', tone: 'coral' },
    { label: 'Vencidas', value: stats.overdueCount, icon: '⚠️', tone: 'amber' },
    { label: 'Eventos sync', value: stats.syncEvents, icon: '🔄', tone: 'paid' },
  ];

  container.innerHTML = cards
    .map(
      (card) => `
    <article class="admin-kpi admin-kpi--${card.tone}">
      <span class="admin-kpi-icon" aria-hidden="true">${card.icon}</span>
      <div>
        <p class="admin-kpi-label">${card.label}</p>
        <p class="admin-kpi-value">${card.value}</p>
      </div>
    </article>`
    )
    .join('');
}

function renderUsersTable(users) {
  const container = document.getElementById('adminUsersTable');
  if (!container) return;

  if (!users.length) {
    container.innerHTML = '<p class="admin-empty">No hay usuarios registrados en el servidor.</p>';
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th></th>
            <th>Usuario</th>
            <th>Correo</th>
            <th>Celular</th>
            <th>Cuentas</th>
            <th>Pendiente</th>
            <th>Última sync</th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map(
              (user) => `
            <tr class="admin-user-row" data-user-id="${escapeHtml(user.id)}">
              <td>
                <button type="button" class="admin-expand-btn" data-expand-user="${escapeHtml(user.id)}" aria-label="Ver detalle">
                  ${adminState.expandedUserId === user.id ? '▼' : '▶'}
                </button>
              </td>
              <td>
                <strong>${escapeHtml(user.name || '—')}</strong>
                <span class="admin-tag">${escapeHtml(user.provider || 'email')}</span>
              </td>
              <td>${escapeHtml(user.email || '—')}</td>
              <td>${escapeHtml(user.phone || '—')}</td>
              <td>${user.accountCount} / ${user.sedeCount} sedes</td>
              <td>${formatCurrency(user.pendingAmount)}</td>
              <td>${formatDate(user.lastSync)}</td>
            </tr>
            ${
              adminState.expandedUserId === user.id
                ? `<tr class="admin-user-detail-row"><td colspan="7">${renderUserDetail(user.id)}</td></tr>`
                : ''
            }`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;

  container.querySelectorAll('[data-expand-user]').forEach((btn) => {
    btn.addEventListener('click', () => toggleUserDetail(btn.dataset.expandUser));
  });
}

function renderUserDetail(userId) {
  const detail = adminState.userDetails[userId];
  if (!detail) {
    return '<p class="admin-loading-inline">Cargando detalle…</p>';
  }

  const accountsHtml = detail.accounts.length
    ? `<ul class="admin-mini-list">${detail.accounts
        .map(
          (acc) =>
            `<li><span>${acc.icon || '📄'} ${acc.title}</span> · ${formatCurrency(acc.amount)} · ${statusLabel(acc.status)} · ${acc.dueDate || '—'}</li>`
        )
        .join('')}</ul>`
    : '<p class="admin-empty-inline">Sin cuentas sincronizadas.</p>';

  const sedesHtml = detail.sedes.length
    ? `<ul class="admin-mini-list">${detail.sedes
        .map((sede) => `<li>${sede.icon || '📍'} ${sede.name}</li>`)
        .join('')}</ul>`
    : '<p class="admin-empty-inline">Sin sedes.</p>';

  return `
    <div class="admin-user-detail">
      <div>
        <h4>Cuentas del usuario</h4>
        ${accountsHtml}
      </div>
      <div>
        <h4>Sedes</h4>
        ${sedesHtml}
      </div>
    </div>`;
}

async function toggleUserDetail(userId) {
  if (adminState.expandedUserId === userId) {
    adminState.expandedUserId = null;
    renderUsersTable(adminState.users);
    return;
  }

  adminState.expandedUserId = userId;
  renderUsersTable(adminState.users);

  if (!adminState.userDetails[userId]) {
    try {
      const [accountsData, sedesData] = await Promise.all([
        adminApiFetch(`/api/admin/users/${encodeURIComponent(userId)}/accounts`),
        adminApiFetch(`/api/admin/users/${encodeURIComponent(userId)}/sedes`),
      ]);
      adminState.userDetails[userId] = {
        accounts: accountsData.accounts || [],
        sedes: sedesData.sedes || [],
      };
    } catch (err) {
      adminState.userDetails[userId] = { accounts: [], sedes: [], error: err.message };
    }
    renderUsersTable(adminState.users);
  }
}

function renderAccountsTable(accounts) {
  const container = document.getElementById('adminAccountsTable');
  if (!container) return;

  if (!accounts.length) {
    container.innerHTML = '<p class="admin-empty">No hay cuentas que coincidan con los filtros.</p>';
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Cuenta</th>
            <th>Usuario</th>
            <th>Proveedor</th>
            <th>Monto</th>
            <th>Vence</th>
            <th>Estado</th>
            <th>Contexto</th>
          </tr>
        </thead>
        <tbody>
          ${accounts
            .map(
              (acc) => `
            <tr>
              <td>${acc.icon || ''} ${acc.title || '—'}</td>
              <td>
                <strong>${acc.userName || '—'}</strong><br />
                <span class="admin-muted">${acc.userEmail || acc.userId}</span>
              </td>
              <td>${acc.provider || '—'}</td>
              <td>${formatCurrency(acc.amount)}</td>
              <td>${acc.dueDate || '—'}</td>
              <td><span class="admin-status admin-status--${(acc.status || '').replace(/\s+/g, '-')}">${statusLabel(acc.status)}</span></td>
              <td>${acc.context || '—'}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

function renderSyncLog(events) {
  const container = document.getElementById('adminSyncLog');
  if (!container) return;

  if (!events.length) {
    container.innerHTML = '<p class="admin-empty">Sin actividad de sincronización registrada.</p>';
    return;
  }

  container.innerHTML = `
    <ul class="admin-sync-log">
      ${events
        .map(
          (evt) => `
        <li>
          <span class="admin-sync-time">${formatDate(evt.at)}</span>
          <strong>${eventTypeLabel(evt.type)}</strong>
          <span class="admin-muted">${evt.email || evt.userId || ''}${evt.count != null ? ` · ${evt.count} ítems` : ''}</span>
        </li>`
        )
        .join('')}
    </ul>`;
}

function setAdminLoading(isLoading) {
  adminState.loading = isLoading;
  document.getElementById('adminRefreshBtn')?.toggleAttribute('disabled', isLoading);
}

async function loadAdminAccounts() {
  const status = document.getElementById('adminFilterStatus')?.value || 'all';
  const context = document.getElementById('adminFilterContext')?.value || 'all';
  const search = document.getElementById('adminAccountSearch')?.value?.trim() || '';
  const params = new URLSearchParams({ limit: '100' });
  if (status !== 'all') params.set('status', status);
  if (context !== 'all') params.set('context', context);
  if (search) params.set('search', search);

  const data = await adminApiFetch(`/api/admin/accounts?${params.toString()}`);
  adminState.accounts = data.accounts || [];
  renderAccountsTable(adminState.accounts);
}

async function refreshAdminDashboard() {
  if (!getAdminSession()) return;
  setAdminLoading(true);

  const statusEl = document.getElementById('adminStatusNote');
  if (statusEl) statusEl.textContent = 'Actualizando datos del sistema…';

  try {
    const [statsData, usersData, syncData] = await Promise.all([
      adminApiFetch('/api/admin/stats'),
      adminApiFetch('/api/admin/users'),
      adminApiFetch('/api/admin/sync-log?limit=30'),
    ]);

    adminState.stats = statsData.stats;
    adminState.users = usersData.users || [];
    adminState.syncLog = syncData.events || [];

    const session = getAdminSession();
    const emailEl = document.getElementById('adminSessionEmail');
    if (emailEl && session) emailEl.textContent = session.email;

    renderAdminKpis(adminState.stats);
    renderUsersTable(adminState.users);
    renderSyncLog(adminState.syncLog);
    await loadAdminAccounts();

    if (statusEl) {
      statusEl.textContent = `Actualizado ${formatDate(adminState.stats.generatedAt)}`;
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message;
    if (err.message.includes('expirada') || err.message.includes('no autorizado')) {
      logoutAdmin();
      showAdminLoginPanel();
      showAdminError(err.message);
      elAuthScreen()?.classList.remove('hidden');
      document.body.classList.add('auth-active');
    }
  } finally {
    setAdminLoading(false);
  }
}

function normalizeAdminPathRoute() {
  const path = location.pathname.replace(/\/$/, '') || '/';
  if (path === '/admin') {
    history.replaceState(null, '', `/${location.search}#admin`);
  }
}

function handleAdminHashRoute() {
  if (location.hash !== '#admin') return;

  if (getAdminSession()) {
    showAdminShell();
    refreshAdminDashboard();
  } else {
    elAuthScreen()?.classList.remove('hidden');
    elAppShell()?.classList.add('hidden');
    document.body.classList.add('auth-active');
    showAdminLoginPanel();
  }
}

function attachAdminListeners() {
  document.getElementById('btnAdminAccess')?.addEventListener('click', () => {
    showAdminLoginPanel();
    location.hash = '#admin';
  });

  document.getElementById('btnAdminBackToUser')?.addEventListener('click', () => {
    hideAdminLoginPanel();
    if (location.hash === '#admin') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  });

  document.getElementById('adminLoginForm')?.addEventListener('submit', handleAdminLoginSubmit);
  document.getElementById('btnAdminLogout')?.addEventListener('click', () => {
    if (confirm('¿Cerrar sesión de administrador?')) logoutAdmin();
  });
  document.getElementById('adminRefreshBtn')?.addEventListener('click', refreshAdminDashboard);

  ['adminFilterStatus', 'adminFilterContext'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => loadAdminAccounts());
  });

  let searchTimer;
  document.getElementById('adminAccountSearch')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadAdminAccounts(), 350);
  });

  window.addEventListener('hashchange', handleAdminHashRoute);
}

function initAdmin() {
  normalizeAdminPathRoute();
  attachAdminListeners();

  if (location.hash === '#admin') {
    handleAdminHashRoute();
  }
}

window.initAdmin = initAdmin;
window.refreshAdminDashboard = refreshAdminDashboard;
window.getAdminSession = getAdminSession;
window.logoutAdmin = logoutAdmin;
window.showAdminLoginPanel = showAdminLoginPanel;
window.performAdminLogin = performAdminLogin;

document.addEventListener('DOMContentLoaded', initAdmin);
