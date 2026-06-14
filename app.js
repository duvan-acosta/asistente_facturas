const CATEGORY_LABELS = {
  servicios: 'Servicios públicos',
  telefonia: 'Telefonía / Internet',
  tarjeta: 'Tarjeta de crédito',
  credito: 'Crédito bancario',
  otro: 'Otro',
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const STORAGE_KEYS = {
  sedes: 'asistente_facturas_sedes',
  accounts: 'asistente_facturas_accounts',
  selectedSede: 'asistente_facturas_selected_sede',
  country: 'asistente_facturas_country',
};

const APP_PAGE_ROUTES = new Set(['dashboard', 'accounts', 'calendar', 'profile', 'bot-settings']);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COUNTRY_CONFIG = {
  CO: {
    id: 'CO',
    name: 'Colombia',
    flag: '🇨🇴',
    locale: 'es-CO',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  },
  MX: {
    id: 'MX',
    name: 'México',
    flag: '🇲🇽',
    locale: 'es-MX',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  US: {
    id: 'US',
    name: 'Estados Unidos',
    flag: '🇺🇸',
    locale: 'en-US',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
};

const DEFAULT_COUNTRY = 'CO';

const DEFAULT_SEDES = [
  { id: 's1', name: 'Casa principal', icon: '🏠' },
  { id: 's2', name: 'Oficina', icon: '🏢' },
];

const SAMPLE_ACCOUNTS = [
  { id: '1', title: 'Luz Hogar', provider: 'Enel', amount: 85000, dueDate: '2026-06-14', type: 'Recurrente', category: 'servicios', status: 'por-vencer', reminders: ['WhatsApp', 'Correo'], icon: '⚡', context: 'hogar', sedeId: 's1' },
  { id: '2', title: 'Visa Platinum', provider: 'Banco Empresa', amount: 950000, dueDate: '2026-06-15', type: 'Puntual', category: 'tarjeta', status: 'pendiente', reminders: ['WhatsApp'], icon: '💳', context: 'empresa', sedeId: 's2' },
  { id: '3', title: 'Internet & TV', provider: 'Claro', amount: 45500, dueDate: '2026-06-17', type: 'Recurrente', category: 'telefonia', status: 'pendiente', reminders: ['Correo'], icon: '📶', context: 'hogar', sedeId: 's1' },
  { id: '4', title: 'Agua Potable', provider: 'Aguas de la Ciudad', amount: 32800, dueDate: '2026-06-10', type: 'Recurrente', category: 'servicios', status: 'vencido', reminders: ['WhatsApp', 'Chat'], icon: '💧', context: 'hogar', sedeId: 's1' },
  { id: '5', title: 'Crédito Vehículo', provider: 'Banco del Sur', amount: 420000, dueDate: '2026-06-20', type: 'Recurrente', category: 'credito', status: 'programado', reminders: ['Correo'], icon: '🚗', context: 'hogar', sedeId: 's1' },
  { id: '6', title: 'Tarjeta Pyme', provider: 'Banco Empresarial', amount: 350000, dueDate: '2026-06-22', type: 'Puntual', category: 'tarjeta', status: 'pendiente', reminders: ['Chat'], icon: '🏦', context: 'empresa', sedeId: 's2' },
  { id: '7', title: 'Gas Natural', provider: 'GasSur', amount: 60000, dueDate: '2026-06-18', type: 'Recurrente', category: 'servicios', status: 'pendiente', reminders: ['WhatsApp'], icon: '🔥', context: 'hogar', sedeId: 's1' },
  { id: '8', title: 'Seguro Hogar', provider: 'Segura', amount: 68200, dueDate: '2026-06-25', type: 'Puntual', category: 'otro', status: 'programado', reminders: ['Correo', 'Chat'], icon: '🛡️', context: 'hogar', sedeId: 's1' },
];

let sedes = [...DEFAULT_SEDES];
let accounts = [...SAMPLE_ACCOUNTS];
let selectedSedeFilter = 'all';
let selectedCountry = DEFAULT_COUNTRY;

const settings = {
  whatsapp: true,
  email: true,
  chat: true,
  firstAlert: '3',
  finalAlert: '0',
  sendHour: '09:00',
  repeatIfNotPaid: true,
};

let calendarMonth = 5;
let calendarYear = 2026;
let activeCategoryFilter = 'all';
let photoFile = null;
let uploadMode = 'photo';

const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link, .bottom-nav-item[data-page]');
const paymentList = document.getElementById('paymentList');
const totalAmount = document.getElementById('totalAmount');
const nextPaymentNote = document.getElementById('nextPaymentNote');
const dueCount = document.getElementById('dueCount');
const accountTotal = document.getElementById('accountTotal');
const accountCount = document.getElementById('accountCount');
const accountCards = document.getElementById('accountCards');
const accountSearch = document.getElementById('accountSearch');
const filterButtons = document.querySelectorAll('.tab-button');
const categoryChips = document.querySelectorAll('.category-chip');
const calendarGrid = document.getElementById('calendarGrid');
const calendarTitle = document.getElementById('calendarTitle');
const toggleWhatsapp = document.getElementById('toggleWhatsapp');
const toggleEmail = document.getElementById('toggleEmail');
const toggleChat = document.getElementById('toggleChat');
const whatsappPhoneInput = document.getElementById('whatsappPhoneInput');
const btnSaveWhatsappPhone = document.getElementById('btnSaveWhatsappPhone');
const firstAlert = document.getElementById('firstAlert');
const finalAlert = document.getElementById('finalAlert');
const sendHour = document.getElementById('sendHour');
const repeatIfNotPaid = document.getElementById('repeatIfNotPaid');
const countrySelect = document.getElementById('countrySelect');
const reminderStatus = document.getElementById('reminderStatus');
const activeReminderChips = document.getElementById('activeReminderChips');

const modals = {
  manual: document.getElementById('modalManual'),
  photo: document.getElementById('modalPhoto'),
  bot: document.getElementById('modalBot'),
  sede: document.getElementById('modalSede'),
};

const sedeSwitcher = document.getElementById('sedeSwitcher');
const sedeCardSwitcher = document.getElementById('sedeCardSwitcher');
const sedeCardActive = document.getElementById('sedeCardActive');
const accountsSedeFilterSection = document.getElementById('accountsSedeFilterSection');
const accountsSedeFilters = document.getElementById('accountsSedeFilters');
const sedesList = document.getElementById('sedesList');
const sedeForm = document.getElementById('sedeForm');
const dashboardSedeNote = document.getElementById('dashboardSedeNote');

const registerSheet = document.getElementById('registerSheet');
const manualForm = document.getElementById('manualForm');
const toast = document.getElementById('toast');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getDefaultSedeId() {
  return sedes[0]?.id || 's1';
}

function getSedeById(id) {
  return sedes.find((s) => s.id === id);
}

function getSedeLabel(id) {
  const sede = getSedeById(id);
  return sede ? `${sede.icon} ${sede.name}` : 'Sin sede';
}

function matchesSedeFilter(account) {
  return selectedSedeFilter === 'all' || account.sedeId === selectedSedeFilter;
}

function getFilteredAccounts() {
  return accounts.filter(matchesSedeFilter);
}

function touchUpdatedAt(item) {
  return { ...item, updatedAt: new Date().toISOString() };
}

function saveSedes(options = {}) {
  try {
    sedes = sedes.map((s) => (s.updatedAt ? s : touchUpdatedAt(s)));
    localStorage.setItem(STORAGE_KEYS.sedes, JSON.stringify(sedes));
    if (!options.skipSync && window.VencelySync?.isSyncEnabled?.()) {
      window.VencelySync.scheduleDebouncedSync?.();
    }
  } catch (e) {
    console.warn('No se pudieron guardar las sedes:', e);
  }
}

function saveAccounts(options = {}) {
  try {
    accounts = accounts.map((a) => (a.updatedAt ? a : touchUpdatedAt(a)));
    localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
    if (!options.skipSync && window.VencelySync?.isSyncEnabled?.()) {
      window.VencelySync.scheduleDebouncedSync?.();
    }
  } catch (e) {
    console.warn('No se pudieron guardar las cuentas:', e);
  }
}

function saveSelectedSede() {
  try {
    localStorage.setItem(STORAGE_KEYS.selectedSede, selectedSedeFilter);
  } catch (e) {
    console.warn('No se pudo guardar el filtro de sede:', e);
  }
}

function saveCountry() {
  try {
    localStorage.setItem(STORAGE_KEYS.country, selectedCountry);
  } catch (e) {
    console.warn('No se pudo guardar el país:', e);
  }
}

function getCountryConfig(countryId = selectedCountry) {
  return COUNTRY_CONFIG[countryId] || COUNTRY_CONFIG[DEFAULT_COUNTRY];
}

function getCurrencyCode() {
  return getCountryConfig().currency;
}

function formatCurrency(value, countryId = selectedCountry) {
  const config = getCountryConfig(countryId);
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: config.minimumFractionDigits,
    maximumFractionDigits: config.maximumFractionDigits,
  }).format(Number(value));
}

function updateCurrencyLabels() {
  const config = getCountryConfig();
  const code = config.currency;

  document.querySelectorAll('[data-currency-label]').forEach((el) => {
    el.textContent = code;
  });

  const manualAmountLabel = document.getElementById('manualAmountLabel');
  if (manualAmountLabel) manualAmountLabel.textContent = `Monto (${code})`;

  document.querySelectorAll('[name="amount"], #photoAmount').forEach((input) => {
    const useDecimals = config.maximumFractionDigits > 0;
    input.step = useDecimals ? '0.01' : '1';
    input.placeholder = useDecimals ? '0.00' : '0';
  });

  updateChatCurrencyExamples();
}

function getChatCurrencyExamples() {
  const examples = {
    CO: {
      luz: { amount: 85000, label: 'Luz Enel $85.000' },
      tarjeta: { amount: 200000, label: 'Tarjeta Visa' },
      credito: { amount: 420000, label: 'Crédito auto' },
      placeholder: 'Ej: Agregar internet Claro $45.500, vence el 17...',
      botIntro: '¡Hola! Soy tu asistente de cuentas por pagar. Cuéntame el pago que quieres registrar, por ejemplo: "Agregar luz Enel $85.000, vence el 15 de junio".',
      amountHint: 'No detecté el monto. ¿Puedes incluir el valor? Ej: "$85.000" o "85000 pesos".',
    },
    MX: {
      luz: { amount: 850, label: 'Luz CFE $850' },
      tarjeta: { amount: 2000, label: 'Tarjeta Visa' },
      credito: { amount: 4200, label: 'Crédito auto' },
      placeholder: 'Ej: Agregar internet Telmex $599, vence el 17...',
      botIntro: '¡Hola! Soy tu asistente de cuentas por pagar. Cuéntame el pago que quieres registrar, por ejemplo: "Agregar luz CFE $850, vence el 15 de junio".',
      amountHint: 'No detecté el monto. ¿Puedes incluir el valor? Ej: "$850" o "850 pesos".',
    },
    US: {
      luz: { amount: 85, label: 'Luz $85' },
      tarjeta: { amount: 200, label: 'Tarjeta Visa' },
      credito: { amount: 420, label: 'Crédito auto' },
      placeholder: 'Ej: Agregar internet Comcast $45, vence el 17...',
      botIntro: '¡Hola! Soy tu asistente de cuentas por pagar. Cuéntame el pago que quieres registrar, por ejemplo: "Agregar luz $85, vence el 15 de junio".',
      amountHint: 'No detecté el monto. ¿Puedes incluir el valor? Ej: "$85" o "85 dólares".',
    },
  };
  return examples[selectedCountry] || examples[DEFAULT_COUNTRY];
}

function updateChatCurrencyExamples() {
  const ex = getChatCurrencyExamples();
  const chatInput = document.getElementById('chatInput');
  if (chatInput) chatInput.placeholder = ex.placeholder;

  const chips = document.querySelectorAll('.suggestion-chip');
  if (chips.length >= 3) {
    chips[0].dataset.suggestion = `Registrar luz Enel $${ex.luz.amount.toLocaleString('es')} vence el 15 de junio`;
    chips[0].textContent = ex.luz.label;
    chips[1].dataset.suggestion = `Agregar tarjeta Visa del banco, pago mínimo $${ex.tarjeta.amount} el día 20`;
    chips[1].textContent = ex.tarjeta.label;
    chips[2].dataset.suggestion = `Crédito vehículo banco, cuota mensual $${ex.credito.amount}`;
    chips[2].textContent = ex.credito.label;
  }
}

function populateCountrySelect() {
  if (!countrySelect) return;
  countrySelect.innerHTML = Object.values(COUNTRY_CONFIG)
    .map((c) => `<option value="${c.id}">${c.flag} ${c.name} (${c.currency})</option>`)
    .join('');
  countrySelect.value = selectedCountry;
}

function loadFromStorage() {
  try {
    const storedSedes = localStorage.getItem(STORAGE_KEYS.sedes);
    if (storedSedes) sedes = JSON.parse(storedSedes);

    const storedAccounts = localStorage.getItem(STORAGE_KEYS.accounts);
    if (storedAccounts) {
      accounts = JSON.parse(storedAccounts);
      accounts.forEach((a) => {
        if (!a.sedeId) a.sedeId = a.context === 'empresa' ? 's2' : getDefaultSedeId();
        if (!getSedeById(a.sedeId)) a.sedeId = getDefaultSedeId();
      });
    }

    const storedFilter = localStorage.getItem(STORAGE_KEYS.selectedSede);
    if (storedFilter) selectedSedeFilter = storedFilter;

    const storedCountry = localStorage.getItem(STORAGE_KEYS.country);
    if (storedCountry && COUNTRY_CONFIG[storedCountry]) selectedCountry = storedCountry;
  } catch (e) {
    console.warn('Error al cargar datos guardados:', e);
  }
}

function populateSedeSelects() {
  const defaultId = getDefaultSedeId();
  document.querySelectorAll('select[name="sedeId"], #photoSede').forEach((select) => {
    const current = select.value;
    select.innerHTML = sedes
      .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.icon)} ${escapeHtml(s.name)}</option>`)
      .join('');
    select.value = sedes.some((s) => s.id === current) ? current : defaultId;
  });
}

function getSedeFilterLabel() {
  return selectedSedeFilter === 'all' ? 'Todas las sedes' : getSedeLabel(selectedSedeFilter);
}

function bindSedeChips(container) {
  container.querySelectorAll('[data-sede]').forEach((chip) => {
    chip.addEventListener('click', () => {
      selectedSedeFilter = chip.dataset.sede;
      saveSelectedSede();
      renderSedeSwitcher();
      refreshAll();
    });
  });
}

function renderAccountsSedeFilter() {
  if (!accountsSedeFilterSection || !accountsSedeFilters) return;

  const showFilter = sedes.length >= 2;
  accountsSedeFilterSection.hidden = !showFilter;
  if (!showFilter) return;

  accountsSedeFilters.innerHTML = [
    `<button type="button" class="category-chip${selectedSedeFilter === 'all' ? ' active' : ''}" data-sede="all">
      <span class="filter-chip-icon" aria-hidden="true">🏠</span>
      Todas las sedes
    </button>`,
    ...sedes.map(
      (s) =>
        `<button type="button" class="category-chip${selectedSedeFilter === s.id ? ' active' : ''}" data-sede="${escapeHtml(s.id)}">
          <span class="filter-chip-icon" aria-hidden="true">${escapeHtml(s.icon)}</span>
          ${escapeHtml(s.name)}
        </button>`
    ),
  ].join('');
  bindSedeChips(accountsSedeFilters);
}

function renderSedeSwitcher() {
  const chipsHtml = [
    `<button type="button" class="sede-chip${selectedSedeFilter === 'all' ? ' active' : ''}" data-sede="all">Todas las sedes</button>`,
    ...sedes.map(
      (s) =>
        `<button type="button" class="sede-chip${selectedSedeFilter === s.id ? ' active' : ''}" data-sede="${escapeHtml(s.id)}">${escapeHtml(s.icon)} ${escapeHtml(s.name)}</button>`
    ),
  ].join('');

  [sedeSwitcher, sedeCardSwitcher].forEach((container) => {
    if (!container) return;
    container.innerHTML = chipsHtml;
    bindSedeChips(container);
  });

  if (sedeCardActive) {
    sedeCardActive.textContent = getSedeFilterLabel();
  }

  renderAccountsSedeFilter();
}

function renderSedesManager() {
  if (!sedesList) return;

  sedesList.innerHTML = '';

  sedes.forEach((sede) => {
    const usedCount = accounts.filter((a) => a.sedeId === sede.id).length;
    const row = document.createElement('div');
    row.className = 'sede-row';
    row.innerHTML = `
      <div class="sede-row-info">
        <span class="sede-row-icon">${escapeHtml(sede.icon)}</span>
        <div>
          <p class="sede-row-name">${escapeHtml(sede.name)}</p>
          <p class="sede-row-meta">${usedCount} cuenta${usedCount !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div class="sede-row-actions">
        <button type="button" class="ghost-button sede-edit-btn" data-sede-id="${escapeHtml(sede.id)}">Editar</button>
        <button type="button" class="ghost-button sede-delete-btn" data-sede-id="${escapeHtml(sede.id)}"${sedes.length <= 1 ? ' disabled' : ''}>Eliminar</button>
      </div>
    `;
    sedesList.appendChild(row);
  });

  sedesList.querySelectorAll('.sede-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openSedeModal(btn.dataset.sedeId));
  });

  sedesList.querySelectorAll('.sede-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteSede(btn.dataset.sedeId));
  });
}

function openSedeModal(sedeId = null) {
  if (!modals.sede || !sedeForm) return;

  sedeForm.reset();
  sedeForm.querySelector('[name="sedeId"]').value = sedeId || '';
  document.getElementById('sedeModalTitle').textContent = sedeId ? 'Editar sede' : 'Nueva sede';

  if (sedeId) {
    const sede = getSedeById(sedeId);
    if (sede) {
      sedeForm.querySelector('[name="name"]').value = sede.name;
      sedeForm.querySelector('[name="icon"]').value = sede.icon;
    }
  }

  modals.sede.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function saveSedeFromForm(e) {
  e.preventDefault();
  const fd = new FormData(sedeForm);
  const existingId = fd.get('sedeId');
  const name = fd.get('name').trim();
  const icon = fd.get('icon');

  if (!name) return;

  if (existingId) {
    const sede = getSedeById(existingId);
    if (sede) {
      sede.name = name;
      sede.icon = icon;
      sede.updatedAt = new Date().toISOString();
      showToast(`✓ Sede "${name}" actualizada`);
    }
  } else {
    sedes.push(touchUpdatedAt({ id: generateId(), name, icon }));
    showToast(`✓ Sede "${name}" creada`);
  }

  saveSedes();
  populateSedeSelects();
  renderSedeSwitcher();
  renderSedesManager();
  refreshAll();
  modals.sede.classList.add('hidden');
  if (!Object.values(modals).some((m) => m && !m.classList.contains('hidden'))) {
    document.body.style.overflow = '';
  }
}

function deleteSede(sedeId) {
  if (sedes.length <= 1) {
    showToast('Debe existir al menos una sede');
    return;
  }

  const sede = getSedeById(sedeId);
  if (!sede) return;

  const fallbackId = sedes.find((s) => s.id !== sedeId)?.id;
  if (!fallbackId) return;

  if (!confirm(`¿Eliminar "${sede.name}"? Las cuentas asociadas pasarán a otra sede.`)) return;

  const now = new Date().toISOString();
  accounts.forEach((a) => {
    if (a.sedeId === sedeId) {
      a.sedeId = fallbackId;
      a.updatedAt = now;
    }
  });

  sedes = sedes.filter((s) => s.id !== sedeId);
  if (selectedSedeFilter === sedeId) selectedSedeFilter = 'all';

  saveSedes();
  saveAccounts();
  saveSelectedSede();
  populateSedeSelects();
  renderSedeSwitcher();
  renderSedesManager();
  refreshAll();
  showToast(`Sede "${sede.name}" eliminada`);
}

function sedeBadgeHtml(sedeId) {
  const sede = getSedeById(sedeId);
  if (!sede) return '';
  return `<span class="sede-badge" title="Casa / Sede">${escapeHtml(sede.icon)} ${escapeHtml(sede.name)}</span>`;
}

function normalizeAppPathRoute() {
  const path = location.pathname.replace(/\/$/, '') || '/';
  if (path === '/' || path === '/index.html') return;
  const pageId = path.slice(1).split('/')[0];
  if (!APP_PAGE_ROUTES.has(pageId)) return;
  const hash = pageId === 'dashboard' ? '' : `#${pageId}`;
  setAppRouteHash(hash);
}

function getPageFromHash() {
  if (location.hash === '#admin') return 'dashboard';
  const hash = location.hash.replace('#', '');
  return APP_PAGE_ROUTES.has(hash) ? hash : 'dashboard';
}

function handleAppHashRoute() {
  if (location.hash === '#admin') return;
  switchPage(getPageFromHash(), { updateHash: false });
}

function setAppRouteHash(targetHash) {
  const base = `${location.pathname}${location.search}`;
  const url = `${base}${targetHash}`;
  try {
    history.replaceState(null, '', url);
  } catch {
    location.hash = targetHash || '';
  }
}

function switchPage(pageId, options = {}) {
  const { updateHash = true } = options;
  pages.forEach((page) => page.classList.toggle('active-page', page.id === pageId));
  document.querySelectorAll('.nav-link, .bottom-nav-item').forEach((link) => {
    if (link.dataset.page) {
      link.classList.toggle('active', link.dataset.page === pageId);
    }
  });
  if (updateHash) {
    const targetHash = pageId === 'dashboard' ? '' : `#${pageId}`;
    if (location.hash !== targetHash) {
      setAppRouteHash(targetHash);
    }
  }
  document.querySelector('.content')?.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
  if (pageId === 'profile') renderProfilePage();
}

let accountHighlightTimer = null;

function focusAccountCard(accountId) {
  requestAnimationFrame(() => {
    const card = accountCards?.querySelector(`[data-account-id="${accountId}"]`);
    if (!card) {
      showToast('No se encontró la cuenta en la lista');
      return;
    }
    card.classList.add('is-highlighted');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.focus({ preventScroll: true });
    clearTimeout(accountHighlightTimer);
    accountHighlightTimer = setTimeout(() => card.classList.remove('is-highlighted'), 2600);
  });
}

function navigateToAccount(accountId) {
  const account = accounts.find((a) => a.id === accountId);
  if (!account) {
    showToast('No se encontró la cuenta');
    return;
  }

  if (selectedSedeFilter !== 'all' && account.sedeId !== selectedSedeFilter) {
    selectedSedeFilter = account.sedeId;
    saveSelectedSede();
    renderSedeSwitcher();
    renderAccountsSedeFilter();
  }

  activeCategoryFilter = 'all';
  categoryChips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.category === 'all');
  });
  filterButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === 'all');
  });
  if (accountSearch) accountSearch.value = '';

  switchPage('accounts');
  renderAccounts('all', '');
  focusAccountCard(accountId);
}

function handleCalendarEventActivate(eventEl) {
  const accountId = eventEl?.dataset?.accountId;
  if (accountId) navigateToAccount(accountId);
}

function attachNavigationListeners() {
  const appShellEl = document.getElementById('appShell');
  if (!appShellEl || attachNavigationListeners._attached) return;
  attachNavigationListeners._attached = true;

  appShellEl.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-page]');
    if (!trigger || !appShellEl.contains(trigger)) return;
    const pageId = trigger.dataset.page;
    if (pageId) switchPage(pageId);
  });
}

function getUserPlanLabel() {
  const contexts = new Set(accounts.map((a) => a.context).filter(Boolean));
  const hasHogar = contexts.has('hogar');
  const hasEmpresa = contexts.has('empresa');
  if (hasHogar && hasEmpresa) return 'Hogar + Empresa';
  if (hasEmpresa) return 'Empresa';
  if (hasHogar) return 'Hogar';
  return 'Hogar + Empresa';
}

function renderProfilePage() {
  if (typeof getCurrentUser !== 'function') return;
  const user = getCurrentUser();
  if (!user) return;

  const planLabel = getUserPlanLabel();
  const pending = accounts.filter((a) => a.status !== 'pagado');
  const pendingTotal = pending.reduce((sum, a) => sum + a.amount, 0);
  const loginMethod = typeof getLoginMethodLabel === 'function'
    ? getLoginMethodLabel(user.provider)
    : (user.provider === 'google' ? 'Google' : 'Correo y contraseña');

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const setAvatar = (id, sizeClass) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (user.picture) {
      el.innerHTML = `<img src="${user.picture}" alt="" class="profile-avatar-img${sizeClass ? ` ${sizeClass}` : ''}" referrerpolicy="no-referrer" />`;
    } else {
      el.textContent = typeof getInitials === 'function' ? getInitials(user.name) : '?';
    }
  };

  setAvatar('profilePageAvatar', 'profile-hero-avatar-img');
  setText('profilePageName', user.name || 'Usuario');
  setText('profilePagePlan', planLabel);
  setText('profilePageProvider', loginMethod);
  setText('profileStatAccounts', String(accounts.length));
  setText('profileStatSedes', String(sedes.length));
  setText('profileStatPending', formatCurrency(pendingTotal));
  setText('profilePageEmail', user.email || '—');
  setText('profilePagePhone', user.phone
    ? (typeof formatPhoneDisplay === 'function' ? formatPhoneDisplay(user.phone) : user.phone)
    : 'Sin celular configurado');
  setText('profilePageLoginMethod', loginMethod);
  setText('profilePageLoggedIn', user.loggedInAt
    ? new Date(user.loggedInAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    : '—');
  setText('profileSessionName', user.name || 'Usuario');

  const nameInput = document.getElementById('profileNameInput');
  const nameHint = document.getElementById('profileNameHint');
  const btnSaveName = document.getElementById('btnSaveProfileName');
  if (nameInput && document.activeElement !== nameInput) {
    nameInput.value = user.name || '';
  }
  if (user.provider === 'google') {
    if (nameInput) {
      nameInput.readOnly = true;
      nameInput.classList.add('input-readonly');
    }
    if (nameHint) nameHint.textContent = 'Tu nombre proviene de Google y no se puede editar aquí.';
    btnSaveName?.setAttribute('disabled', 'disabled');
  } else {
    if (nameInput) {
      nameInput.readOnly = false;
      nameInput.classList.remove('input-readonly');
    }
    if (nameHint) nameHint.textContent = 'Actualiza cómo te saludamos en la app.';
    btnSaveName?.removeAttribute('disabled');
  }

  const phoneInput = document.getElementById('profilePhoneInput');
  if (phoneInput && document.activeElement !== phoneInput) {
    phoneInput.value = user.phone && typeof formatPhoneDisplay === 'function'
      ? formatPhoneDisplay(user.phone)
      : (user.phone || '');
  }

  if (typeof updateUserProfileUI === 'function') updateUserProfileUI();
  window.VencelySync?.updateSyncUI?.();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

function openModal(name, options = {}) {
  closeRegisterSheet();
  const modal = modals[name];
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  if (name === 'bot') initChat();
  if (name === 'photo') {
    uploadMode = options.uploadMode || 'photo';
    setupUploadModal();
    resetPhotoModal();
    populateSedeSelects();
    const photoSede = document.getElementById('photoSede');
    if (photoSede && selectedSedeFilter !== 'all') {
      photoSede.value = selectedSedeFilter;
    }
  }
  if (name === 'manual') {
    populateSedeSelects();
    const dueInput = manualForm.querySelector('[name="dueDate"]');
    if (!dueInput.value) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      dueInput.value = nextWeek.toISOString().slice(0, 10);
    }
    const sedeSelect = manualForm.querySelector('[name="sedeId"]');
    if (sedeSelect && selectedSedeFilter !== 'all') {
      sedeSelect.value = selectedSedeFilter;
    }
  }
}

function closeAllModals() {
  closeCameraPreview();
  Object.values(modals).forEach((modal) => modal.classList.add('hidden'));
  document.body.style.overflow = '';
}

function openRegisterSheet() {
  if (window.innerWidth <= 768) {
    registerSheet.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  } else {
    openModal('manual');
  }
}

function closeRegisterSheet() {
  registerSheet.classList.add('hidden');
  if (!Object.values(modals).some((m) => !m.classList.contains('hidden'))) {
    document.body.style.overflow = '';
  }
}

function computeStatus(dueDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (diff < 0) return 'vencido';
  if (diff <= 3) return 'por-vencer';
  if (diff <= 14) return 'pendiente';
  return 'programado';
}

function getStatusClass(status) {
  return status in { vencido: 1, 'por-vencer': 1, programado: 1, pendiente: 1, pagado: 1 }
    ? status
    : 'pendiente';
}

function getStatusLabel(status) {
  const labels = {
    vencido: 'VENCIDO',
    'por-vencer': 'POR VENCER',
    programado: 'PROGRAMADO',
    pendiente: 'PENDIENTE',
    pagado: 'PAGADO',
  };
  return labels[status] || 'PENDIENTE';
}

function formatDueText(dueDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const days = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (days < 0) return `hace ${Math.abs(days)} días`;
  if (days === 0) return 'hoy';
  return `en ${days} días`;
}

function refreshAll() {
  accounts.forEach((a) => {
    if (a.status !== 'pagado') a.status = computeStatus(a.dueDate);
  });
  renderSedeSwitcher();
  renderDashboard();
  const activeTab = document.querySelector('.tab-button.active')?.dataset.filter || 'all';
  renderAccounts(activeTab, accountSearch.value);
  renderCalendar();
  updateReminderSummary();
  if (document.getElementById('profile')?.classList.contains('active-page')) {
    renderProfilePage();
  }
}

function renderDashboard() {
  const filtered = getFilteredAccounts();
  const pending = filtered.filter((a) => a.status !== 'pagado');
  const total = pending.reduce((sum, a) => sum + a.amount, 0);
  const sorted = [...pending].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const nextDue = sorted.find((a) => new Date(a.dueDate) >= new Date(new Date().toDateString()));

  const dueInWeek = pending.filter((a) => {
    const diff = (new Date(a.dueDate) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }).length;

  totalAmount.textContent = formatCurrency(total);
  nextPaymentNote.textContent = nextDue
    ? `Próximo: ${nextDue.title} · ${formatCurrency(nextDue.amount)}`
    : 'No hay próximos pagos';
  dueCount.textContent = dueInWeek;

  if (dashboardSedeNote) {
    dashboardSedeNote.textContent =
      selectedSedeFilter === 'all' ? 'Total de todas las sedes' : `Filtrado: ${getSedeFilterLabel()}`;
  }

  const upcoming = pending
    .filter((a) => ['vencido', 'por-vencer', 'pendiente'].includes(a.status))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 6);

  renderPaymentList(upcoming);
}

function renderPaymentList(items) {
  paymentList.innerHTML = '';

  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Aún no has agregado pagos. ¡Registra tu primer pago!';
    paymentList.appendChild(empty);
    return;
  }

  items.forEach((payment) => {
    const item = document.createElement('li');
    item.className = `payment-item payment-item--${getStatusClass(payment.status)}`;
    item.innerHTML = `
      <div class="payment-item-header">
        <div>
          <h3>${escapeHtml(payment.icon || '')} ${escapeHtml(payment.title)}</h3>
          <div class="payment-meta">
            <span>${escapeHtml(payment.provider)}</span>
            <span class="category-badge">${escapeHtml(CATEGORY_LABELS[payment.category] || payment.category)}</span>
            ${sedeBadgeHtml(payment.sedeId)}
            <span>${escapeHtml(payment.type)}</span>
            <span>Vence: ${escapeHtml(payment.dueDate)}</span>
          </div>
        </div>
        <span class="status-pill ${getStatusClass(payment.status)}">${getStatusLabel(payment.status)}</span>
      </div>
      <div class="payment-meta">
        <span>${formatCurrency(payment.amount)}</span>
        <span>🔔 ${escapeHtml((payment.reminders || []).join(', '))}</span>
      </div>
    `;
    paymentList.appendChild(item);
  });
}

function renderAccounts(filter = 'all', query = '') {
  const sedeFiltered = getFilteredAccounts();
  const filtered = sedeFiltered.filter((account) => {
    const q = query.toLowerCase();
    const matchesQuery =
      account.title.toLowerCase().includes(q) ||
      account.provider.toLowerCase().includes(q);
    const matchesFilter = filter === 'all' || account.status === filter;
    const matchesCategory =
      activeCategoryFilter === 'all' || account.category === activeCategoryFilter;
    return matchesQuery && matchesFilter && matchesCategory;
  });

  const pending = sedeFiltered.filter((a) => a.status !== 'pagado');
  accountCount.textContent = sedeFiltered.length;
  accountTotal.textContent = formatCurrency(pending.reduce((sum, a) => sum + a.amount, 0));
  accountCards.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No se encontraron cuentas con estos filtros.';
    accountCards.appendChild(empty);
    return;
  }

  filtered.forEach((account) => {
    const card = document.createElement('div');
    card.className = `account-card payment-item--${getStatusClass(account.status)}`;
    card.dataset.accountId = account.id;
    card.tabIndex = -1;
    card.innerHTML = `
      <div class="account-card-header">
        <div class="account-detail">
          <span class="account-provider"><span class="account-icon">${escapeHtml(account.icon || '📄')}</span>${escapeHtml(account.title)}</span>
          <p>${escapeHtml(account.provider)} · ${escapeHtml(account.type)} · ${escapeHtml(CATEGORY_LABELS[account.category] || '')}</p>
          <div class="account-meta">${sedeBadgeHtml(account.sedeId)}</div>
        </div>
        <span class="status-pill ${getStatusClass(account.status)}">${getStatusLabel(account.status)}</span>
      </div>
      <div class="account-info">
        <span>Vence ${formatDueText(account.dueDate)}</span>
        <span>${formatCurrency(account.amount)}</span>
      </div>
    `;
    accountCards.appendChild(card);
  });
}

function renderCalendar() {
  calendarTitle.textContent = `${MONTH_NAMES[calendarMonth]} ${calendarYear}`;
  calendarGrid.innerHTML = '';

  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const today = new Date();

  const eventsByDay = {};
  getFilteredAccounts().forEach((a) => {
    const d = new Date(a.dueDate + 'T00:00:00');
    if (d.getMonth() === calendarMonth && d.getFullYear() === calendarYear) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push({ label: a.title, type: getStatusClass(a.status), accountId: a.id });
    }
  });

  for (let i = 0; i < firstDay; i += 1) {
    const cell = document.createElement('div');
    const weekday = i % 7;
    cell.className = 'calendar-day other-month' + (weekday === 0 || weekday === 6 ? ' weekend' : '');
    calendarGrid.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = document.createElement('div');
    const weekday = (firstDay + day - 1) % 7;
    const isToday =
      day === today.getDate() &&
      calendarMonth === today.getMonth() &&
      calendarYear === today.getFullYear();

    cell.className = 'calendar-day'
      + (isToday ? ' today' : '')
      + (weekday === 0 || weekday === 6 ? ' weekend' : '');
    const dayLabel = document.createElement('span');
    dayLabel.className = 'calendar-day-number';
    dayLabel.textContent = day;
    cell.appendChild(dayLabel);

    const events = eventsByDay[day] || [];
    if (events.length) cell.classList.add('has-events');

    events.forEach((event) => {
      const badge = document.createElement('div');
      badge.className = `calendar-event ${event.type}`;
      badge.dataset.accountId = event.accountId;
      badge.textContent = event.label;
      badge.title = event.label;
      badge.setAttribute('role', 'button');
      badge.tabIndex = 0;
      badge.setAttribute('aria-label', `Ver cuenta: ${event.label}`);
      cell.appendChild(badge);
    });

    calendarGrid.appendChild(cell);
  }
}

function updateReminderSummary() {
  const active = [settings.whatsapp, settings.email, settings.chat].filter(Boolean).length;
  reminderStatus.textContent = active === 0 ? 'Desactivados' : `${active} canal${active > 1 ? 'es' : ''}`;
  activeReminderChips.innerHTML = '';
  if (settings.whatsapp) activeReminderChips.innerHTML += '<span class="chip chip-whatsapp">WhatsApp</span>';
  if (settings.email) activeReminderChips.innerHTML += '<span class="chip chip-email">Correo</span>';
  if (settings.chat) activeReminderChips.innerHTML += '<span class="chip chip-chat">Chat / Bot</span>';
}

function addAccount(data) {
  const account = touchUpdatedAt({
    id: generateId(),
    title: data.title,
    provider: data.provider,
    amount: parseFloat(data.amount),
    dueDate: data.dueDate,
    type: data.type,
    category: data.category,
    status: computeStatus(data.dueDate),
    reminders: data.reminders,
    icon: data.icon || '📄',
    context: data.context || 'hogar',
    sedeId: data.sedeId || getDefaultSedeId(),
    notes: data.notes || '',
  });
  accounts.unshift(account);
  saveAccounts();
  refreshAll();
  showToast(`✓ "${account.title}" registrada correctamente`);
  return account;
}

function parseBotMessage(text) {
  const lower = text.toLowerCase();
  let category = 'otro';
  let icon = '📄';
  let type = lower.includes('mensual') || lower.includes('recurrente') ? 'Recurrente' : 'Puntual';

  if (/luz|agua|gas|servicio|enel|epm/.test(lower)) {
    category = 'servicios';
    icon = lower.includes('agua') ? '💧' : lower.includes('gas') ? '🔥' : '⚡';
  } else if (/internet|claro|movistar|tigo|telefon|celular/.test(lower)) {
    category = 'telefonia';
    icon = '📶';
  } else if (/visa|master|tarjeta|crédito de consumo/.test(lower)) {
    category = 'tarjeta';
    icon = '💳';
  } else if (/crédito|prestamo|préstamo|cuota|vehículo|auto/.test(lower)) {
    category = 'credito';
    icon = '🚗';
    type = 'Recurrente';
  }

  const amountMatch = text.match(/\$?\s*([\d.,]+)/);
  let amount = 0;
  if (amountMatch) {
    const raw = amountMatch[1];
    const config = getCountryConfig();
    if (config.maximumFractionDigits === 0) {
      amount = parseInt(raw.replace(/\./g, '').replace(/,/g, ''), 10) || 0;
    } else {
      amount = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
    }
  }

  const dateMatch = text.match(/(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
  let dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const monthIdx = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(dateMatch[2].toLowerCase().slice(0, 3)));
    if (monthIdx >= 0) dueDate = new Date(calendarYear, monthIdx, day);
  }

  const providerMatch = text.match(/(?:de|del)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)(?:\s*[,$]|\s+vence|\s+\d)/i);
  const provider = providerMatch ? providerMatch[1].trim() : 'Proveedor';

  let title = text.split(/[,.]/)[0].replace(/^(agregar|registrar|nueva?)\s+/i, '').trim();
  if (title.length > 40) title = title.slice(0, 40);

  return { title, provider, amount, dueDate: dueDate.toISOString().slice(0, 10), type, category, icon };
}

function initChat() {
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages.dataset.initialized) return;
  chatMessages.dataset.initialized = 'true';
  appendChatMessage('bot', getChatCurrencyExamples().botIntro);
}

function appendChatMessage(role, text) {
  const chatMessages = document.getElementById('chatMessages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleChatSubmit(text) {
  if (!text.trim()) return;
  appendChatMessage('user', text);

  setTimeout(() => {
    const parsed = parseBotMessage(text);
    if (!parsed.amount) {
      appendChatMessage('bot', getChatCurrencyExamples().amountHint);
      return;
    }

    const reminders = [];
    if (settings.whatsapp) reminders.push('WhatsApp');
    if (settings.email) reminders.push('Correo');
    if (settings.chat) reminders.push('Chat');

    addAccount({
      ...parsed,
      reminders: reminders.length ? reminders : ['Chat'],
      context: 'hogar',
      sedeId: selectedSedeFilter !== 'all' ? selectedSedeFilter : getDefaultSedeId(),
    });

    appendChatMessage(
      'bot',
      `Listo. Registré "${parsed.title}" por ${formatCurrency(parsed.amount)}, vence el ${parsed.dueDate}. Te avisaré por ${reminders.join(', ') || 'la app'}.`
    );
  }, 600);
}

function simulatePhotoExtraction() {
  const samplesByCountry = {
    CO: [
      { provider: 'Enel Colombia', amount: 92500, dueDate: '2026-06-18', category: 'servicios' },
      { provider: 'Claro Colombia', amount: 48900, dueDate: '2026-06-22', category: 'telefonia' },
      { provider: 'Bancolombia - Tarjeta', amount: 320000, dueDate: '2026-06-25', category: 'tarjeta' },
    ],
    MX: [
      { provider: 'CFE', amount: 925.5, dueDate: '2026-06-18', category: 'servicios' },
      { provider: 'Telmex', amount: 489.9, dueDate: '2026-06-22', category: 'telefonia' },
      { provider: 'BBVA - Tarjeta', amount: 3200, dueDate: '2026-06-25', category: 'tarjeta' },
    ],
    US: [
      { provider: 'Pacific Gas & Electric', amount: 92.5, dueDate: '2026-06-18', category: 'servicios' },
      { provider: 'Comcast', amount: 48.9, dueDate: '2026-06-22', category: 'telefonia' },
      { provider: 'Chase - Tarjeta', amount: 320, dueDate: '2026-06-25', category: 'tarjeta' },
    ],
  };
  const samples = samplesByCountry[selectedCountry] || samplesByCountry[DEFAULT_COUNTRY];
  return samples[Math.floor(Math.random() * samples.length)];
}

let cameraStream = null;

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth <= 1024);
}

function isNativeCapacitor() {
  return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform?.();
}

function dataUrlToFile(dataUrl, filename) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

function showPhotoCameraError(message) {
  const errorEl = document.getElementById('photoCameraError');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
  showToast(message);
}

function clearPhotoCameraError() {
  document.getElementById('photoCameraError')?.classList.add('hidden');
}

function stopCameraStream() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  const video = document.getElementById('cameraVideo');
  if (video) video.srcObject = null;
}

function closeCameraPreview() {
  stopCameraStream();
  document.getElementById('cameraModal')?.classList.add('hidden');
  document.getElementById('cameraModalError')?.classList.add('hidden');
}

function handleCameraAccessError(err, { useCaptureFallback = true } = {}) {
  const errorName = err?.name || err?.code || '';
  let message = 'No se pudo acceder a la cámara. Usa la galería como alternativa.';

  if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
    message = 'Permiso de cámara denegado. Usa la galería como alternativa.';
  } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
    message = 'No se encontró ninguna cámara. Usa la galería como alternativa.';
  }

  showPhotoCameraError(message);

  if (useCaptureFallback && uploadMode === 'photo') {
    triggerCameraInput();
  }
}

async function tryCapacitorCamera() {
  if (!isNativeCapacitor()) return null;

  const cap = window.Capacitor;
  const cameraPlugin = cap?.Plugins?.Camera;
  if (!cameraPlugin?.getPhoto) return null;
  if (cap.isPluginAvailable && !cap.isPluginAvailable('Camera')) return null;

  const photo = await cameraPlugin.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: 'dataUrl',
    source: 'CAMERA',
    direction: 'REAR',
  });

  if (!photo?.dataUrl) return null;
  return dataUrlToFile(photo.dataUrl, `factura-${Date.now()}.jpg`);
}

async function openCameraPreview() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraVideo');
  const modalError = document.getElementById('cameraModalError');

  if (!modal || !video || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('unsupported');
  }

  modalError?.classList.add('hidden');
  modal.classList.remove('hidden');

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    video.srcObject = cameraStream;
    await video.play();
  } catch (err) {
    closeCameraPreview();
    throw err;
  }
}

function triggerCameraInput() {
  const input = document.getElementById('photoInputCamera');
  if (!input) return;
  input.value = '';
  input.click();
}

function triggerGalleryInput() {
  const input = document.getElementById('photoInputGallery');
  if (!input) return;
  input.value = '';
  input.click();
}

function triggerInvoiceInput() {
  const input = document.getElementById('invoiceInput');
  if (!input) return;
  input.value = '';
  input.click();
}

async function startTakePhotoFlow() {
  if (uploadMode !== 'photo') return;

  clearPhotoCameraError();

  if (isNativeCapacitor()) {
    try {
      const file = await tryCapacitorCamera();
      if (file) {
        handleUploadFile(file);
        return;
      }
    } catch (err) {
      handleCameraAccessError(err, { useCaptureFallback: true });
      return;
    }
  }

  if (navigator.mediaDevices?.getUserMedia) {
    try {
      await openCameraPreview();
      return;
    } catch (err) {
      if (isMobileDevice()) {
        triggerCameraInput();
        return;
      }
      handleCameraAccessError(err, { useCaptureFallback: false });
      return;
    }
  }

  triggerCameraInput();
}

function capturePhotoFromPreview() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraCanvas');
  if (!video || !canvas || !video.videoWidth) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  canvas.toBlob((blob) => {
    if (!blob) {
      showPhotoCameraError('No se pudo capturar la foto. Intenta de nuevo.');
      return;
    }
    const file = new File([blob], `factura-${Date.now()}.jpg`, { type: 'image/jpeg' });
    closeCameraPreview();
    handleUploadFile(file);
  }, 'image/jpeg', 0.92);
}

function setupUploadModal() {
  const isInvoice = uploadMode === 'invoice';
  const captureActions = document.getElementById('photoCaptureActions');

  document.getElementById('photoModalEyebrow').textContent = isInvoice
    ? 'Registro por factura'
    : 'Registro por foto';
  document.getElementById('photoModalTitle').textContent = isInvoice
    ? 'Sube tu factura'
    : 'Escanea tu factura';
  document.getElementById('photoPlaceholderIcon').textContent = isInvoice ? '📄' : '📷';
  document.getElementById('photoPlaceholderText').textContent = isInvoice
    ? 'Arrastra un PDF o imagen, o toca para seleccionar'
    : 'Arrastra una imagen aquí o usa los botones de abajo';
  document.getElementById('photoPlaceholderHint').textContent = isInvoice
    ? 'Formatos: PDF, JPG, PNG y otros formatos de imagen'
    : 'Soporta facturas de servicios, tarjetas y créditos';

  captureActions?.classList.toggle('hidden', isInvoice);
  const dropzone = document.getElementById('photoDropzone');
  dropzone?.classList.toggle('photo-dropzone--invoice', isInvoice);
  dropzone?.classList.toggle('photo-dropzone--camera', !isInvoice);
}

function isPdfFile(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function setPhotoExtracting(loading) {
  const loadingEl = document.getElementById('photoExtracting');
  const extractedEl = document.getElementById('photoExtracted');
  const confirmBtn = document.getElementById('photoConfirm');

  if (loadingEl) loadingEl.classList.toggle('hidden', !loading);
  if (loading) {
    extractedEl?.classList.add('hidden');
    if (confirmBtn) confirmBtn.disabled = true;
  }
}

function formatConfidencePct(value) {
  const pct = Math.round((Number(value) || 0) * 100);
  return `${pct}%`;
}

function setFieldConfidence(elId, score) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (score == null || Number.isNaN(score)) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  const pct = formatConfidencePct(score);
  el.textContent = `Confianza: ${pct}`;
  el.classList.remove('hidden');
  el.classList.toggle('field-confidence--low', score < 0.5);
  el.classList.toggle('field-confidence--high', score >= 0.7);
}

function applyExtractedData(extracted, sourceNote) {
  const categorySelect = document.getElementById('photoCategory');
  const title = extracted.title || extracted.provider || '';
  document.getElementById('photoTitle').value = title;
  document.getElementById('photoProvider').value = extracted.provider || '';
  document.getElementById('photoAmount').value = extracted.amount || '';
  document.getElementById('photoDueDate').value = extracted.dueDate || '';
  document.getElementById('photoInvoiceNumber').value = extracted.invoice_number || '';
  if (categorySelect && extracted.category) {
    categorySelect.value = extracted.category;
  }

  const fc = extracted.fieldConfidence || {};
  setFieldConfidence('photoAmountConf', fc.amount);
  setFieldConfidence('photoDueDateConf', fc.dueDate);

  const confWrap = document.getElementById('photoConfidence');
  const confFill = document.getElementById('photoConfidenceFill');
  const confPct = document.getElementById('photoConfidencePct');
  const confBar = confWrap?.querySelector('.photo-confidence-bar');
  if (confWrap && extracted.confidence != null) {
    const pct = Math.round(extracted.confidence * 100);
    confFill.style.width = `${pct}%`;
    confPct.textContent = formatConfidencePct(extracted.confidence);
    if (confBar) {
      confBar.setAttribute('aria-valuenow', String(pct));
      confBar.setAttribute('aria-valuetext', `${pct} por ciento`);
    }
    confWrap.classList.remove('hidden');
  } else {
    confWrap?.classList.add('hidden');
  }

  const noteEl = document.getElementById('photoExtractNote');
  if (noteEl) {
    const parts = [];
    if (sourceNote) parts.push(sourceNote);
    if (extracted.source) {
      const sourceLabels = {
        gemini: 'Google Gemini',
        openai: 'OpenAI Vision',
        tesseract: 'OCR local (Tesseract)',
        mock: 'Datos simulados',
        custom: 'API personalizada',
      };
      parts.push(`Fuente: ${sourceLabels[extracted.source] || extracted.source}`);
    }
    if (extracted.currency && extracted.currency !== 'COP') {
      parts.push(`Moneda: ${extracted.currency}`);
    }
    const note = parts.filter(Boolean).join(' · ');
    if (note) {
      noteEl.textContent = note;
      noteEl.classList.remove('hidden');
    } else {
      noteEl.classList.add('hidden');
    }
  }

  document.getElementById('photoExtracted').classList.remove('hidden');
  document.getElementById('photoConfirm').disabled = false;
}

async function showExtractedData(file) {
  setPhotoExtracting(true);

  let extracted = null;
  let sourceNote = null;
  const syncAvailable = window.VencelySync?.isSyncEnabled?.() && navigator.onLine;

  if (file && syncAvailable && window.VencelySync?.extractInvoiceFromFile) {
    const result = await window.VencelySync.extractInvoiceFromFile(file, selectedCountry);
    extracted = result?.extracted || result;
    if (extracted?.source === 'mock') {
      sourceNote = extracted.note;
    } else if (extracted) {
      sourceNote = 'Datos extraídos por el servicio en la nube. Revisa antes de guardar.';
    }
  } else if (file && !navigator.onLine) {
    sourceNote = 'Sin conexión. Conecta a internet para extraer datos reales de la factura.';
  } else if (file && !window.VencelySync?.isSyncEnabled?.()) {
    sourceNote = 'API no configurada. Configura sync-config.js o usa Docker/LAN para extracción automática.';
  }

  if (!extracted) {
    if (!syncAvailable) {
      extracted = simulatePhotoExtraction();
      if (!sourceNote) {
        sourceNote = 'Modo local: extracción simulada. Conecta el API para OCR real.';
      }
    } else {
      extracted = simulatePhotoExtraction();
      sourceNote = sourceNote || 'El API no respondió. Datos simulados — revisa manualmente.';
    }
  }

  setPhotoExtracting(false);
  applyExtractedData(extracted, sourceNote);
}

function resetPhotoModal() {
  photoFile = null;
  closeCameraPreview();
  clearPhotoCameraError();
  document.getElementById('photoPreview').classList.add('hidden');
  document.getElementById('pdfPreview').classList.add('hidden');
  document.getElementById('photoPlaceholder').classList.remove('hidden');
  document.getElementById('photoExtracted').classList.add('hidden');
  document.getElementById('photoExtracting')?.classList.add('hidden');
  document.getElementById('photoExtractNote')?.classList.add('hidden');
  document.getElementById('photoConfirm').disabled = true;
  document.getElementById('photoInputCamera').value = '';
  document.getElementById('photoInputGallery').value = '';
  document.getElementById('invoiceInput').value = '';
}

function handleUploadFile(file) {
  if (!file) return;

  const isPdf = isPdfFile(file);
  const isImage = file.type.startsWith('image/');
  if (!isImage && !isPdf) return;
  if (uploadMode === 'photo' && !isImage) return;

  photoFile = file;
  const preview = document.getElementById('photoPreview');
  const pdfPreview = document.getElementById('pdfPreview');
  const placeholder = document.getElementById('photoPlaceholder');

  if (isPdf) {
    preview.classList.add('hidden');
    pdfPreview.classList.remove('hidden');
    document.getElementById('pdfFileName').textContent = file.name;
    placeholder.classList.add('hidden');
    showExtractedData(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.classList.remove('hidden');
    pdfPreview.classList.add('hidden');
    placeholder.classList.add('hidden');
    showExtractedData(file);
  };
  reader.readAsDataURL(file);
}

function loadSettings() {
  toggleWhatsapp.checked = settings.whatsapp;
  toggleEmail.checked = settings.email;
  toggleChat.checked = settings.chat;
  firstAlert.value = settings.firstAlert;
  finalAlert.value = settings.finalAlert;
  sendHour.value = settings.sendHour;
  repeatIfNotPaid.checked = settings.repeatIfNotPaid;
  populateCountrySelect();
  updateCurrencyLabels();
}

function attachSettingsListeners() {
  toggleWhatsapp.addEventListener('change', () => {
    settings.whatsapp = toggleWhatsapp.checked;
    updateReminderSummary();
    if (settings.whatsapp && typeof getCurrentUser === 'function') {
      const user = getCurrentUser();
      if (user && !user.phone) {
        showToast('Agrega tu celular abajo para recibir recordatorios por WhatsApp.');
        whatsappPhoneInput?.focus();
      }
    }
  });
  toggleEmail.addEventListener('change', () => {
    settings.email = toggleEmail.checked;
    updateReminderSummary();
  });
  toggleChat.addEventListener('change', () => {
    settings.chat = toggleChat.checked;
    updateReminderSummary();
  });
  firstAlert.addEventListener('change', () => { settings.firstAlert = firstAlert.value; });
  finalAlert.addEventListener('change', () => { settings.finalAlert = finalAlert.value; });
  sendHour.addEventListener('change', () => { settings.sendHour = sendHour.value; });
  repeatIfNotPaid.addEventListener('change', () => { settings.repeatIfNotPaid = repeatIfNotPaid.checked; });
  btnSaveWhatsappPhone?.addEventListener('click', () => {
    const phone = whatsappPhoneInput?.value?.trim() || '';
    if (typeof updateUserPhone !== 'function') return;
    const result = updateUserPhone(phone);
    if (result.ok) {
      showToast(`✓ Celular guardado: ${formatPhoneDisplay(result.phone)}`);
    } else {
      showToast(result.error || 'No se pudo guardar el celular.');
    }
  });
  whatsappPhoneInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnSaveWhatsappPhone?.click();
    }
  });
  if (countrySelect) {
    countrySelect.addEventListener('change', () => {
      selectedCountry = countrySelect.value;
      saveCountry();
      updateCurrencyLabels();
      refreshAll();
      showToast(`✓ Moneda actualizada a ${getCurrencyCode()}`);
    });
  }
}

document.getElementById('btnSaveProfileName')?.addEventListener('click', () => {
  const name = document.getElementById('profileNameInput')?.value?.trim() || '';
  if (typeof updateUserName !== 'function') return;
  const result = updateUserName(name);
  if (result.ok) {
    showToast('✓ Nombre actualizado');
    renderProfilePage();
  } else {
    showToast(result.error || 'No se pudo guardar el nombre.');
  }
});

document.getElementById('btnSaveProfilePhone')?.addEventListener('click', () => {
  const phone = document.getElementById('profilePhoneInput')?.value?.trim() || '';
  if (typeof updateUserPhone !== 'function') return;
  const result = updateUserPhone(phone);
  if (result.ok) {
    showToast(`✓ Celular guardado: ${formatPhoneDisplay(result.phone)}`);
    renderProfilePage();
  } else {
    showToast(result.error || 'No se pudo guardar el celular.');
  }
});

document.getElementById('profilePhoneInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('btnSaveProfilePhone')?.click();
  }
});

document.getElementById('profileNameInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('btnSaveProfileName')?.click();
  }
});

document.getElementById('btnProfileLogout')?.addEventListener('click', () => {
  if (typeof logout === 'function') logout();
});

document.querySelectorAll('[data-modal]').forEach((btn) => {
  btn.addEventListener('click', () => {
    closeRegisterSheet();
    openModal(btn.dataset.modal, { uploadMode: btn.dataset.uploadMode });
  });
});

document.querySelectorAll('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', closeAllModals);
});

Object.values(modals).forEach((modal) => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAllModals();
  });
});

document.querySelectorAll('[data-close-sheet]').forEach((btn) => {
  btn.addEventListener('click', closeRegisterSheet);
});

document.getElementById('fabRegister').addEventListener('click', openRegisterSheet);
document.getElementById('mobileFabRegister').addEventListener('click', openRegisterSheet);

document.querySelectorAll('.new-account').forEach((btn) => {
  btn.addEventListener('click', () => openModal('manual'));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const cameraModal = document.getElementById('cameraModal');
    if (cameraModal && !cameraModal.classList.contains('hidden')) {
      closeCameraPreview();
      return;
    }
    closeAllModals();
    closeRegisterSheet();
  }
});

const paymentTypeRadios = manualForm.querySelectorAll('[name="paymentType"]');
const recurrenceFields = document.getElementById('recurrenceFields');

paymentTypeRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    const isRecurrent = manualForm.querySelector('[name="paymentType"]:checked').value === 'recurrente';
    recurrenceFields.classList.toggle('hidden', !isRecurrent);
    manualForm.querySelectorAll('.segment').forEach((seg) => {
      seg.classList.toggle('active', seg.querySelector('input').checked);
    });
  });
});

manualForm.querySelectorAll('.segment').forEach((seg) => {
  seg.addEventListener('click', () => {
    manualForm.querySelectorAll('.segment').forEach((s) => s.classList.remove('active'));
    seg.classList.add('active');
  });
});

manualForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(manualForm);
  const reminders = [];
  if (fd.get('reminderWhatsapp')) reminders.push('WhatsApp');
  if (fd.get('reminderEmail')) reminders.push('Correo');
  if (fd.get('reminderChat')) reminders.push('Chat');

  addAccount({
    title: fd.get('title'),
    provider: fd.get('provider'),
    amount: fd.get('amount'),
    dueDate: fd.get('dueDate'),
    type: fd.get('paymentType') === 'recurrente' ? 'Recurrente' : 'Puntual',
    category: fd.get('category'),
    icon: fd.get('icon'),
    context: fd.get('context'),
    sedeId: fd.get('sedeId'),
    notes: fd.get('notes'),
    reminders: reminders.length ? reminders : ['Chat'],
  });

  manualForm.reset();
  recurrenceFields.classList.remove('hidden');
  closeAllModals();
});

const photoDropzone = document.getElementById('photoDropzone');
const photoInputCamera = document.getElementById('photoInputCamera');
const photoInputGallery = document.getElementById('photoInputGallery');
const invoiceInput = document.getElementById('invoiceInput');

photoDropzone.addEventListener('click', (e) => {
  if (e.target.closest('.photo-action-btn')) return;
  if (uploadMode === 'invoice') {
    triggerInvoiceInput();
    return;
  }
  if (!isMobileDevice()) {
    triggerGalleryInput();
  }
});

photoInputCamera.addEventListener('change', (e) => handleUploadFile(e.target.files[0]));
photoInputGallery.addEventListener('change', (e) => handleUploadFile(e.target.files[0]));
invoiceInput.addEventListener('change', (e) => handleUploadFile(e.target.files[0]));

document.getElementById('btnTakePhoto')?.addEventListener('click', (e) => {
  e.stopPropagation();
  startTakePhotoFlow();
});

document.getElementById('btnPickGallery')?.addEventListener('click', (e) => {
  e.stopPropagation();
  clearPhotoCameraError();
  triggerGalleryInput();
});

document.getElementById('cameraCapture')?.addEventListener('click', capturePhotoFromPreview);
document.getElementById('cameraCancel')?.addEventListener('click', closeCameraPreview);
document.getElementById('cameraModalClose')?.addEventListener('click', closeCameraPreview);
document.getElementById('cameraModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'cameraModal') closeCameraPreview();
});

photoDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  photoDropzone.classList.add('dragover');
});
photoDropzone.addEventListener('dragleave', () => photoDropzone.classList.remove('dragover'));
photoDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  photoDropzone.classList.remove('dragover');
  handleUploadFile(e.dataTransfer.files[0]);
});

document.getElementById('photoConfirm').addEventListener('click', () => {
  const title = document.getElementById('photoTitle')?.value?.trim();
  const provider = document.getElementById('photoProvider').value;
  const amount = document.getElementById('photoAmount').value;
  const dueDate = document.getElementById('photoDueDate').value;
  const invoiceNumber = document.getElementById('photoInvoiceNumber')?.value?.trim();

  const reminders = [];
  if (settings.whatsapp) reminders.push('WhatsApp');
  if (settings.email) reminders.push('Correo');
  if (settings.chat) reminders.push('Chat');

  const isPdf = photoFile && isPdfFile(photoFile);

  const photoSede = document.getElementById('photoSede');

  const category = document.getElementById('photoCategory')?.value || 'servicios';

  addAccount({
    title: title || provider,
    provider,
    amount,
    dueDate,
    type: 'Puntual',
    category,
    icon: isPdf ? '📄' : '📷',
    reminders: reminders.length ? reminders : ['Chat'],
    context: 'hogar',
    sedeId: photoSede?.value || (selectedSedeFilter !== 'all' ? selectedSedeFilter : getDefaultSedeId()),
    notes: invoiceNumber ? `Factura: ${invoiceNumber}` : '',
  });

  resetPhotoModal();
  closeAllModals();
});

modals.photo.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-close') || e.target.dataset.closeModal !== undefined) {
    resetPhotoModal();
  }
});

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleChatSubmit(chatInput.value);
  chatInput.value = '';
});

document.querySelectorAll('.suggestion-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    handleChatSubmit(chip.dataset.suggestion);
  });
});

accountSearch.addEventListener('input', (e) => {
  const activeTab = document.querySelector('.tab-button.active').dataset.filter;
  renderAccounts(activeTab, e.target.value);
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    renderAccounts(button.dataset.filter, accountSearch.value);
  });
});

categoryChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    categoryChips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    activeCategoryFilter = chip.dataset.category;
    const activeTab = document.querySelector('.tab-button.active').dataset.filter;
    renderAccounts(activeTab, accountSearch.value);
  });
});

calendarGrid.addEventListener('click', (e) => {
  const eventEl = e.target.closest('.calendar-event[data-account-id]');
  if (!eventEl) return;
  handleCalendarEventActivate(eventEl);
});

calendarGrid.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const eventEl = e.target.closest('.calendar-event[data-account-id]');
  if (!eventEl) return;
  e.preventDefault();
  handleCalendarEventActivate(eventEl);
});

document.getElementById('prevMonth').addEventListener('click', () => {
  calendarMonth -= 1;
  if (calendarMonth < 0) { calendarMonth = 11; calendarYear -= 1; }
  renderCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  calendarMonth += 1;
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear += 1; }
  renderCalendar();
});

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((err) => console.warn('Service worker no registrado:', err));
  });
}

window.VencelyData = {
  getAccounts: () => accounts,
  getSedes: () => sedes,
  setAccounts: (nextAccounts, options = {}) => {
    accounts = nextAccounts;
    saveAccounts(options);
    refreshAll();
  },
  setSedes: (nextSedes, options = {}) => {
    sedes = nextSedes;
    saveSedes(options);
    populateSedeSelects();
    renderSedeSwitcher();
    renderSedesManager();
    refreshAll();
  },
  onSyncComplete: () => refreshAll(),
};

function bootstrapApp() {
  if (bootstrapApp._ran) return;
  bootstrapApp._ran = true;

  loadFromStorage();
  loadSettings();
  attachSettingsListeners();
  populateSedeSelects();
  renderSedesManager();
  if (sedeForm) sedeForm.addEventListener('submit', saveSedeFromForm);
  document.getElementById('btnAddSede')?.addEventListener('click', () => openSedeModal());
  refreshAll();
  registerServiceWorker();
  if (typeof updateUserProfileUI === 'function') updateUserProfileUI();
  window.VencelySync?.initSync?.();
}

window.onAuthSuccess = bootstrapApp;
window.renderProfilePage = renderProfilePage;
window.getUserPlanLabel = getUserPlanLabel;

function initAppRouting() {
  normalizeAppPathRoute();
  window.addEventListener('hashchange', handleAppHashRoute);
  const pageFromHash = getPageFromHash();
  if (pageFromHash !== 'dashboard') {
    switchPage(pageFromHash, { updateHash: false });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  attachNavigationListeners();
  initAppRouting();
  if (typeof getCurrentUser === 'function' && getCurrentUser()) {
    bootstrapApp();
  }
});
