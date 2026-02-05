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

module.exports = db;
