/**
 * Migra datos legacy de server/data/vencely.json a PostgreSQL.
 *
 * Uso:
 *   cp .env.example .env   # DATABASE_URL apuntando a tu Postgres
 *   npm run server         # asegura migraciones aplicadas (o solo postgres up)
 *   node scripts/migrate-json-to-pg.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { initDb } = require('../server/db/init');
const { closePool } = require('../server/db/connection');
const { upsertUser, saveAccounts, saveSedes } = require('../server/services/db');

const JSON_FILE = path.join(
  process.env.DATA_DIR || path.join(__dirname, '..', 'server', 'data'),
  'vencely.json'
);

async function migrate() {
  if (!fs.existsSync(JSON_FILE)) {
    console.error(`No se encontró ${JSON_FILE}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  await initDb();

  let users = 0;
  let accountSets = 0;
  let sedeSets = 0;

  for (const [userId, profile] of Object.entries(raw.users || {})) {
    await upsertUser({
      id: userId,
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      picture: profile.picture,
      googleId: profile.googleId,
      provider: profile.provider,
    });
    users += 1;
  }

  for (const [userId, scope] of Object.entries(raw.sync || {})) {
    if ((scope.accounts || []).length) {
      await saveAccounts(userId, scope.accounts);
      accountSets += 1;
    }
    if ((scope.sedes || []).length) {
      await saveSedes(userId, scope.sedes);
      sedeSets += 1;
    }
  }

  if (raw.admin?.email && raw.admin?.passwordHash) {
    console.log(
      'Nota: admin en JSON usa hash SHA-256 legacy. Configura ADMIN_EMAIL/ADMIN_PASSWORD en .env o admin_users.'
    );
  }

  console.log(`Migración completada: ${users} usuarios, ${accountSets} sets de cuentas, ${sedeSets} sets de sedes`);
}

migrate()
  .catch((err) => {
    console.error('Error de migración:', err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
