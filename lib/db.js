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
`);

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
  INSERT INTO orders (id, user_id, customer_name, customer_email, customer_phone, customer_address, items, total, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
function createOrder(o) {
  stmtCreateOrder.run(o.id, o.user_id ?? null, o.customer.name, o.customer.email,
    o.customer.phone || '', o.customer.address, JSON.stringify(o.items), o.total, o.status, o.createdAt);
  return o;
}
const stmtCountOrders = db.prepare('SELECT COUNT(*) AS c FROM orders');
function countOrders() { return stmtCountOrders.get().c; }

function mapOrder(r) {
  return {
    id: r.id, userId: r.user_id, status: r.status, total: r.total, createdAt: r.created_at,
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

module.exports = {
  createUser, getUserForAuth, getUserById, userExists, getAllUsers, setUserPassword,
  createSession, getSessionUser, deleteSession,
  createOrder, countOrders, getOrdersByUser, getAllOrders, updateOrderStatus
};
