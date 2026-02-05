const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');
const { makeImportService } = require('../server/services/importer');

const dbDir = process.env.DATABASE_DIR
  ? path.resolve(process.env.DATABASE_DIR)
  : path.join(__dirname, '../database');
const dbPath = path.join(dbDir, 'cafe_stock.db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const sourceDir = process.env.SOURCE_HTML_DIR
  ? path.resolve(process.env.SOURCE_HTML_DIR)
  : path.resolve(__dirname, '../supplier_html');
console.log('Starting product import...');
console.log(`Source directory: ${sourceDir}`);

const importService = makeImportService(db);
const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
const actorUserId = adminUser?.id || null;

const result = importService.importFromHtml(sourceDir, actorUserId);

console.log('\nImport completed.');
console.log(`  Categories found: ${result.stats.categories}`);
console.log(`  Products scraped: ${result.stats.scraped_products}`);
console.log(`  Inserted: ${result.stats.inserted}`);
console.log(`  Updated: ${result.stats.updated}`);
console.log(`  Reactivated: ${result.stats.reactivated}`);
console.log(`  Deactivated: ${result.stats.deactivated}`);
console.log(`  Skipped: ${result.stats.skipped}`);
console.log('\nCurrent totals:');
console.log(`  Total quantity: ${result.totals.total_quantity}`);
console.log(`  Total value (TRY): ${result.totals.total_value_try}`);
console.log(`  Active item count: ${result.totals.active_item_count}`);
console.log(`  Low stock count: ${result.totals.low_stock_count}`);

db.close();
