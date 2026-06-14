const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { query, withTransaction } = require('../db/connection');
const { hashAdminPassword } = require('../middleware/adminAuth');
const { accountToRow } = require('../db/seed');

const BCRYPT_ROUNDS = 10;
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function rowToAccount(row) {
  const extra = row.extra || {};
  const dueDate = row.due_date
    ? row.due_date.toISOString().slice(0, 10)
    : extra.dueDate || null;
  return {
    id: row.id,
    title: row.name,
    provider: row.provider || '',
    amount: Number(row.amount) || 0,
    dueDate,
    status: row.status || 'pendiente',
    category: row.category || '',
    type: row.frequency || extra.type || '',
    context: row.context || 'hogar',
    sedeId: row.sede_id || extra.sedeId || null,
    notes: row.notes || '',
    icon: extra.icon,
    reminders: extra.reminders,
    updatedAt: extra.updatedAt || row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function rowToSede(row) {
  const extra = row.extra || {};
  return {
    id: row.id,
    name: row.name,
    icon: row.icon || '🏠',
    type: row.type,
    address: row.address,
    updatedAt: extra.updatedAt || row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || '',
    picture: row.avatar_url || '',
    avatarUrl: row.avatar_url || '',
    googleId: row.google_id || '',
    provider: row.provider || 'email',
    country: row.country || 'CO',
    currency: row.currency || 'COP',
    plan: row.plan || 'free',
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

function isPendingAccount(account) {
  const status = (account.status || '').toLowerCase();
  return status !== 'pagado' && status !== 'pagada';
}

async function logUserEvent(eventType, { userId, payload = {}, userAgent, ipAddress } = {}) {
  await query(
    `INSERT INTO user_events (user_id, event_type, payload, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId || null, eventType, JSON.stringify(payload), userAgent || null, ipAddress || null]
  );
}

async function logSyncEvent(event) {
  await query(
    `INSERT INTO sync_log (user_id, event_type, payload)
     VALUES ($1, $2, $3)`,
    [
      event.userId || null,
      event.type || event.eventType || 'sync',
      JSON.stringify({
        email: event.email,
        name: event.name,
        count: event.count,
        ...event,
      }),
    ]
  );
}

async function getAdminCredentials() {
  const envEmail = (process.env.ADMIN_EMAIL || 'admin@vencely.app').trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const envHash = hashAdminPassword(envPassword);

  if (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD) {
    return { email: envEmail, passwordHash: envHash, source: 'env' };
  }

  const result = await query(
    'SELECT email, password_hash AS "passwordHash" FROM admin_users ORDER BY id LIMIT 1'
  );
  if (result.rows[0]) {
    return {
      email: result.rows[0].email.toLowerCase(),
      passwordHash: result.rows[0].passwordHash,
      source: 'db',
    };
  }

  return { email: envEmail, passwordHash: envHash, source: 'default' };
}

async function recordAdminLogin(email) {
  await query('UPDATE admin_users SET last_login_at = NOW() WHERE email = $1', [
    email.toLowerCase(),
  ]);
}

async function upsertUser(profile, meta = {}) {
  const id = profile.id || `email_${(profile.email || '').replace(/[@.]/g, '_')}`;
  const email = (profile.email || '').trim().toLowerCase();
  const now = new Date().toISOString();

  const existing = await query('SELECT id FROM users WHERE id = $1 OR email = $2', [id, email]);
  const isNew = existing.rows.length === 0;

  let passwordHash = profile.passwordHash || null;
  if (profile.password) {
    passwordHash = await bcrypt.hash(profile.password, BCRYPT_ROUNDS);
  }

  const result = await query(
    `INSERT INTO users (id, email, password_hash, name, phone, google_id, avatar_url, country, currency, plan, provider, metadata, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
       name = EXCLUDED.name,
       phone = EXCLUDED.phone,
       google_id = COALESCE(NULLIF(EXCLUDED.google_id, ''), users.google_id),
       avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), users.avatar_url),
       country = COALESCE(EXCLUDED.country, users.country),
       currency = COALESCE(EXCLUDED.currency, users.currency),
       plan = COALESCE(EXCLUDED.plan, users.plan),
       provider = EXCLUDED.provider,
       metadata = users.metadata || EXCLUDED.metadata,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      id,
      email,
      passwordHash,
      profile.name || 'Usuario',
      profile.phone || '',
      profile.googleId || profile.google_id || '',
      profile.picture || profile.avatarUrl || profile.avatar_url || '',
      profile.country || 'CO',
      profile.currency || 'COP',
      profile.plan || 'free',
      profile.provider || 'email',
      JSON.stringify(profile.metadata || {}),
      now,
    ]
  );

  await query(
    `INSERT INTO user_profiles (user_id, whatsapp, device_info, app_version, locale, timezone)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       device_info = user_profiles.device_info || EXCLUDED.device_info,
       app_version = COALESCE(EXCLUDED.app_version, user_profiles.app_version),
       updated_at = NOW()`,
    [
      id,
      profile.whatsapp || profile.phone || '',
      JSON.stringify(meta.deviceInfo || {}),
      meta.appVersion || null,
      meta.locale || 'es-CO',
      meta.timezone || 'America/Bogota',
    ]
  );

  await logSyncEvent({
    type: isNew ? 'user_registered' : 'user_updated',
    userId: id,
    email,
    name: profile.name,
  });

  await logUserEvent(isNew ? 'user_registered' : 'user_updated', {
    userId: id,
    payload: { email, provider: profile.provider || 'email' },
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  return rowToUser(result.rows[0]);
}

async function registerUser({ email, password, name, phone, country, currency }, meta = {}) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('Correo y contraseña son obligatorios');
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length) {
    throw new Error('Ya existe una cuenta con ese correo');
  }

  const id = `email_${normalizedEmail.replace(/[@.]/g, '_')}`;
  return upsertUser(
    {
      id,
      email: normalizedEmail,
      password,
      name: name || normalizedEmail.split('@')[0],
      phone: phone || '',
      country: country || 'CO',
      currency: currency || 'COP',
      provider: 'email',
    },
    meta
  );
}

async function loginUser(email, password, meta = {}) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
  const user = result.rows[0];

  if (!user || !user.password_hash) {
    return null;
  }

  const valid = await bcrypt.compare(password || '', user.password_hash);
  if (!valid) return null;

  await query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [
    user.id,
  ]);

  await logUserEvent('login', {
    userId: user.id,
    payload: { email: normalizedEmail, provider: user.provider },
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  return rowToUser(user);
}

async function getUser(userId) {
  const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
  return rowToUser(result.rows[0]);
}

async function getUserByEmail(email) {
  const result = await query('SELECT * FROM users WHERE email = $1', [
    (email || '').trim().toLowerCase(),
  ]);
  return rowToUser(result.rows[0]);
}

async function getAccounts(userId) {
  const result = await query(
    'SELECT * FROM accounts WHERE user_id = $1 ORDER BY due_date NULLS LAST, name',
    [userId]
  );
  return result.rows.map(rowToAccount);
}

async function getSedes(userId) {
  const result = await query('SELECT * FROM sedes WHERE user_id = $1 ORDER BY name', [userId]);
  return result.rows.map(rowToSede);
}

async function saveAccounts(userId, accounts) {
  const now = new Date().toISOString();

  await withTransaction(async (client) => {
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
  });

  await logSyncEvent({ type: 'accounts_synced', userId, count: accounts.length });
  await logUserEvent('accounts_synced', { userId, payload: { count: accounts.length } });

  return getAccounts(userId);
}

async function saveSedes(userId, sedes) {
  const now = new Date().toISOString();

  await withTransaction(async (client) => {
    await client.query('DELETE FROM sedes WHERE user_id = $1', [userId]);
    for (const sede of sedes) {
      const updatedAt = sede.updatedAt || now;
      await client.query(
        `INSERT INTO sedes (id, user_id, name, icon, type, address, extra, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sede.id,
          userId,
          sede.name,
          sede.icon || '🏠',
          sede.type || (sede.context === 'empresa' ? 'empresa' : 'hogar'),
          sede.address || null,
          JSON.stringify({ updatedAt }),
          updatedAt,
        ]
      );
    }
  });

  await logSyncEvent({ type: 'sedes_synced', userId, count: sedes.length });
  await logUserEvent('sedes_synced', { userId, payload: { count: sedes.length } });

  return getSedes(userId);
}

async function createPayment(userId, { accountId, amount, paidAt, method, reference, notes }) {
  const result = await query(
    `INSERT INTO payments (account_id, user_id, amount, paid_at, method, reference, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      accountId,
      userId,
      Number(amount) || 0,
      paidAt || new Date().toISOString(),
      method || 'manual',
      reference || '',
      notes || '',
    ]
  );

  await logUserEvent('payment_marked', {
    userId,
    payload: { accountId, amount: Number(amount) || 0, method: method || 'manual' },
  });

  return result.rows[0];
}

async function getPayments(userId, { accountId, limit = 100 } = {}) {
  const params = [userId];
  let sql =
    'SELECT * FROM payments WHERE user_id = $1';

  if (accountId) {
    params.push(accountId);
    sql += ` AND account_id = $${params.length}`;
  }

  params.push(Math.min(500, Math.max(1, limit)));
  sql += ` ORDER BY paid_at DESC LIMIT $${params.length}`;

  const result = await query(sql, params);
  return result.rows;
}

async function saveInvoice({
  userId,
  accountId,
  fileName,
  mimeType,
  buffer,
  extracted,
  rawExtraction,
  providerAi,
  processingStatus = 'completed',
  skipUploadEvent = false,
}) {
  ensureUploadsDir();

  let storagePath = null;
  if (buffer && fileName) {
    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    storagePath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(storagePath, buffer);
  }

  const result = await query(
    `INSERT INTO invoices (user_id, account_id, file_name, mime_type, storage_path, extracted_data, raw_extraction, provider_ai, processing_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId || null,
      accountId || null,
      fileName || null,
      mimeType || null,
      storagePath,
      JSON.stringify(extracted || {}),
      rawExtraction ? JSON.stringify(rawExtraction) : null,
      providerAi || extracted?.source || null,
      processingStatus,
    ]
  );

  if (userId && !skipUploadEvent) {
    await logUserEvent('invoice_uploaded', {
      userId,
      payload: {
        invoiceId: result.rows[0].id,
        provider: extracted?.provider,
        amount: extracted?.amount,
      },
    });
  }

  return result.rows[0];
}

async function updateInvoiceStatus(invoiceId, {
  extracted,
  rawExtraction,
  providerAi,
  processingStatus,
} = {}) {
  const sets = [];
  const values = [];
  let idx = 1;

  if (extracted !== undefined) {
    sets.push(`extracted_data = $${idx++}`);
    values.push(JSON.stringify(extracted));
  }
  if (rawExtraction !== undefined) {
    sets.push(`raw_extraction = $${idx++}`);
    values.push(rawExtraction ? JSON.stringify(rawExtraction) : null);
  }
  if (providerAi !== undefined) {
    sets.push(`provider_ai = $${idx++}`);
    values.push(providerAi);
  }
  if (processingStatus !== undefined) {
    sets.push(`processing_status = $${idx++}`);
    values.push(processingStatus);
  }

  if (!sets.length) {
    const existing = await query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
    return existing.rows[0] || null;
  }

  values.push(invoiceId);
  const result = await query(
    `UPDATE invoices SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

async function listAllUsers() {
  const result = await query(`
    SELECT
      u.id,
      u.email,
      u.name,
      u.phone,
      u.provider,
      u.avatar_url AS picture,
      u.updated_at AS "updatedAt",
      COALESCE(a.account_count, 0)::int AS "accountCount",
      COALESCE(s.sede_count, 0)::int AS "sedeCount",
      COALESCE(a.pending_amount, 0)::float AS "pendingAmount",
      GREATEST(u.updated_at, COALESCE(a.last_account_update, u.updated_at)) AS "lastSync"
    FROM users u
    LEFT JOIN (
      SELECT user_id,
        COUNT(*) AS account_count,
        SUM(CASE WHEN LOWER(status) NOT IN ('pagado', 'pagada') THEN amount ELSE 0 END) AS pending_amount,
        MAX(updated_at) AS last_account_update
      FROM accounts
      GROUP BY user_id
    ) a ON a.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS sede_count
      FROM sedes
      GROUP BY user_id
    ) s ON s.user_id = u.id
    ORDER BY "lastSync" DESC NULLS LAST
  `);

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || '',
    provider: row.provider || 'email',
    picture: row.picture || '',
    updatedAt: row.updatedAt,
    lastSync: row.lastSync,
    accountCount: row.accountCount,
    sedeCount: row.sedeCount,
    pendingAmount: row.pendingAmount,
  }));
}

async function getStats() {
  const today = new Date().toISOString().slice(0, 10);

  const result = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM accounts) AS accounts,
      (SELECT COUNT(*)::int FROM sedes) AS sedes,
      (SELECT COUNT(*)::int FROM sync_log) AS "syncEvents",
      (SELECT COUNT(*)::int FROM invoices) AS invoices,
      (SELECT COUNT(*)::int FROM payments) AS payments,
      COALESCE((
        SELECT SUM(amount)
        FROM accounts
        WHERE LOWER(status) NOT IN ('pagado', 'pagada')
      ), 0)::float AS "totalPending",
      COALESCE((
        SELECT COUNT(*)
        FROM accounts
        WHERE LOWER(status) IN ('vencido', 'vencida')
           OR (due_date IS NOT NULL AND due_date < $1::date AND LOWER(status) NOT IN ('pagado', 'pagada'))
      ), 0)::int AS "overdueCount",
      COALESCE((
        SELECT COUNT(*)
        FROM accounts
        WHERE LOWER(status) = 'por-vencer'
      ), 0)::int AS "dueSoonCount"
  `, [today]);

  return {
    ...result.rows[0],
    generatedAt: new Date().toISOString(),
  };
}

async function getUserAccounts(userId) {
  const user = await getUser(userId);
  if (!user) return null;
  const accounts = await getAccounts(userId);
  return accounts.map((acc) => ({ ...acc, userId }));
}

async function getUserSedes(userId) {
  const user = await getUser(userId);
  if (!user) return null;
  const sedes = await getSedes(userId);
  return sedes.map((sede) => ({ ...sede, userId }));
}

async function listAllAccounts({ page = 1, limit = 50, status, context, userId, search } = {}) {
  const params = [];
  const conditions = [];

  if (userId) {
    params.push(userId);
    conditions.push(`a.user_id = $${params.length}`);
  }
  if (status && status !== 'all') {
    params.push(status.toLowerCase());
    conditions.push(`LOWER(a.status) = $${params.length}`);
  }
  if (context && context !== 'all') {
    params.push(context.toLowerCase());
    conditions.push(`LOWER(a.context) = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    const idx = params.length;
    conditions.push(
      `(LOWER(a.name) LIKE $${idx} OR LOWER(a.provider) LIKE $${idx} OR LOWER(u.email) LIKE $${idx} OR LOWER(u.name) LIKE $${idx})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM accounts a
     JOIN users u ON u.id = a.user_id
     ${where}`,
    params
  );
  const total = countResult.rows[0].total;

  const offset = (page - 1) * limit;
  params.push(limit);
  params.push(offset);

  const rowsResult = await query(
    `SELECT a.*, u.email AS user_email, u.name AS user_name
     FROM accounts a
     JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.due_date NULLS LAST, a.name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const accounts = rowsResult.rows.map((row) => ({
    ...rowToAccount(row),
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_name,
  }));

  return {
    accounts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function getSyncLog(limit = 50) {
  const result = await query(
    `SELECT id, user_id AS "userId", event_type AS type, payload, created_at AS at
     FROM sync_log
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(200, Math.max(1, limit))]
  );

  return result.rows.map((row) => ({
    id: `evt_${row.id}`,
    at: row.at,
    type: row.type,
    userId: row.userId,
    ...(typeof row.payload === 'object' ? row.payload : {}),
  }));
}

async function getUserAnalyticsSummary(userId) {
  const user = await getUser(userId);
  if (!user) return null;

  const [profileResult, accountsResult, paymentsResult, invoicesResult, eventsResult] =
    await Promise.all([
      query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]),
      query(
        `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float AS total
         FROM accounts WHERE user_id = $1 GROUP BY status`,
        [userId]
      ),
      query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float AS total
         FROM payments WHERE user_id = $1`,
        [userId]
      ),
      query(
        `SELECT COUNT(*)::int AS count,
                AVG((extracted_data->>'confidence')::float) AS avg_confidence
         FROM invoices WHERE user_id = $1`,
        [userId]
      ),
      query(
        `SELECT event_type, COUNT(*)::int AS count
         FROM user_events WHERE user_id = $1
         GROUP BY event_type ORDER BY count DESC LIMIT 20`,
        [userId]
      ),
    ]);

  return {
    user,
    profile: profileResult.rows[0] || null,
    accountsByStatus: accountsResult.rows,
    payments: paymentsResult.rows[0],
    invoices: invoicesResult.rows[0],
    recentEventTypes: eventsResult.rows,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  upsertUser,
  registerUser,
  loginUser,
  getUser,
  getUserByEmail,
  getAccounts,
  getSedes,
  saveAccounts,
  saveSedes,
  createPayment,
  getPayments,
  saveInvoice,
  updateInvoiceStatus,
  getAdminCredentials,
  recordAdminLogin,
  listAllUsers,
  getStats,
  getUserAccounts,
  getUserSedes,
  listAllAccounts,
  getSyncLog,
  logSyncEvent,
  logUserEvent,
  getUserAnalyticsSummary,
  UPLOADS_DIR,
};
