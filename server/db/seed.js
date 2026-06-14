const bcrypt = require('bcrypt');
const { query, withTransaction } = require('./connection');
const { hashAdminPassword } = require('../middleware/adminAuth');

const BCRYPT_ROUNDS = 10;

const DEMO_CLIENT = {
  id: 'email_maria_vencely',
  email: 'maria@vencely.app',
  password: 'cliente123',
  name: 'María García',
  phone: '+573001234567',
  provider: 'email',
  country: 'CO',
  currency: 'COP',
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

function accountToRow(userId, acc, now) {
  const updatedAt = acc.updatedAt || now;
  return {
    id: acc.id,
    userId,
    sedeId: acc.sedeId || null,
    name: acc.title || acc.name || 'Cuenta',
    provider: acc.provider || '',
    amount: Number(acc.amount) || 0,
    dueDate: acc.dueDate || null,
    status: acc.status || 'pendiente',
    category: acc.category || '',
    frequency: acc.type || acc.frequency || '',
    context: acc.context || 'hogar',
    notes: acc.notes || '',
    extra: {
      icon: acc.icon,
      reminders: acc.reminders,
      type: acc.type,
      updatedAt,
    },
    updatedAt,
  };
}

async function upsertUserRecord(client, profile) {
  const now = new Date().toISOString();
  const id = profile.id || profile.email;
  await client.query(
    `INSERT INTO users (id, email, password_hash, name, phone, google_id, avatar_url, country, currency, plan, provider, metadata, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
       name = EXCLUDED.name,
       phone = EXCLUDED.phone,
       google_id = COALESCE(NULLIF(EXCLUDED.google_id, ''), users.google_id),
       avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), users.avatar_url),
       country = EXCLUDED.country,
       currency = EXCLUDED.currency,
       plan = EXCLUDED.plan,
       provider = EXCLUDED.provider,
       metadata = users.metadata || EXCLUDED.metadata,
       updated_at = EXCLUDED.updated_at`,
    [
      id,
      (profile.email || '').toLowerCase(),
      profile.passwordHash || null,
      profile.name || 'Usuario',
      profile.phone || '',
      profile.googleId || profile.google_id || '',
      profile.avatarUrl || profile.picture || profile.avatar_url || '',
      profile.country || 'CO',
      profile.currency || 'COP',
      profile.plan || 'free',
      profile.provider || 'email',
      JSON.stringify(profile.metadata || {}),
      now,
    ]
  );

  await client.query(
    `INSERT INTO user_profiles (user_id, whatsapp, locale, timezone)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO NOTHING`,
    [id, profile.whatsapp || profile.phone || '', 'es-CO', 'America/Bogota']
  );

  return id;
}

async function saveSedesForUser(client, userId, sedes, now) {
  await client.query('DELETE FROM sedes WHERE user_id = $1', [userId]);
  for (const sede of sedes) {
    const updatedAt = sede.updatedAt || now;
    await client.query(
      `INSERT INTO sedes (id, user_id, name, icon, type, extra, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sede.id,
        userId,
        sede.name,
        sede.icon || '🏠',
        sede.type || (sede.context === 'empresa' ? 'empresa' : 'hogar'),
        JSON.stringify({ updatedAt }),
        updatedAt,
      ]
    );
  }
}

async function saveAccountsForUser(client, userId, accounts, now) {
  await client.query('DELETE FROM accounts WHERE user_id = $1', [userId]);
  for (const acc of accounts) {
    const row = accountToRow(userId, acc, now);
    await client.query(
      `INSERT INTO accounts (id, user_id, sede_id, name, provider, amount, due_date, status, category, frequency, context, notes, extra, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        row.id,
        row.userId,
        row.sedeId,
        row.name,
        row.provider,
        row.amount,
        row.dueDate,
        row.status,
        row.category,
        row.frequency,
        row.context,
        row.notes,
        JSON.stringify(row.extra),
        row.updatedAt,
      ]
    );
  }
}

async function seedIfEmpty() {
  const usersCount = await query('SELECT COUNT(*)::int AS count FROM users');
  if (usersCount.rows[0].count > 0) {
    return { seeded: false, reason: 'already_has_users' };
  }

  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== 'true') {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@vencely.app').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminHash = hashAdminPassword(adminPassword);

    await query(
      `INSERT INTO admin_users (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, adminHash, 'Administrador']
    );

    return { seeded: false, reason: 'production_admin_only' };
  }

  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(DEMO_CLIENT.password, BCRYPT_ROUNDS);

  await withTransaction(async (client) => {
    await upsertUserRecord(client, {
      ...DEMO_CLIENT,
      passwordHash,
    });

    await saveSedesForUser(
      client,
      DEMO_CLIENT.id,
      DEMO_SEDES.map((s) => ({ ...s, updatedAt: now })),
      now
    );
    await saveAccountsForUser(
      client,
      DEMO_CLIENT.id,
      DEMO_ACCOUNTS.map((a) => ({ ...a, updatedAt: now })),
      now
    );

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@vencely.app').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminHash = hashAdminPassword(adminPassword);

    await client.query(
      `INSERT INTO admin_users (email, password_hash, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, adminHash, 'Administrador']
    );

    await client.query(
      `INSERT INTO user_events (user_id, event_type, payload)
       VALUES ($1, $2, $3)`,
      [
        DEMO_CLIENT.id,
        'user_registered',
        JSON.stringify({ email: DEMO_CLIENT.email, source: 'seed' }),
      ]
    );
  });

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@vencely.app').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  console.log(`Seed demo: ${DEMO_CLIENT.email} / ${DEMO_CLIENT.password}`);
  console.log(`Seed admin: ${adminEmail} / ${adminPassword}`);
  return { seeded: true };
}

module.exports = {
  seedIfEmpty,
  DEMO_CLIENT,
  accountToRow,
  upsertUserRecord,
  saveSedesForUser,
  saveAccountsForUser,
};
