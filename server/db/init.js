const { runMigrations } = require('./migrate');
const { seedIfEmpty } = require('./seed');
const { checkConnection } = require('./connection');

async function initDb() {
  const info = await checkConnection();
  console.log(`PostgreSQL conectado (${info.now})`);
  const { applied } = await runMigrations();
  if (applied.length) {
    console.log(`Migraciones nuevas: ${applied.join(', ')}`);
  }
  const seedResult = await seedIfEmpty();
  if (seedResult.seeded) {
    console.log('Datos demo insertados en PostgreSQL');
  }
}

module.exports = { initDb };
