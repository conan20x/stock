const express = require('express');
const db = require('../config/database');
const { verifySession, requirePasswordChangeComplete } = require('../middleware/auth');
const { hasPermission } = require('../middleware/roleCheck');

const router = express.Router();

function parseInteger(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : fallback;
}

function parsePrice(value, fallback = 0) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  let normalized = String(value).trim().replace(/[^\d.,-]/g, '');
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
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeImagePath(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value)
    .trim()
    .replace(/^\.\/+/, '')
    .replace(/\\/g, '/');
}

function toImageUrl(imagePath) {
  if (!imagePath) {
    return null;
  }
  return `/api/images/${encodeURIComponent(imagePath)}`;
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

const getProductById = db.prepare(`
  SELECT
    p.id,
    p.stock_code,
    p.name,
    c.name AS category_name,
    p.category_id,
    ROUND(p.supplier_price, 2) AS supplier_price_try,
    p.unit,
    COALESCE(s.quantity, 0) AS quantity,
    COALESCE(s.min_quantity, 0) AS min_quantity,
    ROUND(p.supplier_price * COALESCE(s.quantity, 0), 2) AS stock_value_try,
    p.image_path,
    p.is_active,
    p.updated_at
  FROM products p
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN stock s ON s.product_id = p.id
  WHERE p.id = ?
`);

const createProductTx = db.transaction((payload, actorUserId) => {
  const result = db.prepare(`
    INSERT INTO products (
      stock_code,
      name,
      category_id,
      supplier_price,
      image_path,
      unit,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    payload.stock_code,
    payload.name,
    payload.category_id,
    payload.supplier_price,
    payload.image_path,
    payload.unit,
    actorUserId,
    actorUserId
  );

  db.prepare(`
    INSERT INTO stock (
      product_id,
      quantity,
      min_quantity,
      updated_by,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(result.lastInsertRowid, payload.quantity, payload.min_quantity, actorUserId);

  return result.lastInsertRowid;
});

const updateProductTx = db.transaction((productId, payload, actorUserId) => {
  db.prepare(`
    UPDATE products
    SET
      stock_code = ?,
      name = ?,
      category_id = ?,
      supplier_price = ?,
      image_path = ?,
      unit = ?,
      updated_by = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    payload.stock_code,
    payload.name,
    payload.category_id,
    payload.supplier_price,
    payload.image_path,
    payload.unit,
    actorUserId,
    productId
  );

  if (payload.min_quantity !== undefined) {
    db.prepare(`
      UPDATE stock
      SET
        min_quantity = ?,
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ?
    `).run(payload.min_quantity, actorUserId, productId);
  }
});

const updateStockTx = db.transaction((productId, payload, actorUserId) => {
  db.prepare(`
    UPDATE stock
    SET
      quantity = ?,
      min_quantity = ?,
      updated_by = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE product_id = ?
  `).run(payload.quantity, payload.min_quantity, actorUserId, productId);
});

const deleteProductTx = db.transaction((productId, actorUserId) => {
  db.prepare(`
    UPDATE products
    SET
      updated_by = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(actorUserId, productId);

  db.prepare(`
    UPDATE stock
    SET
      updated_by = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE product_id = ?
  `).run(actorUserId, productId);

  db.prepare('DELETE FROM products WHERE id = ?').run(productId);
});

router.use(verifySession, requirePasswordChangeComplete);

router.post('/', (req, res) => {
  if (!hasPermission(req, 'can_create_product')) {
    return res.status(403).json({ error: 'Yeni ürün ekleme yetkiniz yok.' });
  }

  try {
    const stockCode = String(req.body.stock_code || '').trim();
    const name = String(req.body.name || '').trim();
    const categoryId = parseInteger(req.body.category_id);
    const supplierPrice = parsePrice(req.body.supplier_price, 0);
    const quantity = parseInteger(req.body.quantity, 0);
    const minQuantity = parseInteger(req.body.min_quantity, 5);
    const imagePath = normalizeImagePath(req.body.image_path);
    const unit = String(req.body.unit || 'adet').trim().toLowerCase();

    if (!stockCode || !name || !categoryId) {
      return res.status(400).json({ error: 'stock_code, name ve category_id zorunludur.' });
    }

    if (supplierPrice < 0 || quantity < 0 || minQuantity < 0) {
      return res.status(400).json({ error: 'Fiyat ve stok değerleri negatif olamaz.' });
    }

    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
    if (!category) {
      return res.status(400).json({ error: 'Kategori bulunamadı.' });
    }

    const productId = createProductTx(
      {
        stock_code: stockCode,
        name,
        category_id: categoryId,
        supplier_price: supplierPrice,
        image_path: imagePath,
        unit,
        quantity,
        min_quantity: minQuantity
      },
      req.user.id
    );

    const product = getProductById.get(productId);

    return res.status(201).json({
      success: true,
      product: {
        ...product,
        image_url: toImageUrl(product.image_path)
      },
      summary: getSummary()
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Stock code zaten kayıtlı.' });
    }

    console.error('Create product error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', (req, res) => {
  if (!hasPermission(req, 'can_edit_product')) {
    return res.status(403).json({ error: 'Ürün düzenleme yetkiniz yok.' });
  }

  try {
    const productId = parseInteger(req.params.id);
    if (!productId) {
      return res.status(400).json({ error: 'Geçersiz ürün kimliği.' });
    }

    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!existing) {
      return res.status(404).json({ error: 'Ürün bulunamadı.' });
    }

    const existingStock = db.prepare('SELECT min_quantity FROM stock WHERE product_id = ?').get(productId);

    const stockCode = String(req.body.stock_code ?? existing.stock_code).trim();
    const name = String(req.body.name ?? existing.name).trim();
    const categoryId = parseInteger(req.body.category_id, existing.category_id);
    const supplierPrice = parsePrice(req.body.supplier_price, existing.supplier_price);
    const imagePath =
      req.body.image_path === undefined ? existing.image_path : normalizeImagePath(req.body.image_path);
    const unit = String(req.body.unit ?? existing.unit).trim().toLowerCase();
    const minQuantity = parseInteger(req.body.min_quantity, existingStock?.min_quantity ?? 5);

    if (!stockCode || !name || !categoryId) {
      return res.status(400).json({ error: 'stock_code, name ve category_id zorunludur.' });
    }

    if (supplierPrice < 0 || minQuantity < 0) {
      return res.status(400).json({ error: 'Fiyat/minimum değerleri negatif olamaz.' });
    }

    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
    if (!category) {
      return res.status(400).json({ error: 'Kategori bulunamadı.' });
    }

    updateProductTx(
      productId,
      {
        stock_code: stockCode,
        name,
        category_id: categoryId,
        supplier_price: supplierPrice,
        image_path: imagePath,
        unit,
        min_quantity: minQuantity
      },
      req.user.id
    );

    const product = getProductById.get(productId);

    return res.json({
      success: true,
      product: {
        ...product,
        image_url: toImageUrl(product.image_path)
      },
      summary: getSummary()
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Stock code zaten kayıtlı.' });
    }

    console.error('Update product error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/stock', (req, res) => {
  if (!hasPermission(req, 'can_update_stock')) {
    return res.status(403).json({ error: 'Stok güncelleme yetkiniz yok.' });
  }

  try {
    const productId = parseInteger(req.params.id);
    if (!productId) {
      return res.status(400).json({ error: 'Geçersiz ürün kimliği.' });
    }

    const existingStock = db.prepare('SELECT * FROM stock WHERE product_id = ?').get(productId);
    if (!existingStock) {
      return res.status(404).json({ error: 'Stok kaydı bulunamadı.' });
    }

    const absoluteQty = parseInteger(req.body.quantity, null);
    const delta = parseInteger(req.body.delta, null);

    let quantity = absoluteQty;
    if (quantity === null && delta !== null) {
      quantity = existingStock.quantity + delta;
    }
    if (quantity === null) {
      quantity = existingStock.quantity;
    }

    let minQuantity = existingStock.min_quantity;
    if (req.body.min_quantity !== undefined) {
      if (!hasPermission(req, 'can_edit_product')) {
        return res.status(403).json({ error: 'Minimum stok düzenleme yetkiniz yok.' });
      }
      minQuantity = parseInteger(req.body.min_quantity, existingStock.min_quantity);
    }

    if (quantity < 0 || minQuantity < 0) {
      return res.status(400).json({ error: 'Stok değerleri negatif olamaz.' });
    }

    updateStockTx(
      productId,
      {
        quantity,
        min_quantity: minQuantity
      },
      req.user.id
    );

    const refreshed = getProductById.get(productId);

    return res.json({
      success: true,
      product: {
        ...refreshed,
        image_url: toImageUrl(refreshed.image_path)
      },
      summary: getSummary()
    });
  } catch (err) {
    if (String(err.message).includes('Stock quantity cannot be negative')) {
      return res.status(400).json({ error: 'Stok miktarı negatif olamaz.' });
    }

    console.error('Update stock error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', (req, res) => {
  if (!hasPermission(req, 'can_delete_product')) {
    return res.status(403).json({ error: 'Ürün silme yetkiniz yok.' });
  }

  try {
    const productId = parseInteger(req.params.id);
    if (!productId) {
      return res.status(400).json({ error: 'Geçersiz ürün kimliği.' });
    }

    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!existing) {
      return res.status(404).json({ error: 'Ürün bulunamadı.' });
    }

    deleteProductTx(productId, req.user.id);

    return res.json({
      success: true,
      summary: getSummary()
    });
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
