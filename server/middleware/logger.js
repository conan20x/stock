const db = require('../config/database');

const insertLog = db.prepare(`
  INSERT INTO activity_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    ip_address,
    user_agent,
    source
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function logActivity(userId, action, tableName, recordId, oldValues, newValues, req, source = 'app') {
  try {
    const ipAddress = req?.ip || req?.connection?.remoteAddress || 'unknown';
    const userAgent = req?.headers?.['user-agent'] || 'unknown';

    insertLog.run(
      userId,
      action,
      tableName,
      recordId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent,
      source
    );
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

function activityLogger(req, res, next) {
  req.logActivity = (action, tableName, recordId, oldValues, newValues, source = 'app') => {
    logActivity(req.user?.id, action, tableName, recordId, oldValues, newValues, req, source);
  };
  next();
}

module.exports = {
  logActivity,
  activityLogger
};
