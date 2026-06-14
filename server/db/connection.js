const { Pool } = require('pg');

let pool = null;

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    'postgresql://vencely:vencely@localhost:5432/vencely'
  );
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (err) => {
      console.error('Error inesperado en el pool de PostgreSQL:', err);
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function checkConnection() {
  const result = await query('SELECT NOW() AS now');
  return result.rows[0];
}

module.exports = {
  getPool,
  query,
  withTransaction,
  closePool,
  checkConnection,
  getDatabaseUrl,
};
