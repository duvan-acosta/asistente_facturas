require('dotenv').config();

const bcrypt = require('bcrypt');
const { initDb } = require('../server/db/init');
const { query, closePool } = require('../server/db/connection');
const { hashAdminPassword } = require('../server/middleware/adminAuth');

const DEMO_CLIENT = {
  id: 'email_maria_vencely',
  email: 'maria@vencely.app',
  password: 'cliente123',
  name: 'María García',
  phone: '+573001234567',
  provider: 'email',
};

const DEMO_ACCOUNTS = [
  {
    id: '1',
    title: 'Luz Hogar',
    provider: 'Enel',
    amount: 85000,
    dueDate: '2026-06-14',
    type: 'Recurrente',
    category: 'servicios',
    status: 'por-vencer',
    reminders: ['WhatsApp', 'Correo'],
    icon: '⚡',
    context: 'hogar',
    sedeId: 's1',
  },
  {
    id: '2',
    title: 'Visa Platinum',
    provider: 'Banco Empresa',
    amount: 950000,
    dueDate: '2026-06-15',
    type: 'Puntual',
    category: 'tarjeta',
    status: 'por-vencer',
    reminders: ['WhatsApp'],
    icon: '💳',
    context: 'empresa',
    sedeId: 's2',
  },
  {
    id: '3',
    title: 'Internet & TV',
    provider: 'Claro',
    amount: 45500,
    dueDate: '2026-06-17',
    type: 'Recurrente',
    category: 'telefonia',
    status: 'pendiente',
    reminders: ['Correo'],
    icon: '📶',
    context: 'hogar',
    sedeId: 's1',
  },
  {
    id: '4',
    title: 'Agua Potable',
    provider: 'Aguas de la Ciudad',
    amount: 32800,
    dueDate: '2026-06-10',
    type: 'Recurrente',
    category: 'servicios',
    status: 'vencido',
    reminders: ['WhatsApp', 'Chat'],
    icon: '💧',
    context: 'hogar',
    sedeId: 's1',
  },
];

const DEMO_SEDES = [
  { id: 's1', name: 'Casa principal', icon: '🏠', type: 'hogar' },
  { id: 's2', name: 'Oficina', icon: '🏢', type: 'empresa' },
];

async function seedDemoClient() {
  await initDb();

  const existing = await query('SELECT id FROM users WHERE id = $1 OR email = $2', [
    DEMO_CLIENT.id,
    DEMO_CLIENT.email,
  ]);

  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(DEMO_CLIENT.password, 10);

  if (existing.rows.length === 0) {
    await query(
      `INSERT INTO users (id, email, password_hash, name, phone, provider)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [DEMO_CLIENT.id, DEMO_CLIENT.email, passwordHash, DEMO_CLIENT.name, DEMO_CLIENT.phone, 'email']
    );
    console.log(`Demo client seeded: ${DEMO_CLIENT.email}`);
  } else {
    console.log(`Demo client ready: ${DEMO_CLIENT.email}`);
  }

  const { saveAccounts, saveSedes } = require('../server/services/db');
  await saveSedes(
    DEMO_CLIENT.id,
    DEMO_SEDES.map((s) => ({ ...s, updatedAt: now }))
  );
  await saveAccounts(
    DEMO_CLIENT.id,
    DEMO_ACCOUNTS.map((a) => ({ ...a, updatedAt: now }))
  );

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@vencely.app').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  await query(
    `INSERT INTO admin_users (email, password_hash, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    [adminEmail, hashAdminPassword(adminPassword), 'Administrador']
  );

  console.log(`Admin ready: ${adminEmail}`);
}

seedDemoClient()
  .catch((err) => {
    console.error('Seed error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
