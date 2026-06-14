const express = require('express');
const {
  upsertUser,
  registerUser,
  loginUser,
  getUser,
} = require('../services/db');
const { signUserToken, requireUser, TOKEN_TTL_MS } = require('../middleware/userAuth');
const { isProduction } = require('../config/security');
const { verifyGoogleIdToken } = require('../utils/googleToken');
const { validateEmail, validatePassword, validateName, validatePhone } = require('../utils/validate');

const router = express.Router();

function getClientMeta(req) {
  return {
    userAgent: req.headers['user-agent'] || '',
    ipAddress:
      (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '',
    deviceInfo: {
      userAgent: req.headers['user-agent'] || '',
      acceptLanguage: req.headers['accept-language'] || '',
    },
    appVersion: req.headers['x-app-version'] || req.body?.appVersion || null,
    locale: req.body?.locale || 'es-CO',
    timezone: req.body?.timezone || 'America/Bogota',
  };
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    picture: user.picture || user.avatarUrl,
    googleId: user.googleId,
    provider: user.provider,
    country: user.country,
    currency: user.currency,
    plan: user.plan,
  };
}

router.post('/register', async (req, res) => {
  try {
    const emailCheck = validateEmail(req.body?.email);
    if (!emailCheck.ok) {
      return res.status(400).json({ error: emailCheck.error });
    }
    const passwordCheck = validatePassword(req.body?.password);
    if (!passwordCheck.ok) {
      return res.status(400).json({ error: passwordCheck.error });
    }
    const nameCheck = validateName(req.body?.name);
    if (!nameCheck.ok) {
      return res.status(400).json({ error: nameCheck.error });
    }
    const phoneCheck = validatePhone(req.body?.phone);

    const user = await registerUser(
      {
        email: emailCheck.value,
        password: passwordCheck.value,
        name: nameCheck.value,
        phone: phoneCheck.value,
        country: req.body?.country || 'CO',
        currency: req.body?.currency || 'COP',
      },
      getClientMeta(req)
    );
    const token = signUserToken(user);
    res.status(201).json({
      ok: true,
      user: publicUser(user),
      token,
      expiresIn: `${Math.floor(TOKEN_TTL_MS / 3600000)}h`,
    });
  } catch (err) {
    const status = err.message.includes('Ya existe') ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const emailCheck = validateEmail(req.body?.email);
    if (!emailCheck.ok) {
      return res.status(400).json({ error: emailCheck.error });
    }
    const passwordCheck = validatePassword(req.body?.password, { minLength: 1 });
    if (!passwordCheck.ok) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos' });
    }

    const user = await loginUser(emailCheck.value, passwordCheck.value, getClientMeta(req));
    if (!user) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    const token = signUserToken(user);
    res.json({
      ok: true,
      user: publicUser(user),
      token,
      expiresIn: `${Math.floor(TOKEN_TTL_MS / 3600000)}h`,
    });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo iniciar sesión' });
  }
});

router.get('/me', requireUser, async (req, res) => {
  try {
    const user = await getUser(req.authUser.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

router.post('/sync-user', requireUser, async (req, res) => {
  try {
    const existing = await getUser(req.authUser.userId);
    if (!existing) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nameCheck = validateName(req.body?.name || existing.name);
    const phoneCheck = validatePhone(req.body?.phone ?? existing.phone);

    const user = await upsertUser(
      {
        id: req.authUser.userId,
        email: existing.email,
        name: nameCheck.ok ? nameCheck.value : existing.name,
        phone: phoneCheck.value,
        picture: req.body?.picture || existing.picture || '',
        googleId: req.body?.googleId || existing.googleId || '',
        provider: req.body?.provider || existing.provider || 'email',
        country: req.body?.country || existing.country || 'CO',
        currency: req.body?.currency || existing.currency || 'COP',
      },
      getClientMeta(req)
    );

    const token = signUserToken(user);
    res.json({
      ok: true,
      user: publicUser(user),
      token,
      expiresIn: `${Math.floor(TOKEN_TTL_MS / 3600000)}h`,
    });
  } catch (err) {
    console.error('sync-user error:', err);
    res.status(500).json({ error: 'No se pudo sincronizar el usuario' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { idToken, phone, country, currency } = req.body || {};
    let profile;

    if (idToken) {
      profile = await verifyGoogleIdToken(idToken);
    } else if (isProduction()) {
      return res.status(400).json({ error: 'Se requiere idToken de Google en producción' });
    } else {
      const emailCheck = validateEmail(req.body?.email);
      const googleId = String(req.body?.googleId || '').trim();
      if (!emailCheck.ok || !googleId) {
        return res.status(400).json({ error: 'Se requieren email, googleId o idToken' });
      }
      profile = {
        email: emailCheck.value,
        googleId,
        name: req.body?.name || emailCheck.value.split('@')[0],
        picture: req.body?.picture || '',
      };
    }

    const user = await upsertUser(
      {
        id: `google_${profile.googleId}`,
        email: profile.email,
        name: profile.name,
        phone: validatePhone(phone).value,
        picture: profile.picture,
        googleId: profile.googleId,
        provider: 'google',
        country: country || 'CO',
        currency: currency || 'COP',
      },
      getClientMeta(req)
    );

    const token = signUserToken(user);
    res.json({
      ok: true,
      user: publicUser(user),
      token,
      expiresIn: `${Math.floor(TOKEN_TTL_MS / 3600000)}h`,
    });
  } catch (err) {
    console.error('google auth error:', err);
    res.status(401).json({ error: 'No se pudo autenticar con Google' });
  }
});

module.exports = router;
