const AUTH_STORAGE_KEYS = {
  session: 'asistente_facturas_session',
  users: 'asistente_facturas_auth_users',
};

const AUTH_CONFIG = window.AUTH_CONFIG || { GOOGLE_CLIENT_ID: '', GOOGLE_ANDROID_CLIENT_ID: '' };

let authMode = 'login';
let capacitorAuthScriptPromise = null;

const authScreen = () => document.getElementById('authScreen');
const appShell = () => document.getElementById('appShell');

function isGoogleConfigured() {
  const id = AUTH_CONFIG.GOOGLE_CLIENT_ID || '';
  return id.length > 0 && !id.includes('TU_CLIENT_ID');
}

function isCapacitorNative() {
  if (window.Capacitor?.isNativePlatform?.()) return true;
  if (window.VencelyCapacitorAuth?.isNative?.()) return true;
  return false;
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function shouldUseNativeGoogleSignIn() {
  return isCapacitorNative() && isGoogleConfigured();
}

function loadCapacitorAuthScript() {
  if (window.VencelyCapacitorAuth) return Promise.resolve();
  if (capacitorAuthScriptPromise) return capacitorAuthScriptPromise;

  capacitorAuthScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'capacitor-auth.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar capacitor-auth.js'));
    document.head.appendChild(script);
  });

  return capacitorAuthScriptPromise;
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

async function logout() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.session);
  window.VencelySync?.saveAuthToken?.('');
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
  if (shouldUseNativeGoogleSignIn()) {
    try {
      await loadCapacitorAuthScript();
      await window.VencelyCapacitorAuth?.signOut?.();
    } catch {
      // ignore native sign-out errors
    }
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
  const googlePhonePrompt = document.getElementById('googlePhonePrompt');

  const isLogin = mode === 'login';
  loginForm?.classList.toggle('hidden', !isLogin);
  registerForm?.classList.toggle('hidden', isLogin);
  googlePhonePrompt?.classList.add('hidden');

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

async function syncSessionToCloud() {
  if (!window.VencelySync?.isSyncEnabled?.()) return;
  try {
    await window.VencelySync.syncUserProfile?.();
    await window.VencelySync.onLoginSync?.();
  } catch (err) {
    console.warn('No se pudo sincronizar el perfil tras el login:', err);
  }
}

function finishLogin() {
  hideAuthScreen();
  syncSessionToCloud();
}

function showGooglePhonePrompt() {
  const prompt = document.getElementById('googlePhonePrompt');
  const authCard = document.getElementById('authCardMain');
  const input = document.getElementById('googlePhoneInput');
  const errorEl = document.getElementById('googlePhoneError');

  authCard?.classList.add('hidden');
  prompt?.classList.remove('hidden');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 100);
  }
}

function hideGooglePhonePrompt() {
  document.getElementById('googlePhonePrompt')?.classList.add('hidden');
  document.getElementById('authCardMain')?.classList.remove('hidden');
}

function createSessionFromApiUser(user, provider, token) {
  const session = {
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
  saveSession(session);
  if (token) window.VencelySync?.saveAuthToken?.(token);
  return session;
}

function createSessionFromUser(user, provider, options = {}) {
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

  const needsPhone = provider === 'google' && !session.phone && !options.skipPhonePrompt;
  if (needsPhone) {
    showGooglePhonePrompt();
    return;
  }

  finishLogin();
}

function safeAvatarUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
  } catch {
    // ignore invalid URLs
  }
  return '';
}

function updateUserProfileUI() {
  const user = getCurrentUser();
  if (!user) return;

  const avatar = document.getElementById('profileAvatar');
  const mobileAvatar = document.getElementById('mobileProfileAvatar');
  const nameEl = document.getElementById('profileName');
  const planEl = document.getElementById('profilePlan');
  const welcome = document.getElementById('welcomeMessage');
  const emailMeta = document.getElementById('settingsUserEmail');
  const phoneMeta = document.getElementById('settingsUserPhone');
  const phoneInput = document.getElementById('whatsappPhoneInput');
  const accountName = document.getElementById('settingsAccountName');

  const firstName = user.name?.split(/\s+/)[0] || 'Usuario';
  const planLabel = window.getUserPlanLabel?.() || 'Hogar + Empresa';

  if (welcome) welcome.textContent = `Hola, ${firstName}`;
  if (nameEl) nameEl.textContent = shortName(user.name);
  if (planEl) planEl.textContent = planLabel;
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

  const avatarHtml = safeAvatarUrl(user.picture)
    ? `<img src="${safeAvatarUrl(user.picture)}" alt="" class="profile-avatar-img" referrerpolicy="no-referrer" />`
    : getInitials(user.name);

  if (avatar) {
    if (safeAvatarUrl(user.picture)) {
      avatar.innerHTML = avatarHtml;
    } else {
      avatar.textContent = avatarHtml;
    }
  }

  if (mobileAvatar) {
    if (safeAvatarUrl(user.picture)) {
      mobileAvatar.innerHTML = avatarHtml;
    } else {
      mobileAvatar.textContent = avatarHtml;
    }
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isReservedAdminEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return false;

  const devAdminEmail = window.VencelyDevCredentials?.DEV_CREDENTIALS?.admin?.email;
  if (devAdminEmail && normalized === devAdminEmail.toLowerCase()) return true;

  return normalized === 'admin@vencely.app';
}

function redirectToAdminAccess(message) {
  showAuthError(message);
  if (typeof window.showAdminLoginPanel === 'function') {
    window.showAdminLoginPanel();
    location.hash = '#admin';
    return;
  }
  document.getElementById('btnAdminAccess')?.click();
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
  window.renderProfilePage?.();

  if (window.VencelySync?.isSyncEnabled?.()) {
    window.VencelySync.syncUserProfile?.().catch(() => {});
  }

  return { ok: true, phone: result.normalized };
}

function updateUserName(name) {
  const trimmed = (name || '').trim();
  if (trimmed.length < 2) {
    return { ok: false, error: 'El nombre debe tener al menos 2 caracteres.' };
  }

  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'No hay sesión activa.' };

  user.name = trimmed;
  saveSession(user);

  const users = getAuthUsers();
  const idx = users.findIndex((u) => u.id === user.id || u.email === user.email);
  if (idx >= 0) {
    users[idx].name = trimmed;
    saveAuthUsers(users);
  }

  updateUserProfileUI();
  window.renderProfilePage?.();

  if (window.VencelySync?.isSyncEnabled?.()) {
    window.VencelySync.syncUserProfile?.().catch(() => {});
  }

  return { ok: true, name: trimmed };
}

function getLoginMethodLabel(provider) {
  if (provider === 'google') return 'Google';
  return 'Correo y contraseña';
}

function showGooglePhoneError(message) {
  const el = document.getElementById('googlePhoneError');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function handleGooglePhoneSkip() {
  hideGooglePhonePrompt();
  finishLogin();
}

function handleGooglePhoneSave() {
  const phone = document.getElementById('googlePhoneInput')?.value?.trim() || '';
  if (!phone) {
    handleGooglePhoneSkip();
    return;
  }

  const result = updateUserPhone(phone);
  if (!result.ok) {
    showGooglePhoneError(result.error);
    return;
  }

  hideGooglePhonePrompt();
  finishLogin();
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
  if (isReservedAdminEmail(email)) {
    redirectToAdminAccess(
      'Este correo es de administrador. Usa «Acceso administrador» para crear cuentas de cliente con otro correo.'
    );
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

  if (window.VencelySync?.isSyncEnabled?.()) {
    if (!navigator.onLine) {
      showAuthError('Sin conexión. Conecta a internet para registrarte con la nube.');
      return;
    }
    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn?.setAttribute('disabled', 'true');
      const data = await window.VencelySync.apiRegister({
        email,
        password,
        name,
        phone: phoneResult.normalized,
      });
      createSessionFromApiUser(data.user, 'email', data.token);
      form.reset();
      finishLogin();
      return;
    } catch (err) {
      showAuthError(err.message || 'No se pudo crear la cuenta en el servidor.');
      return;
    } finally {
      form.querySelector('button[type="submit"]')?.removeAttribute('disabled');
    }
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
  if (isReservedAdminEmail(email)) {
    redirectToAdminAccess(
      'Este correo es de administrador. Usa «Acceso administrador» o el panel de acceso rápido de desarrollo.'
    );
    return;
  }
  if (!password) {
    showAuthError('Ingresa tu contraseña.');
    return;
  }

  if (window.VencelySync?.isSyncEnabled?.()) {
    if (!navigator.onLine) {
      showAuthError('Sin conexión. Conecta a internet para iniciar sesión con la nube.');
      return;
    }
    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn?.setAttribute('disabled', 'true');
      const data = await window.VencelySync.apiLogin(email, password);
      createSessionFromApiUser(data.user, 'email', data.token);
      form.reset();
      finishLogin();
      return;
    } catch (err) {
      showAuthError(err.message || 'Correo o contraseña incorrectos.');
      return;
    } finally {
      form.querySelector('button[type="submit"]')?.removeAttribute('disabled');
    }
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

function upsertGoogleUser({ email, googleId, name, picture }) {
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
  } else {
    user.name = name;
    user.picture = picture;
    user.googleId = googleId;
    user.provider = 'google';
  }

  saveAuthUsers(users);
  return user;
}

async function finalizeGoogleLogin({ email, googleId, name, picture, idToken }) {
  if (!email) {
    showAuthError('No se pudo obtener el correo de Google.');
    return;
  }

  const profile = {
    email: email.toLowerCase(),
    googleId,
    name: name || email.split('@')[0],
    picture: picture || '',
    idToken: idToken || '',
  };

  if (window.VencelySync?.isSyncEnabled?.()) {
    if (!navigator.onLine) {
      showAuthError('Sin conexión. Conecta a internet para iniciar sesión con Google.');
      return;
    }
    try {
      const data = await window.VencelySync.apiGoogleLogin(profile);
      createSessionFromApiUser(data.user, 'google', data.token);
      const needsPhone = !data.user.phone;
      if (needsPhone) {
        showGooglePhonePrompt();
        return;
      }
      finishLogin();
      return;
    } catch (err) {
      console.warn('Google cloud login failed, fallback local:', err);
      showAuthError(err.message || 'No se pudo autenticar con Google en el servidor.');
      return;
    }
  }

  const user = upsertGoogleUser(profile);
  createSessionFromUser(user, 'google');
}

function handleGoogleCredential(response) {
  clearAuthError();
  try {
    const payload = parseGoogleJwt(response.credential);
    finalizeGoogleLogin({
      email: payload.email || '',
      googleId: payload.sub,
      name: payload.name,
      picture: payload.picture,
      idToken: response.credential,
    });
  } catch (err) {
    console.error('Error al procesar credencial de Google:', err);
    showAuthError('No se pudo completar el inicio con Google. Intenta de nuevo.');
  }
}

function extractNativeGoogleProfile(response) {
  const result = response?.result || response || {};
  if (result.idToken) {
    const payload = parseGoogleJwt(result.idToken);
    return {
      email: payload.email || result.email || '',
      googleId: payload.sub || result.id || '',
      name: payload.name || result.name || '',
      picture: payload.picture || result.imageUrl || result.picture || '',
      idToken: result.idToken,
    };
  }

  return {
    email: result.email || '',
    googleId: result.id || result.userId || '',
    name: result.name || '',
    picture: result.imageUrl || result.picture || '',
    idToken: result.idToken || '',
  };
}

async function handleNativeGoogleSignIn() {
  const btn = document.getElementById('btnNativeGoogleSignIn');
  clearAuthError();

  if (!isGoogleConfigured()) {
    showAuthError('Google Sign-In no está configurado.');
    return;
  }

  try {
    btn?.setAttribute('disabled', 'true');
    await loadCapacitorAuthScript();
    await window.VencelyCapacitorAuth.initGoogle(AUTH_CONFIG.GOOGLE_CLIENT_ID);
    const response = await window.VencelyCapacitorAuth.signIn();
    const profile = extractNativeGoogleProfile(response);
    finalizeGoogleLogin(profile);
  } catch (err) {
    console.error('Error en Google Sign-In nativo:', err);
    const message = String(err?.message || err || '');
    if (/cancel|dismiss|closed/i.test(message)) {
      return;
    }
    showAuthError('No se pudo completar el inicio con Google. Verifica la configuración OAuth de Android.');
  } finally {
    btn?.removeAttribute('disabled');
  }
}

function renderNativeGoogleButton(container) {
  container.innerHTML = `
    <button type="button" id="btnNativeGoogleSignIn" class="google-native-button" aria-label="Continuar con Google">
      <span class="google-native-button__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      </span>
      <span>Continuar con Google</span>
    </button>
  `;

  document.getElementById('btnNativeGoogleSignIn')?.addEventListener('click', handleNativeGoogleSignIn);
}

async function setupNativeGoogleSignIn(container, notice) {
  container.innerHTML = '';
  notice.classList.add('hidden');

  if (!isGoogleConfigured()) {
    notice.classList.remove('hidden');
    return;
  }

  renderNativeGoogleButton(container);

  try {
    await loadCapacitorAuthScript();
    await window.VencelyCapacitorAuth.initGoogle(AUTH_CONFIG.GOOGLE_CLIENT_ID);
  } catch (err) {
    console.warn('No se pudo inicializar Google nativo:', err);
    notice.textContent = 'Google Sign-In nativo no está listo. Revisa auth-config.js y la configuración OAuth de Android.';
    notice.classList.remove('hidden');
  }
}

function setupWebGoogleSignIn(container, notice) {
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

  const parentWidth = container.offsetWidth || container.parentElement?.offsetWidth || 320;
  const width = Math.min(Math.max(parentWidth, 280), 400);

  window.google.accounts.id.initialize({
    client_id: AUTH_CONFIG.GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
    itp_support: true,
    locale: 'es',
    ux_mode: isMobileBrowser() ? 'popup' : 'popup',
    context: 'signin',
  });

  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width,
    locale: 'es',
  });

  if (isMobileBrowser() && !getCurrentUser()) {
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        return;
      }
    });
  }
}

function setupGoogleSignIn() {
  const container = document.getElementById('googleSignInContainer');
  const notice = document.getElementById('googleConfigNotice');
  if (!container || !notice) return;

  if (shouldUseNativeGoogleSignIn()) {
    setupNativeGoogleSignIn(container, notice);
    return;
  }

  setupWebGoogleSignIn(container, notice);
}

function initPasswordToggles(root = document) {
  root.querySelectorAll('.password-field').forEach((wrapper) => {
    const input = wrapper.querySelector('input');
    const toggle = wrapper.querySelector('.password-toggle');
    if (!input || !toggle || toggle.dataset.bound === 'true') return;

    const showIcon = toggle.querySelector('.password-toggle-icon--show');
    const hideIcon = toggle.querySelector('.password-toggle-icon--hide');

    toggle.dataset.bound = 'true';
    toggle.addEventListener('click', () => {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(isHidden));
      toggle.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
      showIcon?.classList.toggle('hidden', isHidden);
      hideIcon?.classList.toggle('hidden', !isHidden);
    });
  });
}

function attachAuthListeners() {
  initPasswordToggles();

  document.getElementById('authSwitchBtn')?.addEventListener('click', () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  });

  document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegisterSubmit);
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) logout();
  });

  document.getElementById('btnGooglePhoneSkip')?.addEventListener('click', handleGooglePhoneSkip);
  document.getElementById('btnGooglePhoneSave')?.addEventListener('click', handleGooglePhoneSave);
  document.getElementById('googlePhoneInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGooglePhoneSave();
    }
  });
}

async function restoreSessionFromServer() {
  if (!window.VencelySync?.isSyncEnabled?.() || !getCurrentUser()) return;
  if (!window.VencelySync.getAuthToken?.()) {
    window.VencelySync.markLocalSessionOnly?.();
    return;
  }
  if (!navigator.onLine) return;

  try {
    const data = await window.VencelySync.apiMe();
    if (data?.user) {
      createSessionFromApiUser(data.user, data.user.provider, data.token);
    }
  } catch (err) {
    if (err.status === 401 || err.message === 'Sesión no autorizada') {
      window.VencelySync.saveAuthToken?.('');
      window.VencelySync.markLocalSessionOnly?.('Sesión expirada — inicia sesión de nuevo');
      return;
    }
    localStorage.removeItem(AUTH_STORAGE_KEYS.session);
    window.VencelySync.saveAuthToken?.('');
    showAuthScreen();
  }
}

async function initAuthWithSession() {
  await restoreSessionFromServer();
  await window.VencelySync?.onLoginSync?.();
}

function initAuth() {
  attachAuthListeners();

  if (getCurrentUser()) {
    hideAuthScreen();
    initAuthWithSession();
  } else {
    showAuthScreen();
  }

  if (isGoogleConfigured() && !shouldUseNativeGoogleSignIn()) {
    const checkGoogle = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkGoogle);
        if (!getCurrentUser()) setupGoogleSignIn();
      }
    }, 200);
    setTimeout(() => clearInterval(checkGoogle), 10000);
  }
}

window.getInitials = getInitials;
window.getCurrentUser = getCurrentUser;
window.saveSession = saveSession;
window.logout = logout;
window.initAuth = initAuth;
window.setAuthMode = setAuthMode;
window.updateUserProfileUI = updateUserProfileUI;
window.validatePhone = validatePhone;
window.formatPhoneDisplay = formatPhoneDisplay;
window.updateUserPhone = updateUserPhone;
window.updateUserName = updateUserName;
window.getLoginMethodLabel = getLoginMethodLabel;

document.addEventListener('DOMContentLoaded', initAuth);
