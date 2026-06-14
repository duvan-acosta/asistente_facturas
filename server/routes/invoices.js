const express = require('express');
const multer = require('multer');
const { processInvoice } = require('../services/invoiceProcessor');
const { saveInvoice, updateInvoiceStatus, logUserEvent } = require('../services/db');
const { requireUser } = require('../middleware/userAuth');
const { validateInvoiceMime } = require('../utils/validate');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const check = validateInvoiceMime(file.mimetype);
    if (!check.ok) {
      cb(new Error(check.error));
      return;
    }
    cb(null, true);
  },
});

function bufferFromBase64(data) {
  const base64 = data.includes(',') ? data.split(',')[1] : data;
  return Buffer.from(base64, 'base64');
}

router.post('/extract', requireUser, upload.single('file'), async (req, res) => {
  const country = req.body?.country || 'CO';
  const userId = req.authUser.userId;
  const accountId = req.body?.accountId || null;
  let buffer;
  let mimeType = 'image/jpeg';
  let fileName = null;
  let invoiceRecord = null;

  try {
    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype || mimeType;
      fileName = pathBasename(req.file.originalname);
    } else if (req.body?.base64) {
      buffer = bufferFromBase64(req.body.base64);
      mimeType = req.body.mimeType || mimeType;
      fileName = pathBasename(req.body.fileName || 'invoice.jpg');
    } else {
      return res.status(400).json({
        error: 'Envía un archivo multipart (file) o base64 en el cuerpo JSON',
      });
    }

    const mimeCheck = validateInvoiceMime(mimeType);
    if (!mimeCheck.ok) {
      return res.status(400).json({ error: mimeCheck.error });
    }
    mimeType = mimeCheck.value;

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Archivo vacío o inválido' });
    }

    invoiceRecord = await saveInvoice({
      userId,
      accountId,
      fileName,
      mimeType,
      buffer,
      extracted: {},
      rawExtraction: null,
      providerAi: null,
      processingStatus: 'processing',
      skipUploadEvent: true,
    });

    await logUserEvent('invoice_uploaded', {
      userId,
      payload: { invoiceId: invoiceRecord.id, fileName, mimeType },
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    const { extracted, rawExtraction, provider } = await processInvoice({
      buffer,
      mimeType,
      country,
    });

    const invoice = await updateInvoiceStatus(invoiceRecord.id, {
      extracted,
      rawExtraction,
      providerAi: provider,
      processingStatus: 'completed',
    });

    await logUserEvent('invoice_extracted', {
      userId,
      payload: {
        invoiceId: invoice.id,
        provider: extracted.provider,
        amount: extracted.amount,
        confidence: extracted.confidence,
        source: extracted.source,
      },
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.json({
      ok: true,
      extracted,
      invoiceId: invoice.id,
      processingStatus: 'completed',
      provider,
    });
  } catch (err) {
    console.error('Invoice extraction error:', err);

    if (invoiceRecord?.id) {
      try {
        await updateInvoiceStatus(invoiceRecord.id, {
          processingStatus: 'failed',
          rawExtraction: { failedAt: new Date().toISOString() },
        });
      } catch (updateErr) {
        console.error('Could not mark invoice as failed:', updateErr.message);
      }
    }

    const status = err.message?.includes('Tipo de archivo') ? 400 : 500;
    res.status(status).json({
      error: status === 400 ? err.message : 'No se pudo extraer la factura',
      processingStatus: 'failed',
    });
  }
});

function pathBasename(name) {
  const base = String(name || 'invoice.jpg').replace(/\\/g, '/').split('/').pop() || 'invoice.jpg';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo (10 MB)' : 'Archivo no válido';
    return res.status(400).json({ error: message });
  }
  if (err.message?.includes('Tipo de archivo')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
