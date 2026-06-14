require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const invoiceRoutes = require('./routes/invoices');

const app = express();
const PORT = process.env.PORT || 3000;

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vencely-api',
    time: new Date().toISOString(),
    invoiceProvider: process.env.INVOICE_API_URL
      ? 'custom'
      : process.env.OPENAI_API_KEY
        ? 'openai'
        : 'mock',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/invoices', invoiceRoutes);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Vencely API escuchando en http://localhost:${PORT}`);
  console.log(`Datos en: ${process.env.DATA_DIR || path.join(__dirname, 'data')}`);
});
