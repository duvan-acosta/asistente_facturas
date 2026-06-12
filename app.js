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

let accounts = [
  { id: '1', title: 'Luz Hogar', provider: 'Enel', amount: 85.0, dueDate: '2026-06-14', type: 'Recurrente', category: 'servicios', status: 'por-vencer', reminders: ['WhatsApp', 'Correo'], icon: '⚡', context: 'hogar' },
  { id: '2', title: 'Visa Platinum', provider: 'Banco Empresa', amount: 950.0, dueDate: '2026-06-15', type: 'Puntual', category: 'tarjeta', status: 'pendiente', reminders: ['WhatsApp'], icon: '💳', context: 'empresa' },
  { id: '3', title: 'Internet & TV', provider: 'Claro', amount: 45.5, dueDate: '2026-06-17', type: 'Recurrente', category: 'telefonia', status: 'pendiente', reminders: ['Correo'], icon: '📶', context: 'hogar' },
  { id: '4', title: 'Agua Potable', provider: 'Aguas de la Ciudad', amount: 32.8, dueDate: '2026-06-10', type: 'Recurrente', category: 'servicios', status: 'vencido', reminders: ['WhatsApp', 'Chat'], icon: '💧', context: 'hogar' },
  { id: '5', title: 'Crédito Vehículo', provider: 'Banco del Sur', amount: 420.0, dueDate: '2026-06-20', type: 'Recurrente', category: 'credito', status: 'programado', reminders: ['Correo'], icon: '🚗', context: 'hogar' },
  { id: '6', title: 'Tarjeta Pyme', provider: 'Banco Empresarial', amount: 350.0, dueDate: '2026-06-22', type: 'Puntual', category: 'tarjeta', status: 'pendiente', reminders: ['Chat'], icon: '🏦', context: 'empresa' },
  { id: '7', title: 'Gas Natural', provider: 'GasSur', amount: 60.0, dueDate: '2026-06-18', type: 'Recurrente', category: 'servicios', status: 'pendiente', reminders: ['WhatsApp'], icon: '🔥', context: 'hogar' },
  { id: '8', title: 'Seguro Hogar', provider: 'Segura', amount: 68.2, dueDate: '2026-06-25', type: 'Puntual', category: 'otro', status: 'programado', reminders: ['Correo', 'Chat'], icon: '🛡️', context: 'hogar' },
];

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
const firstAlert = document.getElementById('firstAlert');
const finalAlert = document.getElementById('finalAlert');
const sendHour = document.getElementById('sendHour');
const repeatIfNotPaid = document.getElementById('repeatIfNotPaid');
const reminderStatus = document.getElementById('reminderStatus');
const activeReminderChips = document.getElementById('activeReminderChips');

const modals = {
  manual: document.getElementById('modalManual'),
  photo: document.getElementById('modalPhoto'),
  bot: document.getElementById('modalBot'),
};

const registerSheet = document.getElementById('registerSheet');
const manualForm = document.getElementById('manualForm');
const toast = document.getElementById('toast');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function switchPage(pageId) {
  pages.forEach((page) => page.classList.toggle('active-page', page.id === pageId));
  document.querySelectorAll('.nav-link, .bottom-nav-item').forEach((link) => {
    if (link.dataset.page) {
      link.classList.toggle('active', link.dataset.page === pageId);
    }
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

function openModal(name) {
  closeRegisterSheet();
  const modal = modals[name];
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  if (name === 'bot') initChat();
  if (name === 'manual') {
    const dueInput = manualForm.querySelector('[name="dueDate"]');
    if (!dueInput.value) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      dueInput.value = nextWeek.toISOString().slice(0, 10);
    }
  }
}

function closeAllModals() {
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

function formatCurrency(value) {
  return `US$ ${Number(value).toFixed(2)}`;
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
  renderDashboard();
  const activeTab = document.querySelector('.tab-button.active')?.dataset.filter || 'all';
  renderAccounts(activeTab, accountSearch.value);
  renderCalendar();
  updateReminderSummary();
}

function renderDashboard() {
  const pending = accounts.filter((a) => a.status !== 'pagado');
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
    item.className = 'payment-item';
    item.innerHTML = `
      <div class="payment-item-header">
        <div>
          <h3>${payment.icon || ''} ${payment.title}</h3>
          <div class="payment-meta">
            <span>${payment.provider}</span>
            <span class="category-badge">${CATEGORY_LABELS[payment.category] || payment.category}</span>
            <span>${payment.type}</span>
            <span>Vence: ${payment.dueDate}</span>
          </div>
        </div>
        <span class="status-pill ${getStatusClass(payment.status)}">${getStatusLabel(payment.status)}</span>
      </div>
      <div class="payment-meta">
        <span>${formatCurrency(payment.amount)}</span>
        <span>🔔 ${payment.reminders.join(', ')}</span>
      </div>
    `;
    paymentList.appendChild(item);
  });
}

function renderAccounts(filter = 'all', query = '') {
  const filtered = accounts.filter((account) => {
    const q = query.toLowerCase();
    const matchesQuery =
      account.title.toLowerCase().includes(q) ||
      account.provider.toLowerCase().includes(q);
    const matchesFilter = filter === 'all' || account.status === filter;
    const matchesCategory =
      activeCategoryFilter === 'all' || account.category === activeCategoryFilter;
    return matchesQuery && matchesFilter && matchesCategory;
  });

  const pending = accounts.filter((a) => a.status !== 'pagado');
  accountCount.textContent = accounts.length;
  accountTotal.textContent = pending.reduce((sum, a) => sum + a.amount, 0).toFixed(2);
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
    card.className = 'account-card';
    card.innerHTML = `
      <div class="account-card-header">
        <div class="account-detail">
          <span class="account-provider"><span class="account-icon">${account.icon || '📄'}</span>${account.title}</span>
          <p>${account.provider} · ${account.type} · ${CATEGORY_LABELS[account.category] || ''}</p>
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
  accounts.forEach((a) => {
    const d = new Date(a.dueDate + 'T00:00:00');
    if (d.getMonth() === calendarMonth && d.getFullYear() === calendarYear) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push({ label: a.title, type: getStatusClass(a.status) });
    }
  });

  for (let i = 0; i < firstDay; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day other-month';
    calendarGrid.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = document.createElement('div');
    const isToday =
      day === today.getDate() &&
      calendarMonth === today.getMonth() &&
      calendarYear === today.getFullYear();

    cell.className = 'calendar-day' + (isToday ? ' today' : '');
    const dayLabel = document.createElement('span');
    dayLabel.textContent = day;
    cell.appendChild(dayLabel);

    const events = eventsByDay[day] || [];
    if (events.length) cell.classList.add('has-events');

    events.forEach((event) => {
      const badge = document.createElement('div');
      badge.className = `calendar-event ${event.type}`;
      badge.textContent = event.label;
      badge.title = event.label;
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
  const account = {
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
    notes: data.notes || '',
  };
  accounts.unshift(account);
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

  const amountMatch = text.match(/\$?\s*(\d+(?:[.,]\d{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0;

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
  appendChatMessage(
    'bot',
    '¡Hola! Soy tu asistente de cuentas por pagar. Cuéntame el pago que quieres registrar, por ejemplo: "Agregar luz Enel $85, vence el 15 de junio".'
  );
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
      appendChatMessage('bot', 'No detecté el monto. ¿Puedes incluir el valor? Ej: "$85" o "85 dólares".');
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
    });

    appendChatMessage(
      'bot',
      `Listo. Registré "${parsed.title}" por ${formatCurrency(parsed.amount)}, vence el ${parsed.dueDate}. Te avisaré por ${reminders.join(', ') || 'la app'}.`
    );
  }, 600);
}

function simulatePhotoExtraction() {
  const samples = [
    { provider: 'Enel Colombia', amount: 92.5, dueDate: '2026-06-18' },
    { provider: 'Claro Colombia', amount: 48.9, dueDate: '2026-06-22' },
    { provider: 'Bancolombia - Tarjeta', amount: 320.0, dueDate: '2026-06-25' },
  ];
  return samples[Math.floor(Math.random() * samples.length)];
}

function resetPhotoModal() {
  photoFile = null;
  document.getElementById('photoPreview').classList.add('hidden');
  document.getElementById('photoPlaceholder').classList.remove('hidden');
  document.getElementById('photoExtracted').classList.add('hidden');
  document.getElementById('photoConfirm').disabled = true;
  document.getElementById('photoInput').value = '';
}

function handlePhotoFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  photoFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('photoPreview');
    preview.src = e.target.result;
    preview.classList.remove('hidden');
    document.getElementById('photoPlaceholder').classList.add('hidden');

    const extracted = simulatePhotoExtraction();
    document.getElementById('photoProvider').value = extracted.provider;
    document.getElementById('photoAmount').value = extracted.amount;
    document.getElementById('photoDueDate').value = extracted.dueDate;
    document.getElementById('photoExtracted').classList.remove('hidden');
    document.getElementById('photoConfirm').disabled = false;
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
}

function attachSettingsListeners() {
  toggleWhatsapp.addEventListener('change', () => {
    settings.whatsapp = toggleWhatsapp.checked;
    updateReminderSummary();
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
}

document.querySelectorAll('[data-page]').forEach((el) => {
  el.addEventListener('click', () => {
    if (el.dataset.page) switchPage(el.dataset.page);
  });
});

document.querySelectorAll('[data-modal]').forEach((btn) => {
  btn.addEventListener('click', () => {
    closeRegisterSheet();
    openModal(btn.dataset.modal);
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
    notes: fd.get('notes'),
    reminders: reminders.length ? reminders : ['Chat'],
  });

  manualForm.reset();
  recurrenceFields.classList.remove('hidden');
  closeAllModals();
});

const photoDropzone = document.getElementById('photoDropzone');
const photoInput = document.getElementById('photoInput');

photoDropzone.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', (e) => handlePhotoFile(e.target.files[0]));

photoDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  photoDropzone.classList.add('dragover');
});
photoDropzone.addEventListener('dragleave', () => photoDropzone.classList.remove('dragover'));
photoDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  photoDropzone.classList.remove('dragover');
  handlePhotoFile(e.dataTransfer.files[0]);
});

document.getElementById('photoConfirm').addEventListener('click', () => {
  const provider = document.getElementById('photoProvider').value;
  const amount = document.getElementById('photoAmount').value;
  const dueDate = document.getElementById('photoDueDate').value;

  const reminders = [];
  if (settings.whatsapp) reminders.push('WhatsApp');
  if (settings.email) reminders.push('Correo');
  if (settings.chat) reminders.push('Chat');

  addAccount({
    title: provider,
    provider,
    amount,
    dueDate,
    type: 'Puntual',
    category: 'servicios',
    icon: '📷',
    reminders: reminders.length ? reminders : ['Chat'],
    context: 'hogar',
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

loadSettings();
attachSettingsListeners();
refreshAll();
