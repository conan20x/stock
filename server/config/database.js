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

module.exports = db;
