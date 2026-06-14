const express = require('express');
const multer = require('multer');
const { extractInvoice } = require('../services/invoiceExtractor');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function bufferFromBase64(data) {
  const base64 = data.includes(',') ? data.split(',')[1] : data;
  return Buffer.from(base64, 'base64');
}

router.post('/extract', upload.single('file'), async (req, res) => {
  try {
    const country = req.body?.country || 'CO';
    let buffer;
    let mimeType = 'image/jpeg';

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype || mimeType;
    } else if (req.body?.base64) {
      buffer = bufferFromBase64(req.body.base64);
      mimeType = req.body.mimeType || mimeType;
    } else {
      return res.status(400).json({
        error: 'Envía un archivo multipart (file) o base64 en el cuerpo JSON',
      });
    }

    const result = await extractInvoice({ buffer, mimeType, country });
    res.json({ ok: true, extracted: result });
  } catch (err) {
    console.error('Invoice extraction error:', err);
    res.status(500).json({ error: 'No se pudo extraer la factura', detail: err.message });
  }
});

module.exports = router;
