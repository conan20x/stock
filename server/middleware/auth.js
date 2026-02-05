const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

function generateToken() {
  return uuidv4() + '-' + Date.now().toString(36);
}

function getTokenFromRequest(req) {
  return req.cookies?.session_token || req.headers['x-session-token'];
}

function fetchSession(token) {
  if (!token) {
    return null;
  }

  return db.prepare(`
    SELECT
      s.id AS session_id,
      s.user_id,
      s.expires_at,
      u.username,
      u.role,
      u.must_change_password,
      u.is_active,
      u.can_create_product,
      u.can_edit_product,
      u.can_update_stock,
      u.can_delete_product,
      u.can_view_logs,
      u.can_manage_users,
      u.can_scan_pdf
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
      AND s.expires_at > datetime('now')
      AND u.is_active = 1
  `).get(token);
}

function attachUser(req, session) {
  if (!session) {
    return;
  }

  req.user = {
    id: session.user_id,
    username: session.username,
    role: session.role,
    must_change_password: Boolean(session.must_change_password),
    permissions: {
      can_create_product: Boolean(session.can_create_product),
      can_edit_product: Boolean(session.can_edit_product),
      can_update_stock: Boolean(session.can_update_stock),
      can_delete_product: Boolean(session.can_delete_product),
      can_view_logs: Boolean(session.can_view_logs),
      can_manage_users: Boolean(session.can_manage_users),
      can_scan_pdf: Boolean(session.can_scan_pdf)
    }
  };
}

function verifySession(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = fetchSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  attachUser(req, session);
  req.sessionToken = token;
  next();
}

function optionalAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  const session = fetchSession(token);
  if (session) {
    attachUser(req, session);
    req.sessionToken = token;
  }
  next();
}

function requirePasswordChangeComplete(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.must_change_password) {
    return res.status(403).json({
      error: 'Password change required',
      code: 'PASSWORD_CHANGE_REQUIRED'
    });
  }

  next();
}

module.exports = {
  generateToken,
  verifySession,
  optionalAuth,
  requirePasswordChangeComplete
};
