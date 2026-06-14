const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'vencely.json');

const defaultData = {
  users: {},
  sync: {},
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      users: data.users || {},
      sync: data.sync || {},
    };
  } catch {
    return { ...defaultData };
  }
}

function writeDb(data) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getUserScope(userId) {
  const db = readDb();
  if (!db.sync[userId]) {
    db.sync[userId] = { accounts: [], sedes: [], updatedAt: new Date().toISOString() };
    writeDb(db);
  }
  return db.sync[userId];
}

function upsertUser(profile) {
  const db = readDb();
  const id = profile.id || profile.email;
  const existing = db.users[id] || {};
  db.users[id] = {
    ...existing,
    ...profile,
    id,
    updatedAt: new Date().toISOString(),
  };
  writeDb(db);
  return db.users[id];
}

function getUser(userId) {
  const db = readDb();
  return db.users[userId] || null;
}

function getAccounts(userId) {
  return getUserScope(userId).accounts || [];
}

function getSedes(userId) {
  return getUserScope(userId).sedes || [];
}

function saveAccounts(userId, accounts) {
  const db = readDb();
  if (!db.sync[userId]) {
    db.sync[userId] = { accounts: [], sedes: [], updatedAt: new Date().toISOString() };
  }
  db.sync[userId].accounts = accounts;
  db.sync[userId].updatedAt = new Date().toISOString();
  writeDb(db);
  return db.sync[userId].accounts;
}

function saveSedes(userId, sedes) {
  const db = readDb();
  if (!db.sync[userId]) {
    db.sync[userId] = { accounts: [], sedes: [], updatedAt: new Date().toISOString() };
  }
  db.sync[userId].sedes = sedes;
  db.sync[userId].updatedAt = new Date().toISOString();
  writeDb(db);
  return db.sync[userId].sedes;
}

module.exports = {
  upsertUser,
  getUser,
  getAccounts,
  getSedes,
  saveAccounts,
  saveSedes,
};
