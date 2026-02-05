const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { generateToken, verifySession } = require('../middleware/auth');
const { logActivity } = require('../middleware/logger');
const { createLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Çok fazla giriş denemesi yaptınız. 15 dakika sonra tekrar deneyin.'
});

function mapUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    is_active: Boolean(user.is_active),
    must_change_password: Boolean(user.must_change_password),
    permissions: {
      can_create_product: Boolean(user.can_create_product),
      can_edit_product: Boolean(user.can_edit_product),
      can_update_stock: Boolean(user.can_update_stock),
      can_delete_product: Boolean(user.can_delete_product),
      can_view_logs: Boolean(user.can_view_logs),
      can_manage_users: Boolean(user.can_manage_users),
      can_scan_pdf: Boolean(user.can_scan_pdf)
    }
  };
}

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();

    const token = generateToken();
    const expiresAt = db.prepare(`SELECT datetime('now', '+1 day') AS expires_at`).get().expires_at;

    db.prepare(`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).run(user.id, token, expiresAt);

    db.prepare(`
      UPDATE users
      SET
        last_login = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id);

    logActivity(user.id, 'LOGIN', 'users', user.id, null, null, req, 'app');

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === '1',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      user: mapUser(user),
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', verifySession, (req, res) => {
  try {
    const token = req.sessionToken || req.cookies?.session_token || req.headers['x-session-token'];

    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      logActivity(req.user.id, 'LOGOUT', 'users', req.user.id, null, null, req, 'app');
    }

    res.clearCookie('session_token');
    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', verifySession, (req, res) => {
  const user = db.prepare(`
    SELECT
      id,
      username,
      email,
      role,
      is_active,
      must_change_password,
      can_create_product,
      can_edit_product,
      can_update_stock,
      can_delete_product,
      can_view_logs,
      can_manage_users,
      can_scan_pdf
    FROM users
    WHERE id = ?
  `).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    user: mapUser(user)
  });
});

router.put('/password', verifySession, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    db.prepare(`
      UPDATE users
      SET
        password_hash = ?,
        must_change_password = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newHash, req.user.id);

    logActivity(req.user.id, 'PASSWORD_CHANGE', 'users', req.user.id, null, null, req, 'app');

    const updatedUser = db.prepare(`
      SELECT
        id,
        username,
        email,
        role,
        is_active,
        must_change_password,
        can_create_product,
        can_edit_product,
        can_update_stock,
        can_delete_product,
        can_view_logs,
        can_manage_users,
        can_scan_pdf
      FROM users
      WHERE id = ?
    `).get(req.user.id);

    res.json({
      success: true,
      user: mapUser(updatedUser)
    });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
