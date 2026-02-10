const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { verifySession, requirePasswordChangeComplete } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

const router = express.Router();
const SALT_ROUNDS = 12;

function toBooleanNumber(value, fallback = 0) {
  if (value === undefined || value === null) {
    return fallback;
  }
  return value ? 1 : 0;
}

function rolePermissions(role) {
  if (role === 'admin') {
    return {
      can_create_product: 1,
      can_edit_product: 1,
      can_update_stock: 1,
      can_delete_product: 1,
      can_view_logs: 1,
      can_manage_users: 1,
      can_scan_pdf: 1
    };
  }

  if (role === 'manager') {
    return {
      can_create_product: 0,
      can_edit_product: 0,
      can_update_stock: 1,
      can_delete_product: 0,
      can_view_logs: 0,
      can_manage_users: 0,
      can_scan_pdf: 1
    };
  }

  return {
    can_create_product: 0,
    can_edit_product: 0,
    can_update_stock: 0,
    can_delete_product: 0,
    can_view_logs: 0,
    can_manage_users: 0,
    can_scan_pdf: 0
  };
}

router.use(verifySession, requirePasswordChangeComplete, isAdmin);

router.get('/', (_req, res) => {
  try {
    const users = db.prepare(`
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
        can_scan_pdf,
        last_login,
        created_at,
        updated_at
      FROM users
      ORDER BY id ASC
    `).all();

    res.json({ users });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const role = String(req.body.role || 'manager');
    const allowedRoles = new Set(['admin', 'manager', 'guest']);

    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Şifre en az 8 karakter olmalı.' });
    }

    if (!allowedRoles.has(role)) {
      return res.status(400).json({ error: 'Geçersiz rol.' });
    }

    const isActive = toBooleanNumber(req.body.is_active, 1);
    const perms = rolePermissions(role);
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        email,
        role,
        must_change_password,
        is_active,
        can_create_product,
        can_edit_product,
        can_update_stock,
        can_delete_product,
        can_view_logs,
        can_manage_users,
        can_scan_pdf,
        created_at,
        updated_at
      )
      VALUES (?, ?, NULL, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      username,
      hash,
      role,
      isActive,
      perms.can_create_product,
      perms.can_edit_product,
      perms.can_update_stock,
      perms.can_delete_product,
      perms.can_view_logs,
      perms.can_manage_users,
      perms.can_scan_pdf
    );

    const created = db.prepare(`
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
        can_scan_pdf,
        last_login,
        created_at,
        updated_at
      FROM users
      WHERE id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json({ success: true, user: created });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
    }
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Geçersiz kullanıcı kimliği.' });
    }

    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const username = String(req.body.username || targetUser.username).trim();
    const role = String(req.body.role || targetUser.role);
    const allowedRoles = new Set(['admin', 'manager', 'guest']);
    if (!username) {
      return res.status(400).json({ error: 'Kullanıcı adı zorunludur.' });
    }
    if (!allowedRoles.has(role)) {
      return res.status(400).json({ error: 'Geçersiz rol.' });
    }

    const isActive = toBooleanNumber(req.body.is_active, targetUser.is_active);

    const perms = {
      can_create_product: toBooleanNumber(req.body.can_create_product, targetUser.can_create_product),
      can_edit_product: toBooleanNumber(req.body.can_edit_product, targetUser.can_edit_product),
      can_update_stock: toBooleanNumber(req.body.can_update_stock, targetUser.can_update_stock),
      can_delete_product: toBooleanNumber(req.body.can_delete_product, targetUser.can_delete_product),
      can_view_logs: toBooleanNumber(req.body.can_view_logs, targetUser.can_view_logs),
      can_manage_users: toBooleanNumber(req.body.can_manage_users, targetUser.can_manage_users),
      can_scan_pdf: toBooleanNumber(req.body.can_scan_pdf, targetUser.can_scan_pdf)
    };

    if (userId === req.user.id && !isActive) {
      return res.status(400).json({ error: 'Aktif oturumdaki admin devre dışı bırakılamaz.' });
    }

    db.prepare(`
      UPDATE users
      SET
        username = ?,
        role = ?,
        is_active = ?,
        can_create_product = ?,
        can_edit_product = ?,
        can_update_stock = ?,
        can_delete_product = ?,
        can_view_logs = ?,
        can_manage_users = ?,
        can_scan_pdf = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      username,
      role,
      isActive,
      perms.can_create_product,
      perms.can_edit_product,
      perms.can_update_stock,
      perms.can_delete_product,
      perms.can_view_logs,
      perms.can_manage_users,
      perms.can_scan_pdf,
      userId
    );

    const updated = db.prepare(`
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
        can_scan_pdf,
        last_login,
        created_at,
        updated_at
      FROM users
      WHERE id = ?
    `).get(userId);

    res.json({ success: true, user: updated });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
    }
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/password', async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    const newPassword = String(req.body.new_password || '');

    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Geçersiz kullanıcı kimliği.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalı.' });
    }

    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare(`
      UPDATE users
      SET
        password_hash = ?,
        must_change_password = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(hash, userId);

    res.json({ success: true });
  } catch (err) {
    console.error('Admin password reset error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
