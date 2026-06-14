const express = require('express');
const { createPayment, getPayments } = require('../services/db');
const { requireUser } = require('../middleware/userAuth');

const router = express.Router();

router.use(requireUser);

router.get('/', async (req, res) => {
  try {
    const payments = await getPayments(req.authUser.userId, {
      accountId: req.query.accountId,
      limit: parseInt(req.query.limit, 10) || 100,
    });
    res.json({ ok: true, payments });
  } catch (err) {
    console.error('GET payments error:', err);
    res.status(500).json({ error: 'No se pudieron obtener los pagos' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { accountId, amount, paidAt, method, reference, notes } = req.body || {};
    if (!accountId || typeof accountId !== 'string') {
      return res.status(400).json({ error: 'Se requiere accountId' });
    }
    const payment = await createPayment(req.authUser.userId, {
      accountId,
      amount,
      paidAt,
      method,
      reference,
      notes,
    });
    res.status(201).json({ ok: true, payment });
  } catch (err) {
    console.error('POST payment error:', err);
    res.status(500).json({ error: 'No se pudo registrar el pago' });
  }
});

module.exports = router;
