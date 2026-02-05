const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { createCanvas } = require('@napi-rs/canvas');
const { createWorker } = require('tesseract.js');
const db = require('../config/database');
const { verifySession, requirePasswordChangeComplete } = require('../middleware/auth');
const { hasPermission, requirePermission } = require('../middleware/roleCheck');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024
  }
});

const OCR_MAX_PAGES = Math.min(Math.max(Number.parseInt(process.env.OCR_MAX_PAGES, 10) || 4, 1), 10);
const OCR_SCALE = Math.min(Math.max(Number(process.env.OCR_SCALE || 2.0), 1.2), 3.0);
const OCR_LANG = process.env.OCR_LANG || 'tur+eng';

const ORDER_ROW_REGEX = /^(?<name>.+?)\s+(?<stock>\d{3,8}(?:-\d{1,4})?)\s+(?<qty>[\d.,]+)\s+(?<unit>KG|KOLI|KOLİ|PAKET|ADET)\s+(?<unit_price>[\d.,]+)\s*TL\s+(?<total_price>[\d.,]+)\s*TL$/i;
const ORDER_ROW_TAIL_REGEX = /(?<qty>[\d.,]+)\s*(?<unit>KG|KOLI|KOLİ|PAKET|ADET)\s*(?<unit_price>[\d.,]+)\s*TL\s*(?<total_price>[\d.,]+)\s*TL$/i;

let pdfjsImportPromise = null;

async function getPdfjsLib() {
  if (!pdfjsImportPromise) {
    pdfjsImportPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsImportPromise;
}

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCandidateLine(line) {
  return String(line || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/T\s*L/gi, 'TL')
    .replace(/₺/g, 'TL')
    .replace(/K\s*G/gi, 'KG')
    .replace(/K\s*OLI/gi, 'KOLI')
    .replace(/K\s*OLİ/gi, 'KOLİ')
    .replace(/P\s*AKET/gi, 'PAKET')
    .replace(/A\s*DET/gi, 'ADET')
    .trim();
}

function parseOrderRow(line) {
  const direct = line.match(ORDER_ROW_REGEX);
  if (direct?.groups) {
    return {
      name: String(direct.groups.name || '').trim(),
      stock: String(direct.groups.stock || '').trim(),
      qty: direct.groups.qty,
      unit: direct.groups.unit,
      unit_price: direct.groups.unit_price,
      total_price: direct.groups.total_price
    };
  }

  const tail = line.match(ORDER_ROW_TAIL_REGEX);
  if (!tail?.groups || tail.index === undefined) {
    return null;
  }

  const prefix = line.slice(0, tail.index).trim();
  const codeMatch = prefix.match(/(?<stock>\d{3,8}(?:-\d{1,4})?)$/);
  if (!codeMatch?.groups || codeMatch.index === undefined) {
    return null;
  }

  const name = prefix.slice(0, codeMatch.index).trim();
  if (!name) {
    return null;
  }

  return {
    name,
    stock: String(codeMatch.groups.stock || '').trim(),
    qty: tail.groups.qty,
    unit: tail.groups.unit,
    unit_price: tail.groups.unit_price,
    total_price: tail.groups.total_price
  };
}

function splitStockAndQty(qtyRaw, byCode) {
  const digits = String(qtyRaw || '').replace(/[^\d]/g, '');
  if (digits.length < 4) {
    return null;
  }

  for (let i = 3; i <= 8 && i < digits.length; i += 1) {
    const stockCandidate = digits.slice(0, i);
    const qtyCandidate = digits.slice(i);
    if (byCode.has(stockCandidate) && qtyCandidate.length > 0) {
      const qty = parseNumber(qtyCandidate);
      if (qty !== null) {
        return { stock: stockCandidate, qty };
      }
    }
  }

  return null;
}

function parseOrderRowWithCatalog(line, byCode) {
  const parsed = parseOrderRow(line);
  if (parsed) {
    return parsed;
  }

  const tail = line.match(ORDER_ROW_TAIL_REGEX);
  if (!tail?.groups || tail.index === undefined) {
    return null;
  }

  const prefix = line.slice(0, tail.index).trim();
  let stock = null;
  let name = null;
  let qtyOverride = null;

  const codeMatch = prefix.match(/(?<stock>\d{3,8}(?:-\d{1,4})?)$/);
  if (codeMatch?.groups && codeMatch.index !== undefined) {
    stock = String(codeMatch.groups.stock || '').trim();
    name = prefix.slice(0, codeMatch.index).trim();
  }

  if (!stock) {
    const split = splitStockAndQty(tail.groups.qty, byCode);
    if (split) {
      stock = split.stock;
      qtyOverride = split.qty;
      name = prefix;
    }
  }

  if (!stock || !name) {
    return null;
  }

  return {
    name,
    stock,
    qty: qtyOverride ?? tail.groups.qty,
    unit: tail.groups.unit,
    unit_price: tail.groups.unit_price,
    total_price: tail.groups.total_price
  };
}

function parseNumber(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }

  const value = String(raw).trim();
  if (!value) {
    return null;
  }

  let normalized = value.replace(/[^\d.,-]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function extractPackageKg(name) {
  const source = String(name || '');
  const exact = source.match(/\((\d+(?:[.,]\d+)?)\s*KG\)/i);
  const generic = source.match(/(\d+(?:[.,]\d+)?)\s*KG/i);
  const raw = exact?.[1] || generic?.[1];
  if (!raw) {
    return null;
  }

  const value = parseNumber(raw);
  if (value === null || value <= 0) {
    return null;
  }
  return value;
}

function normalizePdfUnit(unit) {
  return String(unit || '')
    .toUpperCase('tr-TR')
    .replace('İ', 'I');
}

function shouldIgnoreLine(line) {
  const normalized = normalizeText(line);
  if (!normalized) {
    return true;
  }

  if (/^resim urun stokkodu/.test(normalized)) return true;
  if (/^alt toplam/.test(normalized)) return true;
  if (/^indirim toplami/.test(normalized)) return true;
  if (/^ara toplam/.test(normalized)) return true;
  if (/^kdv/.test(normalized)) return true;
  if (/^kargo/.test(normalized)) return true;
  if (/^genel toplam/.test(normalized)) return true;
  if (/^odeme sekli/.test(normalized)) return true;
  if (/^odeme bilgisi/.test(normalized)) return true;
  if (/^https?:\/\//i.test(line)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4},/.test(line)) return true;
  if (/^\d+\/\d+$/.test(normalized)) return true;

  return false;
}

function tokenizeCandidateLines(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => normalizeCandidateLine(line))
    .filter((line) => line.length > 0)
    .filter((line) => !shouldIgnoreLine(line));

  const candidates = [];
  let pendingName = '';

  for (const line of lines) {
    const hasPrice = /TL/i.test(line) && /\d/.test(line);
    if (hasPrice) {
      if (pendingName) {
        candidates.push(`${pendingName} ${line}`.replace(/\s+/g, ' ').trim());
        pendingName = '';
      } else {
        candidates.push(line);
      }
      continue;
    }

    if (!/\b\d{3,8}(?:-\d{1,4})?\b/.test(line) && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(line)) {
      pendingName = pendingName ? `${pendingName} ${line}`.replace(/\s+/g, ' ').trim() : line;
    }
  }

  return candidates;
}

async function extractTextWithOcr(buffer) {
  const pdfjsLib = await getPdfjsLib();
  const binary = Buffer.isBuffer(buffer)
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : buffer;
  const pdf = await pdfjsLib.getDocument({ data: binary, disableWorker: true }).promise;
  const pageCount = Math.min(pdf.numPages, OCR_MAX_PAGES);
  const worker = await createWorker();

  await worker.load();
  try {
    await worker.loadLanguage(OCR_LANG);
    await worker.initialize(OCR_LANG);
  } catch (err) {
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
  }

  let text = '';
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: OCR_SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const image = canvas.toBuffer('image/png');
    const { data } = await worker.recognize(image);
    if (data?.text) {
      text += `\n${data.text}`;
    }
    page.cleanup();
  }

  await worker.terminate();
  return { text, pageCount };
}

function convertOrderQtyToAdet(qtyRaw, unit, packageKg) {
  const normalizedUnit = normalizePdfUnit(unit);

  if (normalizedUnit === 'KG') {
    if (packageKg && packageKg > 0) {
      const rawAdet = qtyRaw / packageKg;
      if (Number.isFinite(rawAdet)) {
        return Math.max(Math.ceil(rawAdet), 0);
      }
    }
    return Math.max(Math.round(qtyRaw), 0);
  }

  return Math.max(Math.round(qtyRaw), 0);
}

function buildPreview(text) {
  const products = db.prepare(`
    SELECT
      p.id,
      p.stock_code,
      p.name,
      p.supplier_price,
      COALESCE(s.quantity, 0) AS quantity
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.id
    WHERE p.is_active = 1
  `).all();

  const byCode = new Map();
  const byNormalizedName = [];

  for (const product of products) {
    byCode.set(String(product.stock_code), product);
    byNormalizedName.push({
      key: normalizeText(product.name),
      product
    });
  }

  const candidates = tokenizeCandidateLines(text);
  const previewMap = new Map();
  const unmatchedLines = [];

  for (const candidate of candidates) {
    const parsed = parseOrderRowWithCatalog(candidate, byCode);
    if (!parsed) {
      unmatchedLines.push(candidate);
      continue;
    }

    const stockCode = String(parsed.stock || '').trim();
    const qtyRaw = parseNumber(parsed.qty);
    const unitPrice = parseNumber(parsed.unit_price);
    const totalPrice = parseNumber(parsed.total_price);
    const unit = normalizePdfUnit(parsed.unit);

    if (!stockCode || qtyRaw === null) {
      unmatchedLines.push(candidate);
      continue;
    }

    let matchedProduct = byCode.get(stockCode) || null;
    if (!matchedProduct) {
      const normalizedName = normalizeText(parsed.name);
      const found = byNormalizedName.find((entry) => normalizedName.includes(entry.key));
      matchedProduct = found ? found.product : null;
    }

    if (!matchedProduct) {
      unmatchedLines.push(candidate);
      continue;
    }

    const packageKg = extractPackageKg(matchedProduct.name);
    const addQuantity = convertOrderQtyToAdet(qtyRaw, unit, packageKg);
    const addKg = packageKg ? Number((addQuantity * packageKg).toFixed(3)) : null;
    const currentKg = packageKg ? Number((matchedProduct.quantity * packageKg).toFixed(3)) : null;

    if (!previewMap.has(matchedProduct.id)) {
      previewMap.set(matchedProduct.id, {
        product_id: matchedProduct.id,
        stock_code: matchedProduct.stock_code,
        name: matchedProduct.name,
        package_kg: packageKg,
        current_quantity: matchedProduct.quantity,
        current_kg: currentKg,
        current_unit_price: matchedProduct.supplier_price,
        add_quantity: 0,
        add_kg: 0,
        order_qty_raw: 0,
        order_unit: unit,
        pdf_unit_price: unitPrice,
        pdf_total_price: 0,
        source_lines: []
      });
    }

    const row = previewMap.get(matchedProduct.id);
    row.add_quantity += addQuantity;
    row.order_qty_raw += qtyRaw;
    row.add_kg = row.package_kg ? Number((row.add_quantity * row.package_kg).toFixed(3)) : null;
    row.order_unit = unit;

    if (unitPrice !== null) {
      row.pdf_unit_price = unitPrice;
    }

    let lineTotal = null;
    if (unitPrice !== null) {
      lineTotal = round2(qtyRaw * unitPrice);
    }
    if (totalPrice !== null) {
      if (lineTotal === null || Math.abs(lineTotal - totalPrice) > 0.05) {
        lineTotal = totalPrice;
      }
    }
    if (lineTotal !== null) {
      row.pdf_total_price = round2(row.pdf_total_price + lineTotal);
    }

    if (row.source_lines.length < 4) {
      row.source_lines.push(candidate);
    }
  }

  const items = Array.from(previewMap.values())
    .map((row) => {
      const derivedUnitPrice =
        row.order_qty_raw > 0 && row.pdf_total_price > 0
          ? round2(row.pdf_total_price / row.order_qty_raw)
          : row.pdf_unit_price;

      return {
        ...row,
        pdf_unit_price: derivedUnitPrice,
        new_quantity_estimate: row.current_quantity + row.add_quantity,
        new_kg_estimate: row.package_kg
          ? Number(((row.current_quantity + row.add_quantity) * row.package_kg).toFixed(3))
          : null
      };
    })
    .sort((a, b) => String(a.stock_code).localeCompare(String(b.stock_code), 'tr'));

  return {
    items,
    unmatched_lines: unmatchedLines.slice(0, 60),
    scanned_line_count: candidates.length,
    matched_item_count: items.length,
    total_add_quantity: items.reduce((sum, item) => sum + Number(item.add_quantity || 0), 0),
    total_add_kg: items.reduce((sum, item) => sum + Number(item.add_kg || 0), 0)
  };
}

function getSummary() {
  const row = db.prepare('SELECT * FROM v_stock_totals').get();
  return {
    total_quantity: row?.total_quantity || 0,
    total_value_try: row?.total_value_try || 0,
    active_item_count: row?.active_item_count || 0,
    low_stock_count: row?.low_stock_count || 0,
    warning_stock_count: row?.warning_stock_count || 0
  };
}

const applyPdfTx = db.transaction((items, actorUserId, allowPriceUpdate) => {
  const getProduct = db.prepare(`
    SELECT p.id, p.supplier_price, COALESCE(s.quantity, 0) AS quantity
    FROM products p
    JOIN stock s ON s.product_id = p.id
    WHERE p.id = ? AND p.is_active = 1
  `);

  const updateStock = db.prepare(`
    UPDATE stock
    SET
      quantity = ?,
      updated_by = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE product_id = ?
  `);

  const updatePrice = db.prepare(`
    UPDATE products
    SET
      supplier_price = ?,
      updated_by = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  let appliedCount = 0;

  for (const row of items) {
    const productId = Number.parseInt(row.product_id, 10);
    const addQuantity = Number.parseInt(row.add_quantity, 10);

    if (!Number.isFinite(productId) || !Number.isFinite(addQuantity)) {
      continue;
    }
    if (addQuantity <= 0) {
      continue;
    }

    const product = getProduct.get(productId);
    if (!product) {
      continue;
    }

    const newQuantity = product.quantity + addQuantity;
    if (newQuantity < 0) {
      throw new Error(`Product ${productId} quantity cannot go below zero`);
    }

    updateStock.run(newQuantity, actorUserId, productId);

    if (allowPriceUpdate && row.new_unit_price !== undefined && row.new_unit_price !== null && row.new_unit_price !== '') {
      const parsedUnitPrice = parseNumber(row.new_unit_price);
      if (parsedUnitPrice !== null && parsedUnitPrice >= 0) {
        updatePrice.run(parsedUnitPrice, actorUserId, productId);
      }
    }

    appliedCount += 1;
  }

  return appliedCount;
});

router.post('/preview', verifySession, requirePasswordChangeComplete, requirePermission('can_scan_pdf'), upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF dosyası gerekli.' });
    }

    if (req.file.mimetype !== 'application/pdf' && !req.file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Sadece PDF dosyası yükleyebilirsiniz.' });
    }

    const parsed = await pdfParse(req.file.buffer);
    const parsedText = parsed.text || '';
    let preview = buildPreview(parsedText);
    let ocrUsed = false;
    let ocrPages = 0;

    const forceOcr = String(req.query.force_ocr || '').trim() === '1';
    if (
      preview.matched_item_count === 0 &&
      (forceOcr || preview.scanned_line_count === 0 || parsedText.trim().length < 120)
    ) {
      try {
        const ocr = await extractTextWithOcr(req.file.buffer);
        ocrUsed = true;
        ocrPages = ocr.pageCount;
        preview = buildPreview(ocr.text || '');
      } catch (ocrErr) {
        console.error('OCR error:', ocrErr);
      }
    }

    preview.ocr_used = ocrUsed;
    preview.ocr_pages = ocrPages;

    return res.json({ success: true, preview });
  } catch (err) {
    console.error('PDF preview error:', err);
    return res.status(500).json({ error: 'PDF okunamadı.' });
  }
});

router.post('/apply', verifySession, requirePasswordChangeComplete, requirePermission('can_scan_pdf'), (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: 'Uygulanacak satır bulunamadı.' });
    }

    const allowPriceUpdate = hasPermission(req, 'can_edit_product');
    const appliedCount = applyPdfTx(items, req.user.id, allowPriceUpdate);

    return res.json({
      success: true,
      applied_count: appliedCount,
      summary: getSummary()
    });
  } catch (err) {
    console.error('PDF apply error:', err);
    return res.status(500).json({ error: 'PDF verisi uygulanamadı.' });
  }
});

module.exports = router;
