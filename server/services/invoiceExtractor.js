/**
 * @deprecated Usar invoiceProcessor.js — re-exporta compatibilidad.
 */
const { processInvoice } = require('./invoiceProcessor');
const { getMockExtraction } = require('./ocr/mockProvider');

async function extractInvoice(opts) {
  const { extracted } = await processInvoice(opts);
  return extracted;
}

module.exports = {
  extractInvoice,
  getMockExtraction,
};
