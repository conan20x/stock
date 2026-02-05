const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, '../database/cafe_stock.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const SALT_ROUNDS = 12;

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

const defaultUsers = [
  { username: 'admin', password: 'Admin123!', email: 'admin@cafe.com', role: 'admin' },
  { username: 'manager1', password: 'Manager123!', email: 'manager1@cafe.com', role: 'manager' },
  { username: 'manager2', password: 'Manager123!', email: 'manager2@cafe.com', role: 'manager' },
  { username: 'guest', password: 'Guest123!', email: 'guest@cafe.com', role: 'guest' }
];

async function seedUsers() {
  console.log('Seeding default users...');

  const insertUser = db.prepare(`
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
    VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO UPDATE SET
      password_hash = excluded.password_hash,
      email = excluded.email,
      role = excluded.role,
      must_change_password = 1,
      is_active = 1,
      can_create_product = excluded.can_create_product,
      can_edit_product = excluded.can_edit_product,
      can_update_stock = excluded.can_update_stock,
      can_delete_product = excluded.can_delete_product,
      can_view_logs = excluded.can_view_logs,
      can_manage_users = excluded.can_manage_users,
      can_scan_pdf = excluded.can_scan_pdf,
      updated_at = CURRENT_TIMESTAMP
  `);

  for (const user of defaultUsers) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    const perms = rolePermissions(user.role);
    insertUser.run(
      user.username,
      passwordHash,
      user.email,
      user.role,
      perms.can_create_product,
      perms.can_edit_product,
      perms.can_update_stock,
      perms.can_delete_product,
      perms.can_view_logs,
      perms.can_manage_users,
      perms.can_scan_pdf
    );
    console.log(`Created user: ${user.username} (${user.role})`);
  }

  console.log('\nDefault users created:');
  console.log('  admin / Admin123! (Administrator)');
  console.log('  manager1 / Manager123! (Manager)');
  console.log('  manager2 / Manager123! (Manager)');
  console.log('  guest / Guest123! (Guest)');
  console.log('  All seeded users are forced to change password on first login.');

  db.close();
}

seedUsers().catch(console.error);
