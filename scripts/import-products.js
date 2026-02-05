const Database = require('better-sqlite3');
const path = require('path');
const { makeImportService } = require('../server/services/importer');

const dbPath = path.join(__dirname, '../database/cafe_stock.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const sourceDir = path.resolve(__dirname, '../../');
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
