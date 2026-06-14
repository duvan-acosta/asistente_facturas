const express = require('express');
const {
  getAdminCredentials,
  recordAdminLogin,
  getStats,
  listAllUsers,
  listAllAccounts,
  getUserAccounts,
  getUserSedes,
  getSyncLog,
  getUserAnalyticsSummary,
} = require('../services/db');
const { signAdminToken, verifyAdminPassword, requireAdmin } = require('../middleware/adminAuth');
const { validateEmail, validatePassword } = require('../utils/validate');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const emailCheck = validateEmail(req.body?.email);
    const passwordCheck = validatePassword(req.body?.password, { minLength: 1 });
    if (!emailCheck.ok || !passwordCheck.ok) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    const creds = await getAdminCredentials();
    const passwordOk = verifyAdminPassword(passwordCheck.value, creds.passwordHash);

    if (emailCheck.value !== creds.email || !passwordOk) {
      return res.status(401).json({ error: 'Credenciales de administrador incorrectas' });
    }

    await recordAdminLogin(emailCheck.value);
    const token = signAdminToken(creds.email);
    res.json({
      ok: true,
      token,
      admin: { email: creds.email },
      expiresIn: '8h',
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión admin' });
  }
});

router.get('/stats', requireAdmin, async (_req, res) => {
  try {
    const stats = await getStats();
    res.json({ ok: true, stats });
  } catch (err) {
    res.status(500).json({ error: 'No se pudieron obtener estadísticas' });
  }
});

router.get('/users', requireAdmin, async (_req, res) => {
  try {
    const users = await listAllUsers();
    res.json({ ok: true, users });
  } catch (err) {
    res.status(500).json({ error: 'No se pudieron listar usuarios' });
  }
});

router.get('/users/:userId/accounts', requireAdmin, async (req, res) => {
  try {
    const accounts = await getUserAccounts(req.params.userId);
    if (accounts === null) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ ok: true, userId: req.params.userId, accounts });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cuentas del usuario' });
  }
});

router.get('/users/:userId/sedes', requireAdmin, async (req, res) => {
  try {
    const sedes = await getUserSedes(req.params.userId);
    if (sedes === null) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ ok: true, userId: req.params.userId, sedes });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sedes del usuario' });
  }
});

router.get('/users/:userId/analytics-summary', requireAdmin, async (req, res) => {
  try {
    const summary = await getUserAnalyticsSummary(req.params.userId);
    if (!summary) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ ok: true, summary });
  } catch (err) {
    console.error('Analytics summary error:', err);
    res.status(500).json({ error: 'No se pudo generar el resumen analítico' });
  }
});

router.get('/accounts', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const result = await listAllAccounts({
      page,
      limit,
      status: req.query.status,
      context: req.query.context,
      userId: req.query.userId,
      search: req.query.search,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'No se pudieron listar cuentas' });
  }
});

router.get('/sync-log', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const events = await getSyncLog(limit);
    res.json({ ok: true, events });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo obtener el log de sync' });
  }
});

module.exports = router;
