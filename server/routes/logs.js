const express = require('express');
const db = require('../config/database');
const { verifySession, requirePasswordChangeComplete } = require('../middleware/auth');
const { requirePermission } = require('../middleware/roleCheck');

const router = express.Router();

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

router.get('/', verifySession, requirePasswordChangeComplete, requirePermission('can_view_logs'), (req, res) => {
  try {
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const limit = Math.min(Math.max(parseInteger(req.query.limit, 50), 1), 200);
    const offset = (page - 1) * limit;

    const filters = [];
    const params = [];

    if (req.query.action) {
      filters.push('l.action = ?');
      params.push(String(req.query.action));
    }

    if (req.query.user_id) {
      const userId = parseInteger(req.query.user_id, null);
      if (userId) {
        filters.push('l.user_id = ?');
        params.push(userId);
      }
    }

    if (req.query.table_name) {
      filters.push('l.table_name = ?');
      params.push(String(req.query.table_name));
    }

    if (req.query.date_from) {
      filters.push('l.created_at >= ?');
      params.push(String(req.query.date_from));
    }

    if (req.query.date_to) {
      filters.push('l.created_at <= ?');
      params.push(String(req.query.date_to));
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const listSql = `
      SELECT
        l.id,
        l.user_id,
        u.username,
        l.action,
        l.table_name,
        l.record_id,
        l.old_values,
        l.new_values,
        l.ip_address,
        l.user_agent,
        l.source,
        l.created_at
      FROM activity_logs l
      LEFT JOIN users u ON u.id = l.user_id
      ${whereClause}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS count
      FROM activity_logs l
      LEFT JOIN users u ON u.id = l.user_id
      ${whereClause}
    `;

    const rows = db.prepare(listSql).all(...params, limit, offset);
    const total = db.prepare(countSql).get(...params).count;

    res.json({
      logs: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      }
    });
  } catch (err) {
    console.error('Logs list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

