const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

const dbDir = process.env.DATABASE_DIR
  ? path.resolve(process.env.DATABASE_DIR)
  : path.join(__dirname, '../database');
const dbPath = path.join(dbDir, 'cafe_stock.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
console.log('Initializing database...');

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

db.exec(`
  DROP VIEW IF EXISTS v_stock_totals;

  DROP TRIGGER IF EXISTS stock_prevent_negative_quantity_insert;
  DROP TRIGGER IF EXISTS stock_prevent_negative_quantity_update;
  DROP TRIGGER IF EXISTS products_set_updated_at;
  DROP TRIGGER IF EXISTS stock_set_updated_at;
  DROP TRIGGER IF EXISTS products_after_insert;
  DROP TRIGGER IF EXISTS products_after_update;
  DROP TRIGGER IF EXISTS products_after_delete;
  DROP TRIGGER IF EXISTS stock_after_insert;
  DROP TRIGGER IF EXISTS stock_after_update;
  DROP TRIGGER IF EXISTS stock_after_delete;

  DROP TABLE IF EXISTS sessions;
  DROP TABLE IF EXISTS visitor_events;
  DROP TABLE IF EXISTS activity_logs;
  DROP TABLE IF EXISTS stock;
  DROP TABLE IF EXISTS products;
  DROP TABLE IF EXISTS categories;
  DROP TABLE IF EXISTS users;
`);

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'guest')),
    must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    can_create_product INTEGER NOT NULL DEFAULT 0 CHECK (can_create_product IN (0, 1)),
    can_edit_product INTEGER NOT NULL DEFAULT 0 CHECK (can_edit_product IN (0, 1)),
    can_update_stock INTEGER NOT NULL DEFAULT 0 CHECK (can_update_stock IN (0, 1)),
    can_delete_product INTEGER NOT NULL DEFAULT 0 CHECK (can_delete_product IN (0, 1)),
    can_view_logs INTEGER NOT NULL DEFAULT 0 CHECK (can_view_logs IN (0, 1)),
    can_manage_users INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_users IN (0, 1)),
    can_scan_pdf INTEGER NOT NULL DEFAULT 0 CHECK (can_scan_pdf IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TEXT
  );

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    name_en TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    supplier_price REAL NOT NULL DEFAULT 0 CHECK (supplier_price >= 0),
    image_path TEXT,
    unit TEXT NOT NULL DEFAULT 'adet',
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_by INTEGER,
    updated_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
  );

  CREATE TABLE stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_quantity INTEGER NOT NULL DEFAULT 5 CHECK (min_quantity >= 0),
    updated_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id)
  );

  CREATE TABLE activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    source TEXT NOT NULL DEFAULT 'trigger',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE visitor_events (
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

  CREATE INDEX idx_products_stock_code ON products(stock_code);
  CREATE INDEX idx_products_category_active ON products(category_id, is_active);
  CREATE INDEX idx_products_active ON products(is_active);
  CREATE INDEX idx_stock_product ON stock(product_id);
  CREATE INDEX idx_logs_created_user ON activity_logs(created_at, user_id);
  CREATE INDEX idx_logs_table_record ON activity_logs(table_name, record_id);
  CREATE INDEX idx_sessions_token ON sessions(token);
  CREATE INDEX idx_sessions_user ON sessions(user_id);
  CREATE INDEX idx_visitor_events_created_at ON visitor_events(created_at);
  CREATE INDEX idx_visitor_events_ip_created ON visitor_events(ip_address, created_at);
  CREATE INDEX idx_visitor_events_country_created ON visitor_events(country_code, created_at);

  CREATE VIEW v_stock_totals AS
  SELECT
    COALESCE(SUM(CASE WHEN p.is_active = 1 THEN s.quantity ELSE 0 END), 0) AS total_quantity,
    ROUND(COALESCE(SUM(CASE WHEN p.is_active = 1 THEN (s.quantity * p.supplier_price) ELSE 0 END), 0), 2) AS total_value_try,
    COALESCE(SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END), 0) AS active_item_count,
    COALESCE(SUM(CASE WHEN p.is_active = 1 AND s.quantity <= s.min_quantity THEN 1 ELSE 0 END), 0) AS low_stock_count,
    COALESCE(
      SUM(
        CASE
          WHEN p.is_active = 1
            AND s.quantity > s.min_quantity
            AND s.quantity <= (s.min_quantity + MAX(1, ((s.min_quantity + 1) / 2)))
          THEN 1
          ELSE 0
        END
      ),
      0
    ) AS warning_stock_count
  FROM products p
  JOIN stock s ON s.product_id = p.id;

  CREATE TRIGGER stock_prevent_negative_quantity_insert
  BEFORE INSERT ON stock
  FOR EACH ROW
  WHEN NEW.quantity < 0
  BEGIN
    SELECT RAISE(ABORT, 'Stock quantity cannot be negative');
  END;

  CREATE TRIGGER stock_prevent_negative_quantity_update
  BEFORE UPDATE ON stock
  FOR EACH ROW
  WHEN NEW.quantity < 0
  BEGIN
    SELECT RAISE(ABORT, 'Stock quantity cannot be negative');
  END;

  CREATE TRIGGER products_set_updated_at
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
  BEGIN
    UPDATE products
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  END;

  CREATE TRIGGER stock_set_updated_at
  AFTER UPDATE ON stock
  FOR EACH ROW
  WHEN NEW.updated_at = OLD.updated_at
  BEGIN
    UPDATE stock
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  END;

  CREATE TRIGGER products_after_insert
  AFTER INSERT ON products
  FOR EACH ROW
  BEGIN
    INSERT INTO activity_logs (
      user_id, action, table_name, record_id, old_values, new_values, source
    ) VALUES (
      NEW.updated_by,
      'INSERT',
      'products',
      NEW.id,
      NULL,
      json_object(
        'id', NEW.id,
        'stock_code', NEW.stock_code,
        'name', NEW.name,
        'category_id', NEW.category_id,
        'supplier_price', NEW.supplier_price,
        'image_path', NEW.image_path,
        'unit', NEW.unit,
        'is_active', NEW.is_active,
        'created_by', NEW.created_by,
        'updated_by', NEW.updated_by,
        'updated_at', NEW.updated_at
      ),
      'trigger'
    );
  END;

  CREATE TRIGGER products_after_update
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN
    OLD.stock_code IS NOT NEW.stock_code OR
    OLD.name IS NOT NEW.name OR
    OLD.category_id IS NOT NEW.category_id OR
    OLD.supplier_price IS NOT NEW.supplier_price OR
    OLD.image_path IS NOT NEW.image_path OR
    OLD.unit IS NOT NEW.unit OR
    OLD.is_active IS NOT NEW.is_active OR
    OLD.updated_by IS NOT NEW.updated_by
  BEGIN
    INSERT INTO activity_logs (
      user_id, action, table_name, record_id, old_values, new_values, source
    ) VALUES (
      COALESCE(NEW.updated_by, OLD.updated_by),
      'UPDATE',
      'products',
      NEW.id,
      json_object(
        'id', OLD.id,
        'stock_code', OLD.stock_code,
        'name', OLD.name,
        'category_id', OLD.category_id,
        'supplier_price', OLD.supplier_price,
        'image_path', OLD.image_path,
        'unit', OLD.unit,
        'is_active', OLD.is_active,
        'created_by', OLD.created_by,
        'updated_by', OLD.updated_by,
        'updated_at', OLD.updated_at
      ),
      json_object(
        'id', NEW.id,
        'stock_code', NEW.stock_code,
        'name', NEW.name,
        'category_id', NEW.category_id,
        'supplier_price', NEW.supplier_price,
        'image_path', NEW.image_path,
        'unit', NEW.unit,
        'is_active', NEW.is_active,
        'created_by', NEW.created_by,
        'updated_by', NEW.updated_by,
        'updated_at', NEW.updated_at
      ),
      'trigger'
    );
  END;

  CREATE TRIGGER products_after_delete
  AFTER DELETE ON products
  FOR EACH ROW
  BEGIN
    INSERT INTO activity_logs (
      user_id, action, table_name, record_id, old_values, new_values, source
    ) VALUES (
      OLD.updated_by,
      'DELETE',
      'products',
      OLD.id,
      json_object(
        'id', OLD.id,
        'stock_code', OLD.stock_code,
        'name', OLD.name,
        'category_id', OLD.category_id,
        'supplier_price', OLD.supplier_price,
        'image_path', OLD.image_path,
        'unit', OLD.unit,
        'is_active', OLD.is_active,
        'created_by', OLD.created_by,
        'updated_by', OLD.updated_by,
        'updated_at', OLD.updated_at
      ),
      NULL,
      'trigger'
    );
  END;

  CREATE TRIGGER stock_after_insert
  AFTER INSERT ON stock
  FOR EACH ROW
  BEGIN
    INSERT INTO activity_logs (
      user_id, action, table_name, record_id, old_values, new_values, source
    ) VALUES (
      NEW.updated_by,
      'INSERT',
      'stock',
      NEW.product_id,
      NULL,
      json_object(
        'id', NEW.id,
        'product_id', NEW.product_id,
        'quantity', NEW.quantity,
        'min_quantity', NEW.min_quantity,
        'updated_by', NEW.updated_by,
        'updated_at', NEW.updated_at
      ),
      'trigger'
    );
  END;

  CREATE TRIGGER stock_after_update
  AFTER UPDATE ON stock
  FOR EACH ROW
  WHEN
    OLD.quantity IS NOT NEW.quantity OR
    OLD.min_quantity IS NOT NEW.min_quantity OR
    OLD.updated_by IS NOT NEW.updated_by
  BEGIN
    INSERT INTO activity_logs (
      user_id, action, table_name, record_id, old_values, new_values, source
    ) VALUES (
      COALESCE(NEW.updated_by, OLD.updated_by),
      'UPDATE',
      'stock',
      NEW.product_id,
      json_object(
        'id', OLD.id,
        'product_id', OLD.product_id,
        'quantity', OLD.quantity,
        'min_quantity', OLD.min_quantity,
        'updated_by', OLD.updated_by,
        'updated_at', OLD.updated_at
      ),
      json_object(
        'id', NEW.id,
        'product_id', NEW.product_id,
        'quantity', NEW.quantity,
        'min_quantity', NEW.min_quantity,
        'updated_by', NEW.updated_by,
        'updated_at', NEW.updated_at
      ),
      'trigger'
    );
  END;

  CREATE TRIGGER stock_after_delete
  AFTER DELETE ON stock
  FOR EACH ROW
  BEGIN
    INSERT INTO activity_logs (
      user_id, action, table_name, record_id, old_values, new_values, source
    ) VALUES (
      OLD.updated_by,
      'DELETE',
      'stock',
      OLD.product_id,
      json_object(
        'id', OLD.id,
        'product_id', OLD.product_id,
        'quantity', OLD.quantity,
        'min_quantity', OLD.min_quantity,
        'updated_by', OLD.updated_by,
        'updated_at', OLD.updated_at
      ),
      NULL,
      'trigger'
    );
  END;
`);

console.log('Database initialized successfully.');
console.log('Schema includes users, categories, products, stock, activity_logs, visitor_events, sessions, view and triggers.');
db.close();
