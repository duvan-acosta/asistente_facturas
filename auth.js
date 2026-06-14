const AUTH_STORAGE_KEYS = {
  session: 'asistente_facturas_session',
  users: 'asistente_facturas_auth_users',
};

const AUTH_CONFIG = window.AUTH_CONFIG || { GOOGLE_CLIENT_ID: '' };

let authMode = 'login';

const authScreen = () => document.getElementById('authScreen');
const appShell = () => document.getElementById('appShell');

function isGoogleConfigured() {
  const id = AUTH_CONFIG.GOOGLE_CLIENT_ID || '';
  return id.length > 0 && !id.includes('TU_CLIENT_ID');
}

function getAuthUsers() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.users);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAuthUsers(users) {
  localStorage.setItem(AUTH_STORAGE_KEYS.users, JSON.stringify(users));
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.session);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(user) {
  localStorage.setItem(AUTH_STORAGE_KEYS.session, JSON.stringify(user));
}

function logout() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.session);
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
  showAuthScreen();
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shortName(name) {
  if (!name) return 'Usuario';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${password}::asistente_facturas_demo`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseGoogleJwt(token) {
  const payload = token.split('.')[1];
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(json);
}

function showAuthError(message) {
  const el = document.getElementById('authError');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearAuthError() {
  const el = document.getElementById('authError');
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}

function setAuthMode(mode) {
  authMode = mode;
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const switchText = document.getElementById('authSwitchText');
  const switchBtn = document.getElementById('authSwitchBtn');

  const isLogin = mode === 'login';
  loginForm?.classList.toggle('hidden', !isLogin);
  registerForm?.classList.toggle('hidden', isLogin);

  if (authTitle) authTitle.textContent = isLogin ? 'Iniciar sesión' : 'Crear cuenta';
  if (authSubtitle) {
    authSubtitle.textContent = isLogin
      ? 'Accede para gestionar tus cuentas por pagar'
      : 'Regístrate con tu correo o con Google';
  }
  if (switchText) {
    switchText.textContent = isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?';
  }
  if (switchBtn) {
    switchBtn.textContent = isLogin ? 'Regístrate' : 'Inicia sesión';
  }
  clearAuthError();
}

function showAuthScreen() {
  authScreen()?.classList.remove('hidden');
  appShell()?.classList.add('hidden');
  document.body.classList.add('auth-active');
  setAuthMode('login');
  setupGoogleSignIn();
}

function hideAuthScreen() {
  authScreen()?.classList.add('hidden');
  appShell()?.classList.remove('hidden');
  document.body.classList.remove('auth-active');
  updateUserProfileUI();
  if (typeof window.onAuthSuccess === 'function') {
    window.onAuthSuccess();
  }
}

function createSessionFromUser(user, provider) {
  const session = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    picture: user.picture || '',
    googleId: user.googleId || '',
    provider: provider || user.provider || 'email',
    loggedInAt: new Date().toISOString(),
  };
  saveSession(session);
  hideAuthScreen();
}

function updateUserProfileUI() {
  const user = getCurrentUser();
  if (!user) return;

  const avatar = document.getElementById('profileAvatar');
  const nameEl = document.getElementById('profileName');
  const welcome = document.getElementById('welcomeMessage');
  const emailMeta = document.getElementById('settingsUserEmail');
  const phoneMeta = document.getElementById('settingsUserPhone');
  const phoneInput = document.getElementById('whatsappPhoneInput');
  const accountName = document.getElementById('settingsAccountName');

  const firstName = user.name?.split(/\s+/)[0] || 'Usuario';

  if (welcome) welcome.textContent = `Hola, ${firstName}`;
  if (nameEl) nameEl.textContent = shortName(user.name);
  if (emailMeta) emailMeta.textContent = user.email;
  if (phoneMeta) {
    phoneMeta.textContent = user.phone
      ? `Activo: ${formatPhoneDisplay(user.phone)}`
      : 'Sin celular — agrega tu número para recibir WhatsApp';
  }
  if (phoneInput && document.activeElement !== phoneInput) {
    phoneInput.value = user.phone ? formatPhoneDisplay(user.phone) : '';
  }
  if (accountName) accountName.textContent = user.name;

  if (avatar) {
    if (user.picture) {
      avatar.innerHTML = `<img src="${user.picture}" alt="" class="profile-avatar-img" referrerpolicy="no-referrer" />`;
    } else {
      avatar.textContent = getInitials(user.name);
    }
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhoneInput(phone) {
  return (phone || '').replace(/[\s\-().]/g, '');
}

function validatePhone(phone) {
  const cleaned = normalizePhoneInput(phone);
  if (!cleaned) {
    return { valid: false, error: 'Ingresa tu número de celular para WhatsApp.' };
  }

  const withoutPlus = cleaned.replace(/^\+/, '');

  if (/^57[3][0-9]{9}$/.test(withoutPlus)) {
    return { valid: true, normalized: `+57${withoutPlus.slice(2)}` };
  }
  if (/^3[0-9]{9}$/.test(withoutPlus)) {
    return { valid: true, normalized: `+57${withoutPlus}` };
  }
  if (/^[1-9][0-9]{9,14}$/.test(withoutPlus)) {
    return { valid: true, normalized: `+${withoutPlus}` };
  }

  return {
    valid: false,
    error: 'Número inválido. Usa 10 dígitos (ej. 3001234567) o formato internacional +57…',
  };
}

function formatPhoneDisplay(phone) {
  if (!phone) return 'Sin celular configurado';
  const result = validatePhone(phone);
  const normalized = result.valid ? result.normalized : phone;
  const match = normalized.match(/^(\+57)(\d{3})(\d{3})(\d{4})$/);
  if (match) return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
  return normalized;
}

function updateUserPhone(phone) {
  const result = validatePhone(phone);
  if (!result.valid) return { ok: false, error: result.error };

  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'No hay sesión activa.' };

  user.phone = result.normalized;
  saveSession(user);

  const users = getAuthUsers();
  const idx = users.findIndex((u) => u.id === user.id || u.email === user.email);
  if (idx >= 0) {
    users[idx].phone = result.normalized;
    saveAuthUsers(users);
  }

  updateUserProfileUI();

  if (window.VencelySync?.isSyncEnabled?.()) {
    window.VencelySync.syncUserProfile?.().catch(() => {});
  }

  return { ok: true, phone: result.normalized };
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  clearAuthError();

  const form = e.target;
  const name = form.name.value.trim();
  const email = form.email.value.trim().toLowerCase();
  const phone = form.phone.value.trim();
  const password = form.password.value;
  const confirm = form.confirmPassword.value;

  if (name.length < 2) {
    showAuthError('El nombre completo debe tener al menos 2 caracteres.');
    return;
  }
  if (!validateEmail(email)) {
    showAuthError('Ingresa un correo electrónico válido.');
    return;
  }
  if (password.length < 6) {
    showAuthError('La contraseña debe tener al menos 6 caracteres.');
    return;
  }
  if (password !== confirm) {
    showAuthError('Las contraseñas no coinciden.');
    return;
  }

  const phoneResult = validatePhone(phone);
  if (!phoneResult.valid) {
    showAuthError(phoneResult.error);
    return;
  }

  const users = getAuthUsers();
  if (users.some((u) => u.email === email)) {
    showAuthError('Ya existe una cuenta con este correo. Inicia sesión.');
    return;
  }

  const passwordHash = await hashPassword(password);
  const newUser = {
    id: `email_${Date.now().toString(36)}`,
    name,
    email,
    phone: phoneResult.normalized,
    passwordHash,
    provider: 'email',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveAuthUsers(users);
  createSessionFromUser(newUser, 'email');
  form.reset();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  clearAuthError();

  const form = e.target;
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;

  if (!validateEmail(email)) {
    showAuthError('Ingresa un correo electrónico válido.');
    return;
  }
  if (!password) {
    showAuthError('Ingresa tu contraseña.');
    return;
  }

  const users = getAuthUsers();
  const user = users.find((u) => u.email === email);

  if (!user) {
    showAuthError('No encontramos una cuenta con este correo.');
    return;
  }

  const passwordHash = await hashPassword(password);
  if (user.passwordHash !== passwordHash) {
    showAuthError('Contraseña incorrecta.');
    return;
  }

  createSessionFromUser(user, 'email');
  form.reset();
}

function handleGoogleCredential(response) {
  clearAuthError();
  try {
    const payload = parseGoogleJwt(response.credential);
    const email = (payload.email || '').toLowerCase();
    const googleId = payload.sub;
    const name = payload.name || email.split('@')[0];
    const picture = payload.picture || '';

    if (!email) {
      showAuthError('No se pudo obtener el correo de Google.');
      return;
    }

    const users = getAuthUsers();
    let user = users.find((u) => u.googleId === googleId || u.email === email);

    if (!user) {
      user = {
        id: `google_${googleId}`,
        name,
        email,
        phone: '',
        googleId,
        picture,
        provider: 'google',
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      saveAuthUsers(users);
    } else {
      user.name = name;
      user.picture = picture;
      user.googleId = googleId;
      user.provider = 'google';
      saveAuthUsers(users);
    }

    createSessionFromUser(user, 'google');
  } catch (err) {
    console.error('Error al procesar credencial de Google:', err);
    showAuthError('No se pudo completar el inicio con Google. Intenta de nuevo.');
  }
}

function setupGoogleSignIn() {
  const container = document.getElementById('googleSignInContainer');
  const notice = document.getElementById('googleConfigNotice');
  if (!container || !notice) return;

  container.innerHTML = '';
  notice.classList.add('hidden');

  if (!isGoogleConfigured()) {
    notice.classList.remove('hidden');
    return;
  }

  if (!window.google?.accounts?.id) {
    notice.textContent = 'Cargando Google Sign-In…';
    notice.classList.remove('hidden');
    return;
  }

  window.google.accounts.id.initialize({
    client_id: AUTH_CONFIG.GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
    locale: 'es',
  });

  const width = Math.min(container.offsetWidth || container.parentElement?.offsetWidth || 320, 400);
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width: width > 200 ? width : 320,
    locale: 'es',
  });
}

function attachAuthListeners() {
  document.getElementById('authSwitchBtn')?.addEventListener('click', () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  });

  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegisterSubmit);
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) logout();
  });
}

function initAuth() {
  attachAuthListeners();

  if (getCurrentUser()) {
    hideAuthScreen();
  } else {
    showAuthScreen();
  }

  if (isGoogleConfigured()) {
    const checkGoogle = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkGoogle);
        if (!getCurrentUser()) setupGoogleSignIn();
      }
    }, 200);
    setTimeout(() => clearInterval(checkGoogle), 10000);
  }
}

window.getCurrentUser = getCurrentUser;
window.logout = logout;
window.initAuth = initAuth;
window.updateUserProfileUI = updateUserProfileUI;
window.validatePhone = validatePhone;
window.formatPhoneDisplay = formatPhoneDisplay;
window.updateUserPhone = updateUserPhone;

document.addEventListener('DOMContentLoaded', initAuth);
