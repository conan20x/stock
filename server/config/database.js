const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

const dbDir = process.env.DATABASE_DIR
  ? path.resolve(process.env.DATABASE_DIR)
  : path.join(__dirname, '../../database');
const dbPath = path.join(dbDir, 'cafe_stock.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

function normalizeForSearch(value) {
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

db.function('tr_norm', { deterministic: true }, normalizeForSearch);

db.exec(`
  CREATE TABLE IF NOT EXISTS visitor_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT,
    forwarded_for TEXT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    query_string TEXT,
    device_type TEXT,
    browser_name TEXT,
    os_name TEXT,
    user_agent TEXT,
    referer TEXT,
    accept_language TEXT,
    country_code TEXT,
    city TEXT,
    timezone TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_visitor_events_created_at ON visitor_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_visitor_events_ip_created ON visitor_events(ip_address, created_at);
`);

function ensureTableColumn(tableName, columnName, columnDefinition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

ensureTableColumn('visitor_events', 'country_code', 'TEXT');
ensureTableColumn('visitor_events', 'city', 'TEXT');
ensureTableColumn('visitor_events', 'timezone', 'TEXT');
db.exec('CREATE INDEX IF NOT EXISTS idx_visitor_events_country_created ON visitor_events(country_code, created_at);');

module.exports = db;
