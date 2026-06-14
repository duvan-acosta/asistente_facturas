const fs = require('fs');
const path = require('path');
const { query } = require('./connection');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations() {
  const result = await query('SELECT name FROM schema_migrations ORDER BY id');
  return new Set(result.rows.map((row) => row.name));
}

async function runMigrations() {
  await ensureMigrationsTable();

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return { applied: [] };
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = await getAppliedMigrations();
  const newlyApplied = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await query(sql);
    await query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    newlyApplied.push(file);
    console.log(`Migración aplicada: ${file}`);
  }

  return { applied: newlyApplied };
}

module.exports = { runMigrations };
