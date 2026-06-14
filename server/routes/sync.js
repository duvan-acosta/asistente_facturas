const express = require('express');
const { getAccounts, getSedes, saveAccounts, saveSedes } = require('../services/db');
const { requireUser } = require('../middleware/userAuth');

const router = express.Router();

router.use(requireUser);

router.get('/accounts', async (req, res) => {
  try {
    const accounts = await getAccounts(req.authUser.userId);
    res.json({ accounts, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('GET accounts error:', err);
    res.status(500).json({ error: 'No se pudieron obtener las cuentas' });
  }
});

router.post('/accounts', async (req, res) => {
  try {
    const { accounts } = req.body || {};
    if (!Array.isArray(accounts)) {
      return res.status(400).json({ error: 'Se requiere un arreglo accounts' });
    }
    if (accounts.length > 500) {
      return res.status(400).json({ error: 'Demasiadas cuentas en una sola petición' });
    }
    const saved = await saveAccounts(req.authUser.userId, accounts);
    res.json({ ok: true, accounts: saved, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('POST accounts error:', err);
    res.status(500).json({ error: 'No se pudieron guardar las cuentas' });
  }
});

router.get('/sedes', async (req, res) => {
  try {
    const sedes = await getSedes(req.authUser.userId);
    res.json({ sedes, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('GET sedes error:', err);
    res.status(500).json({ error: 'No se pudieron obtener las sedes' });
  }
});

router.post('/sedes', async (req, res) => {
  try {
    const { sedes } = req.body || {};
    if (!Array.isArray(sedes)) {
      return res.status(400).json({ error: 'Se requiere un arreglo sedes' });
    }
    if (sedes.length > 100) {
      return res.status(400).json({ error: 'Demasiadas sedes en una sola petición' });
    }
    const saved = await saveSedes(req.authUser.userId, sedes);
    res.json({ ok: true, sedes: saved, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('POST sedes error:', err);
    res.status(500).json({ error: 'No se pudieron guardar las sedes' });
  }
});

module.exports = router;
