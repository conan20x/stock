function deny(res, permission) {
  return res.status(403).json({
    error: 'Permission denied',
    required_permission: permission
  });
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (!req.user.permissions || !req.user.permissions[permission]) {
      return deny(res, permission);
    }

    return next();
  };
}

function hasPermission(req, permission) {
  if (!req.user) {
    return false;
  }

  if (req.user.role === 'admin') {
    return true;
  }

  return Boolean(req.user.permissions && req.user.permissions[permission]);
}

function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  return next();
}

module.exports = {
  requirePermission,
  hasPermission,
  isAdmin
};
