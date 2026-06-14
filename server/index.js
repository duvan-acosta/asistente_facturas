require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initDb } = require('./db/init');
const { checkConnection } = require('./db/connection');
const { assertProductionConfig, validateCorsOrigins, isProduction } = require('./config/security');

const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const invoiceRoutes = require('./routes/invoices');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const { getActiveProviderLabel, resolveProviderChain } = require('./services/invoiceProcessor');

const app = express();
const PORT = process.env.PORT || 3000;

assertProductionConfig();

const defaultCorsOrigins = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost',
];

const corsOrigins = (process.env.CORS_ORIGINS || defaultCorsOrigins.join(','))
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

validateCorsOrigins(corsOrigins);

app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction() ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
});

app.get('/api/health', async (_req, res) => {
  try {
    const db = await checkConnection();
    res.json({
      ok: true,
      service: 'vencely-api',
      time: new Date().toISOString(),
      database: 'postgresql',
      dbTime: db.now,
      invoiceProvider: getActiveProviderLabel(),
      invoiceProviderMode: process.env.INVOICE_PROVIDER || 'auto',
      invoiceProviderChain: resolveProviderChain(),
    });
  } catch (_err) {
    res.status(503).json({
      ok: false,
      service: 'vencely-api',
      error: 'Base de datos no disponible',
    });
  }
});

app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', authRateLimit, adminRoutes);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function start() {
  await initDb();

  app.listen(PORT, () => {
    console.log(`Vencely API escuchando en http://localhost:${PORT}`);
    console.log(`PostgreSQL: ${process.env.DATABASE_URL ? 'configurado' : 'default localhost'}`);
    console.log(`Uploads: ${process.env.UPLOADS_DIR || path.join(__dirname, 'uploads')}`);

    if (!isProduction()) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@vencely.app';
      console.log('--- Credenciales dev (solo local) ---');
      console.log(`Admin: ${adminEmail} / ${process.env.ADMIN_PASSWORD || 'admin123'}`);
      console.log('Cliente demo: maria@vencely.app / cliente123');
    }
  });
}

start().catch((err) => {
  console.error('No se pudo iniciar el API:', err);
  process.exit(1);
});
