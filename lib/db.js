'use strict';

/*
 * Warstwa bazy danych — SQLite przez wbudowany modul node:sqlite.
 * Bezpieczenstwo:
 *  - WSZYSTKIE zapytania parametryzowane (prepared statements) -> brak SQL injection.
 *  - Plik bazy w katalogu data/ (poza public/, niedostepny przez WWW), prawa 600.
 *  - Funkcje czytajace uzytkownikow NIGDY nie zwracaja password_hash.
 */

const path = require('path');
const fs = require('fs');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
  console.error('\n[BAZA] Modul node:sqlite jest niedostepny.');
  console.error('       Wymagany Node.js >= 22 uruchomiony z flaga --experimental-sqlite.');
  console.error('       Na serwerze: uruchom ponownie deploy/setup.sh (podbije Node do 22).\n');
  throw e;
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'vibe.db');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);
// Prawa pliku: tylko wlasciciel (ochrona przed odczytem bazy przez innych)
try { fs.chmodSync(DB_FILE, 0o600); } catch {}

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'nowe',
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    colors TEXT NOT NULL,
    sizes TEXT NOT NULL,
    color TEXT NOT NULL,
    accent TEXT NOT NULL,
    description TEXT NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 25,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS discounts (
    code TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    value REAL NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
`);

// Migracje kolumn (dla istniejacej bazy)
function ensureColumn(table, col, ddl) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  } catch (e) { console.error(`Migracja ${table}.${col}:`, e.message); }
}
ensureColumn('products', 'image', 'image TEXT');
ensureColumn('orders', 'note', 'note TEXT');
ensureColumn('orders', 'discount_code', 'discount_code TEXT');
ensureColumn('orders', 'discount', 'discount REAL NOT NULL DEFAULT 0');
ensureColumn('orders', 'shipping', 'shipping REAL NOT NULL DEFAULT 0');

// Migracja: dodaj kolumne stock do istniejacej bazy, jesli jej brak
try {
  const cols = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
  if (!cols.includes('stock')) db.exec('ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 25');
} catch (e) { console.error('Migracja products.stock:', e.message); }

const USER_PUBLIC = 'id, email, username, name, role, created_at';

// ---- Uzytkownicy ----
const stmtCreateUser = db.prepare(
  'INSERT INTO users (email, username, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);
function createUser({ email = null, username = null, name, password_hash, role = 'customer' }) {
  const info = stmtCreateUser.run(email, username, name, password_hash, role, new Date().toISOString());
  return getUserById(info.lastInsertRowid);
}

// Do logowania — zwraca z hashem (tylko wewnetrznie do weryfikacji hasla)
const stmtUserByLoginAuth = db.prepare(
  'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1'
);
function getUserForAuth(login) {
  return stmtUserByLoginAuth.get(login, login) || null;
}

const stmtUserById = db.prepare(`SELECT ${USER_PUBLIC} FROM users WHERE id = ?`);
function getUserById(id) { return stmtUserById.get(id) || null; }

const stmtUserExists = db.prepare('SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1');
function userExists(login) { return !!stmtUserExists.get(login, login); }

const stmtAllUsers = db.prepare(`SELECT ${USER_PUBLIC} FROM users ORDER BY id DESC`);
function getAllUsers() { return stmtAllUsers.all(); }

const stmtSetPw = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?');
function setUserPassword(username, hash) { stmtSetPw.run(hash, username); }

const stmtSetRole = db.prepare('UPDATE users SET role = ? WHERE id = ?');
function setUserRole(id, role) { return stmtSetRole.run(role, id).changes > 0; }
const stmtDeleteUser = db.prepare('DELETE FROM users WHERE id = ?');
function deleteUser(id) { return stmtDeleteUser.run(id).changes > 0; }
const stmtCountAdmins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
function countAdmins() { return stmtCountAdmins.get().c; }

// ---- Sesje ----
const stmtCreateSession = db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)');
function createSession(token, userId, expiresAt) { stmtCreateSession.run(token, userId, expiresAt); }

const stmtSessionUser = db.prepare(`
  SELECT u.id, u.email, u.username, u.name, u.role, u.created_at, s.expires_at AS _exp
  FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?
`);
const stmtDeleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');
function deleteSession(token) { stmtDeleteSession.run(token); }
function getSessionUser(token) {
  if (!token) return null;
  const row = stmtSessionUser.get(token);
  if (!row) return null;
  if (row._exp < Date.now()) { deleteSession(token); return null; }
  delete row._exp;
  return row;
}
db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()); // sprzatanie na starcie

// ---- Zamowienia ----
const stmtCreateOrder = db.prepare(`
  INSERT INTO orders (id, user_id, customer_name, customer_email, customer_phone, customer_address, items, total, status, created_at, note, discount_code, discount, shipping)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
function createOrder(o) {
  stmtCreateOrder.run(o.id, o.user_id ?? null, o.customer.name, o.customer.email,
    o.customer.phone || '', o.customer.address, JSON.stringify(o.items), o.total, o.status, o.createdAt,
    o.note || '', o.discountCode || '', o.discount || 0, o.shipping || 0);
  return o;
}
const stmtSetNote = db.prepare('UPDATE orders SET note = ? WHERE id = ?');
function setOrderNote(id, note) { return stmtSetNote.run(note, id).changes > 0; }
const stmtCountOrders = db.prepare('SELECT COUNT(*) AS c FROM orders');
function countOrders() { return stmtCountOrders.get().c; }

function mapOrder(r) {
  return {
    id: r.id, userId: r.user_id, status: r.status, total: r.total, createdAt: r.created_at,
    note: r.note || '', discountCode: r.discount_code || '', discount: r.discount || 0, shipping: r.shipping || 0,
    customer: { name: r.customer_name, email: r.customer_email, phone: r.customer_phone, address: r.customer_address },
    items: JSON.parse(r.items)
  };
}
const stmtOrdersByUser = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
function getOrdersByUser(userId) { return stmtOrdersByUser.all(userId).map(mapOrder); }
const stmtAllOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
function getAllOrders() { return stmtAllOrders.all().map(mapOrder); }
const stmtUpdateStatus = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
function updateOrderStatus(id, status) { return stmtUpdateStatus.run(status, id).changes > 0; }

// ---- Produkty ----
function mapProduct(r) {
  return {
    id: r.id, name: r.name, category: r.category, price: r.price,
    colors: JSON.parse(r.colors), sizes: JSON.parse(r.sizes),
    color: r.color, accent: r.accent, description: r.description,
    featured: !!r.featured, stock: r.stock, sort: r.sort, image: r.image || null
  };
}
const stmtCountProducts = db.prepare('SELECT COUNT(*) AS c FROM products');
function countProducts() { return stmtCountProducts.get().c; }

const stmtAllProducts = db.prepare('SELECT * FROM products ORDER BY sort ASC, created_at ASC');
function getAllProducts() { return stmtAllProducts.all().map(mapProduct); }

const stmtProductById = db.prepare('SELECT * FROM products WHERE id = ?');
function getProductById(id) { const r = stmtProductById.get(id); return r ? mapProduct(r) : null; }

const stmtInsertProduct = db.prepare(`
  INSERT INTO products (id, name, category, price, colors, sizes, color, accent, description, featured, stock, sort, created_at, image)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
function createProduct(p) {
  const stock = Number.isFinite(p.stock) ? p.stock : 25;
  stmtInsertProduct.run(p.id, p.name, p.category, p.price,
    JSON.stringify(p.colors), JSON.stringify(p.sizes), p.color, p.accent, p.description,
    p.featured ? 1 : 0, stock, p.sort || 0, new Date().toISOString(), p.image || null);
  return getProductById(p.id);
}

const stmtUpdateProduct = db.prepare(`
  UPDATE products SET name = ?, category = ?, price = ?, colors = ?, sizes = ?,
    color = ?, accent = ?, description = ?, featured = ?, stock = ? WHERE id = ?
`);
function updateProduct(p) {
  return stmtUpdateProduct.run(p.name, p.category, p.price, JSON.stringify(p.colors),
    JSON.stringify(p.sizes), p.color, p.accent, p.description, p.featured ? 1 : 0,
    Number.isFinite(p.stock) ? p.stock : 0, p.id).changes > 0;
}
const stmtSetImage = db.prepare('UPDATE products SET image = ? WHERE id = ?');
function setProductImage(id, image) { return stmtSetImage.run(image, id).changes > 0; }

// Zmniejszenie stanu magazynowego (nie ponizej 0) — przy zakupie
const stmtDecStock = db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?');
function decrementStock(id, qty) { stmtDecStock.run(qty, id); }

const stmtDeleteProduct = db.prepare('DELETE FROM products WHERE id = ?');
function deleteProduct(id) { return stmtDeleteProduct.run(id).changes > 0; }

// Seed z products.json przy pierwszym uruchomieniu (gdy tabela pusta)
function seedProductsIfEmpty(list) {
  if (countProducts() > 0) return false;
  let sort = 0;
  for (const p of list) createProduct({ ...p, sort: sort++ });
  return true;
}

// ---- Ustawienia (key-value) ----
const stmtAllSettings = db.prepare('SELECT key, value FROM settings');
const stmtSetSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
function getSettings() { const o = {}; stmtAllSettings.all().forEach((r) => { o[r.key] = r.value; }); return o; }
function setSetting(key, value) { stmtSetSetting.run(key, String(value)); }
function seedSettings(defaults) { const cur = getSettings(); for (const k in defaults) if (!(k in cur)) setSetting(k, defaults[k]); }

// ---- Kody rabatowe ----
const stmtAllDiscounts = db.prepare('SELECT * FROM discounts ORDER BY created_at DESC');
function mapDiscount(d) { return { code: d.code, type: d.type, value: d.value, active: !!d.active, createdAt: d.created_at }; }
function getDiscounts() { return stmtAllDiscounts.all().map(mapDiscount); }
const stmtGetDiscount = db.prepare('SELECT * FROM discounts WHERE code = ?');
function getDiscount(code) { const d = stmtGetDiscount.get(String(code).toUpperCase()); return d ? mapDiscount(d) : null; }
const stmtInsDiscount = db.prepare('INSERT INTO discounts (code, type, value, active, created_at) VALUES (?, ?, ?, ?, ?)');
function createDiscount(d) { stmtInsDiscount.run(String(d.code).toUpperCase(), d.type, d.value, d.active ? 1 : 0, new Date().toISOString()); }
const stmtDelDiscount = db.prepare('DELETE FROM discounts WHERE code = ?');
function deleteDiscount(code) { return stmtDelDiscount.run(String(code).toUpperCase()).changes > 0; }
const stmtToggleDiscount = db.prepare('UPDATE discounts SET active = ? WHERE code = ?');
function setDiscountActive(code, active) { return stmtToggleDiscount.run(active ? 1 : 0, String(code).toUpperCase()).changes > 0; }

module.exports = {
  createUser, getUserForAuth, getUserById, userExists, getAllUsers, setUserPassword,
  setUserRole, deleteUser, countAdmins,
  createSession, getSessionUser, deleteSession,
  createOrder, countOrders, getOrdersByUser, getAllOrders, updateOrderStatus, decrementStock, setOrderNote,
  countProducts, getAllProducts, getProductById, createProduct, updateProduct, deleteProduct, setProductImage, seedProductsIfEmpty,
  getSettings, setSetting, seedSettings,
  getDiscounts, getDiscount, createDiscount, deleteDiscount, setDiscountActive
};
