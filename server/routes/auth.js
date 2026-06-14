const express = require('express');
const { upsertUser } = require('../services/db');

const router = express.Router();

router.post('/sync-user', (req, res) => {
  const { id, email, name, phone, picture, googleId, provider } = req.body || {};

  if (!id && !email) {
    return res.status(400).json({ error: 'Se requiere id o email del usuario' });
  }

  const user = upsertUser({
    id: id || email,
    email: email || '',
    name: name || 'Usuario',
    phone: phone || '',
    picture: picture || '',
    googleId: googleId || '',
    provider: provider || 'email',
  });

  res.json({ ok: true, user });
});

module.exports = router;
