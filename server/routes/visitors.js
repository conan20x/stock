const express = require('express');
const db = require('../config/database');
const { verifySession, requirePasswordChangeComplete } = require('../middleware/auth');
const { requirePermission } = require('../middleware/roleCheck');

const router = express.Router();

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

router.get(
  '/summary',
  verifySession,
  requirePasswordChangeComplete,
  requirePermission('can_view_logs'),
  (_req, res) => {
    try {
      const summary = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM visitor_events) AS total_visits,
          (SELECT COUNT(DISTINCT ip_address) FROM visitor_events WHERE ip_address IS NOT NULL AND ip_address <> '') AS unique_visitors,
          (
            SELECT COUNT(*)
            FROM visitor_events
            WHERE date(created_at) = date('now')
          ) AS visits_today,
          (
            SELECT COUNT(*)
            FROM visitor_events
            WHERE datetime(created_at) >= datetime('now', '-1 day')
          ) AS visits_last_24h,
          (
            SELECT created_at
            FROM visitor_events
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          ) AS last_visit_at
      `).get();

      const deviceRows = db.prepare(`
        SELECT
          COALESCE(device_type, 'unknown') AS device_type,
          COUNT(*) AS visits
        FROM visitor_events
        WHERE datetime(created_at) >= datetime('now', '-30 day')
        GROUP BY COALESCE(device_type, 'unknown')
        ORDER BY visits DESC
      `).all();

      res.json({
        summary: {
          total_visits: Number(summary.total_visits || 0),
          unique_visitors: Number(summary.unique_visitors || 0),
          visits_today: Number(summary.visits_today || 0),
          visits_last_24h: Number(summary.visits_last_24h || 0),
          last_visit_at: summary.last_visit_at || null,
          devices: deviceRows
        }
      });
    } catch (err) {
      console.error('Visitors summary error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.get('/', verifySession, requirePasswordChangeComplete, requirePermission('can_view_logs'), (req, res) => {
  try {
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const limit = Math.min(Math.max(parseInteger(req.query.limit, 100), 1), 300);
    const offset = (page - 1) * limit;

    const filters = [];
    const params = [];

    if (req.query.device_type) {
      filters.push('device_type = ?');
      params.push(String(req.query.device_type));
    }

    if (req.query.ip_address) {
      filters.push('ip_address = ?');
      params.push(String(req.query.ip_address));
    }

    if (req.query.path) {
      filters.push('path LIKE ?');
      params.push(`%${String(req.query.path).trim()}%`);
    }

    if (req.query.date_from) {
      filters.push('created_at >= ?');
      params.push(String(req.query.date_from));
    }

    if (req.query.date_to) {
      filters.push('created_at <= ?');
      params.push(String(req.query.date_to));
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const listSql = `
      SELECT
        id,
        ip_address,
        method,
        path,
        query_string,
        device_type,
        browser_name,
        os_name,
        user_agent,
        referer,
        accept_language,
        created_at
      FROM visitor_events
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS count
      FROM visitor_events
      ${whereClause}
    `;

    const visitors = db.prepare(listSql).all(...params, limit, offset);
    const total = Number(db.prepare(countSql).get(...params).count || 0);

    res.json({
      visitors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      }
    });
  } catch (err) {
    console.error('Visitors list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
