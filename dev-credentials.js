/**
 * Credenciales de demo — SOLO desarrollo (localhost / DEV_MODE).
 * Admin: admin@vencely.app / admin123
 * Cliente: maria@vencely.app / cliente123 (María García)
 */
const DEV_CREDENTIALS = {
  admin: {
    email: 'admin@vencely.app',
    password: 'admin123',
  },
  client: {
    id: 'email_maria_vencely',
    email: 'maria@vencely.app',
    password: 'cliente123',
    name: 'María García',
    phone: '+573001234567',
  },
};

const DEV_AUTH_USERS_KEY = 'asistente_facturas_auth_users';

function isDevEnvironment() {
  if (window.VENCELY_PRODUCTION === true) return false;
  if (window.DEV_MODE === true) return true;
  if (window.DEV_MODE === false) return false;

  const host = location.hostname;
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  if (!isLocalHost) return false;

  // Capacitor WebView también usa hostname localhost; no mostrar en builds nativos.
  if (window.Capacitor?.isNativePlatform?.()) return false;

  return true;
}

async function devHashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${password}::asistente_facturas_demo`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getDevAuthUsers() {
  try {
    const raw = localStorage.getItem(DEV_AUTH_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDevAuthUsers(users) {
  localStorage.setItem(DEV_AUTH_USERS_KEY, JSON.stringify(users));
}

async function seedDemoClientUser() {
  if (!isDevEnvironment()) return;

  const { client } = DEV_CREDENTIALS;
  const users = getDevAuthUsers();
  const existing = users.find((u) => u.email === client.email);

  if (existing) {
    if (!existing.passwordHash) {
      existing.passwordHash = await devHashPassword(client.password);
      existing.name = client.name;
      existing.phone = client.phone;
      saveDevAuthUsers(users);
    }
    return;
  }

  const passwordHash = await devHashPassword(client.password);
  users.push({
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    passwordHash,
    provider: 'email',
    createdAt: new Date().toISOString(),
  });
  saveDevAuthUsers(users);
}

function setFormField(form, name, value) {
  const field = form?.querySelector(`[name="${name}"]`);
  if (field) {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function fillClientLogin() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  if (typeof window.setAuthMode === 'function') {
    window.setAuthMode('login');
  }

  setFormField(form, 'email', DEV_CREDENTIALS.client.email);
  setFormField(form, 'password', DEV_CREDENTIALS.client.password);

  document.getElementById('authCardMain')?.classList.remove('hidden');
  document.getElementById('adminLoginPanel')?.classList.add('hidden');
  form.querySelector('[name="email"]')?.focus();
}

function openAdminAccess() {
  document.getElementById('authScreen')?.classList.remove('hidden');
  document.getElementById('appShell')?.classList.add('hidden');
  document.body.classList.add('auth-active');
  document.body.classList.remove('admin-active');

  if (typeof window.showAdminLoginPanel === 'function') {
    window.showAdminLoginPanel();
  } else {
    document.getElementById('adminLoginPanel')?.classList.remove('hidden');
    document.getElementById('authCardMain')?.classList.add('hidden');
    document.getElementById('googlePhonePrompt')?.classList.add('hidden');
  }

  if (location.hash !== '#admin') {
    location.hash = '#admin';
  }
}

function fillAdminLogin() {
  openAdminAccess();

  const form = document.getElementById('adminLoginForm');
  if (!form) return;

  setFormField(form, 'email', DEV_CREDENTIALS.admin.email);
  setFormField(form, 'password', DEV_CREDENTIALS.admin.password);
  form.querySelector('[name="email"]')?.focus();
}

async function loginAsAdminDev() {
  fillAdminLogin();

  if (typeof window.performAdminLogin !== 'function') {
    document.getElementById('adminLoginForm')?.requestSubmit();
    return;
  }

  try {
    await window.performAdminLogin(DEV_CREDENTIALS.admin.email, DEV_CREDENTIALS.admin.password);
    showDevToast('Sesión admin iniciada');
  } catch (err) {
    showDevToast(err.message || 'No se pudo entrar como admin');
  }
}

async function copyDevCredential(label, text) {
  try {
    await navigator.clipboard.writeText(text);
    showDevToast(`${label} copiado`);
  } catch {
    showDevToast('No se pudo copiar al portapapeles');
  }
}

function showDevToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showDevToast._timer);
  showDevToast._timer = setTimeout(() => toast.classList.add('hidden'), 2200);
}

function renderDevCredentialsPanel() {
  if (!isDevEnvironment()) return;

  const container = document.querySelector('.auth-container');
  if (!container || document.getElementById('devCredentialsPanel')) return;

  const { admin, client } = DEV_CREDENTIALS;

  const panel = document.createElement('aside');
  panel.id = 'devCredentialsPanel';
  panel.className = 'dev-credentials';
  panel.setAttribute('aria-label', 'Acceso rápido de desarrollo');
  panel.innerHTML = `
    <p class="dev-credentials-title">Acceso rápido — solo desarrollo</p>
    <div class="dev-credentials-block">
      <p class="dev-credentials-label">Administrador</p>
      <p class="dev-credentials-value"><code>${admin.email}</code> · <code>${admin.password}</code></p>
      <div class="dev-credentials-actions">
        <button type="button" class="dev-credentials-btn" data-dev-action="login-admin">Entrar como admin</button>
        <button type="button" class="dev-credentials-btn dev-credentials-btn--ghost" data-dev-action="fill-admin">Rellenar admin</button>
        <button type="button" class="dev-credentials-btn dev-credentials-btn--ghost" data-dev-copy="${admin.email}">Copiar correo</button>
      </div>
    </div>
    <div class="dev-credentials-block">
      <p class="dev-credentials-label">Cliente demo (${client.name})</p>
      <p class="dev-credentials-value"><code>${client.email}</code> · <code>${client.password}</code></p>
      <div class="dev-credentials-actions">
        <button type="button" class="dev-credentials-btn" data-dev-action="fill-client">Rellenar login</button>
        <button type="button" class="dev-credentials-btn dev-credentials-btn--ghost" data-dev-copy="${client.email}">Copiar correo</button>
      </div>
    </div>
    <p class="dev-credentials-note">Visible en localhost. No se muestra en producción.</p>
  `;

  container.appendChild(panel);

  panel.querySelector('[data-dev-action="fill-admin"]')?.addEventListener('click', fillAdminLogin);
  panel.querySelector('[data-dev-action="login-admin"]')?.addEventListener('click', loginAsAdminDev);
  panel.querySelector('[data-dev-action="fill-client"]')?.addEventListener('click', fillClientLogin);
  panel.querySelectorAll('[data-dev-copy]').forEach((btn) => {
    btn.addEventListener('click', () => copyDevCredential('Correo', btn.dataset.devCopy));
  });
}

async function initDevCredentials() {
  if (!isDevEnvironment()) return;
  await seedDemoClientUser();
  renderDevCredentialsPanel();
}

window.VencelyDevCredentials = {
  isDevEnvironment,
  DEV_CREDENTIALS,
  seedDemoClientUser,
  fillClientLogin,
  fillAdminLogin,
  loginAsAdminDev,
  openAdminAccess,
};

document.addEventListener('DOMContentLoaded', initDevCredentials);
