const express = require('express');
const db = require('../config/database');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

function toImageUrl(imagePath) {
  if (!imagePath) {
    return null;
  }
  return `/api/images/${encodeURIComponent(imagePath)}`;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSearchValue(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\u0131/g, 'i')
    .replace(/\u015f/g, 's')
    .replace(/\u011f/g, 'g')
    .replace(/\u00e7/g, 'c')
    .replace(/\u00f6/g, 'o')
    .replace(/\u00fc/g, 'u');
}

function enrichProduct(product) {
  return {
    ...product,
    image_url: toImageUrl(product.image_path)
  };
}

function statusCaseSql(quantityExpr = 'COALESCE(s.quantity, 0)', minExpr = 'COALESCE(s.min_quantity, 0)') {
  return `
    CASE
      WHEN ${quantityExpr} <= ${minExpr} THEN 'dusuk'
      WHEN ${quantityExpr} <= (${minExpr} + MAX(1, ((${minExpr} + 1) / 2))) THEN 'azalabilir'
      ELSE 'yeterli'
    END
  `;
}

router.get('/', optionalAuth, (req, res) => {
  try {
    if (process.env.DISABLE_GUEST === '1' && !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const limit = Math.min(Math.max(parseInteger(req.query.limit, 20), 1), 100);
    const offset = (page - 1) * limit;

    const search = String(req.query.search || '').trim();
    const category = parseInteger(req.query.category, null);
    const sort = String(req.query.sort || 'supplier_price').toLowerCase();
    const order = String(req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const whereParts = ['p.is_active = 1'];
    const params = [];

    if (search) {
      const normalizedSearch = normalizeSearchValue(search);
      whereParts.push('(tr_norm(p.name) LIKE ? OR tr_norm(p.stock_code) LIKE ?)');
      params.push(`%${normalizedSearch}%`, `%${normalizedSearch}%`);
    }

    if (category) {
      whereParts.push('p.category_id = ?');
      params.push(category);
    }

    const whereClause = `WHERE ${whereParts.join(' AND ')}`;

    const stockStatusSql = statusCaseSql();

    const sortMap = {
      image_path: 'p.image_path',
      stock_code: 'p.stock_code',
      name: 'p.name',
      category: 'c.name',
      supplier_price: 'p.supplier_price',
      quantity: 'COALESCE(s.quantity, 0)',
      min_quantity: 'COALESCE(s.min_quantity, 0)',
      stock_value: '(p.supplier_price * COALESCE(s.quantity, 0))',
      status: `
        CASE
          WHEN COALESCE(s.quantity, 0) <= COALESCE(s.min_quantity, 0) THEN 0
          WHEN COALESCE(s.quantity, 0) <= (COALESCE(s.min_quantity, 0) + MAX(1, ((COALESCE(s.min_quantity, 0) + 1) / 2))) THEN 1
          ELSE 2
        END
      `,
      actions: 'p.updated_at',
      updated_at: 'p.updated_at'
    };

    const sortColumn = sortMap[sort] || sortMap.supplier_price;

    const listSql = `
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
        p.updated_at,
        ${stockStatusSql} AS stock_status
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN stock s ON s.product_id = p.id
      ${whereClause}
      ORDER BY ${sortColumn} ${order}, p.id ASC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS count
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN stock s ON s.product_id = p.id
      ${whereClause}
    `;

    const products = db.prepare(listSql).all(...params, limit, offset).map(enrichProduct);
    const total = db.prepare(countSql).get(...params).count;

    res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      }
    });
  } catch (err) {
    console.error('Catalog list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/summary', optionalAuth, (req, res) => {
  try {
    if (process.env.DISABLE_GUEST === '1' && !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const summary = db.prepare('SELECT * FROM v_stock_totals').get();
    res.json({
      summary: {
        total_quantity: summary?.total_quantity || 0,
        total_value_try: summary?.total_value_try || 0,
        active_item_count: summary?.active_item_count || 0,
        low_stock_count: summary?.low_stock_count || 0,
        warning_stock_count: summary?.warning_stock_count || 0
      }
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/alerts', optionalAuth, (req, res) => {
  try {
    if (process.env.DISABLE_GUEST === '1' && !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const limit = Math.min(Math.max(parseInteger(req.query.limit, 200), 1), 500);

    const lowItems = db.prepare(`
      SELECT
        p.id,
        p.stock_code,
        p.name,
        c.name AS category_name,
        COALESCE(s.quantity, 0) AS quantity,
        COALESCE(s.min_quantity, 0) AS min_quantity,
        p.unit,
        p.image_path
      FROM products p
      JOIN categories c ON c.id = p.category_id
      JOIN stock s ON s.product_id = p.id
      WHERE p.is_active = 1 AND s.quantity <= s.min_quantity
      ORDER BY s.quantity ASC, p.name ASC
      LIMIT ?
    `).all(limit).map(enrichProduct);

    const warningItems = db.prepare(`
      SELECT
        p.id,
        p.stock_code,
        p.name,
        c.name AS category_name,
        COALESCE(s.quantity, 0) AS quantity,
        COALESCE(s.min_quantity, 0) AS min_quantity,
        p.unit,
        p.image_path
      FROM products p
      JOIN categories c ON c.id = p.category_id
      JOIN stock s ON s.product_id = p.id
      WHERE
        p.is_active = 1
        AND s.quantity > s.min_quantity
        AND s.quantity <= (s.min_quantity + MAX(1, ((s.min_quantity + 1) / 2)))
      ORDER BY s.quantity ASC, p.name ASC
      LIMIT ?
    `).all(limit).map(enrichProduct);

    res.json({
      alerts: {
        low: lowItems,
        warning: warningItems
      }
    });
  } catch (err) {
    console.error('Alerts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/categories', optionalAuth, (req, res) => {
  try {
    if (process.env.DISABLE_GUEST === '1' && !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const categories = db.prepare(`
      SELECT id, name, slug, name_en, description
      FROM categories
      ORDER BY name COLLATE NOCASE
    `).all();

    res.json({ categories });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
