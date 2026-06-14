const express = require('express');
const { getAccounts, getSedes, saveAccounts, saveSedes } = require('../services/db');

const router = express.Router();

function requireUserId(req, res, next) {
  const userId = req.query.userId || req.body?.userId;
  if (!userId) {
    return res.status(400).json({ error: 'Se requiere userId' });
  }
  req.userId = userId;
  next();
}

router.get('/accounts', requireUserId, (req, res) => {
  const accounts = getAccounts(req.userId);
  res.json({ accounts, syncedAt: new Date().toISOString() });
});

router.post('/accounts', requireUserId, (req, res) => {
  const { accounts } = req.body || {};
  if (!Array.isArray(accounts)) {
    return res.status(400).json({ error: 'Se requiere un arreglo accounts' });
  }
  const saved = saveAccounts(req.userId, accounts);
  res.json({ ok: true, accounts: saved, syncedAt: new Date().toISOString() });
});

router.get('/sedes', requireUserId, (req, res) => {
  const sedes = getSedes(req.userId);
  res.json({ sedes, syncedAt: new Date().toISOString() });
});

router.post('/sedes', requireUserId, (req, res) => {
  const { sedes } = req.body || {};
  if (!Array.isArray(sedes)) {
    return res.status(400).json({ error: 'Se requiere un arreglo sedes' });
  }
  const saved = saveSedes(req.userId, sedes);
  res.json({ ok: true, sedes: saved, syncedAt: new Date().toISOString() });
});

module.exports = router;
