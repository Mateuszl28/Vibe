'use strict';

/*
 * Vibe - sklep z bluzami i koszulkami
 * Czysty Node.js, zero zaleznosci. Uruchomienie: node server.js
 * Konfiguracja przez zmienne srodowiskowe: PORT (domyslnie 8080), HOST (0.0.0.0)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp'
};

// ---- dane produktow (wczytywane raz, z mozliwoscia odswiezenia) ----
function loadProducts() {
  try {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  } catch (err) {
    console.error('Nie moge wczytac products.json:', err.message);
    return [];
  }
}
let PRODUCTS = loadProducts();

// ---- pomocnicze ----
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Body za duze'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Bezpieczne serwowanie plikow statycznych (ochrona przed path traversal)
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback -> index.html
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(fallback, (e2, buf) => {
        if (e2) {
          res.writeHead(404);
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(buf);
        }
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---- zamowienia ----
function readOrders() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}
function saveOrder(order) {
  const orders = readOrders();
  orders.push(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

let orderCounterSeed = readOrders().length;

function validateOrder(payload) {
  const errors = [];
  const c = payload && payload.customer ? payload.customer : {};
  if (!c.name || String(c.name).trim().length < 2) errors.push('Podaj imie i nazwisko.');
  if (!c.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(c.email))) errors.push('Podaj poprawny e-mail.');
  if (!c.address || String(c.address).trim().length < 3) errors.push('Podaj adres dostawy.');
  if (!Array.isArray(payload.items) || payload.items.length === 0) errors.push('Koszyk jest pusty.');
  return errors;
}

function handleCreateOrder(req, res, raw) {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    return sendJson(res, 400, { error: 'Niepoprawny JSON.' });
  }
  const errors = validateOrder(payload);
  if (errors.length) return sendJson(res, 400, { error: errors.join(' ') });

  // Ceny liczymy PO STRONIE SERWERA na podstawie products.json (nie ufamy klientowi)
  const lineItems = [];
  let total = 0;
  for (const item of payload.items) {
    const product = PRODUCTS.find((p) => p.id === item.id);
    if (!product) return sendJson(res, 400, { error: `Nieznany produkt: ${item.id}` });
    const qty = Math.max(1, Math.min(99, parseInt(item.qty, 10) || 1));
    const size = product.sizes.includes(item.size) ? item.size : product.sizes[0];
    const color = product.colors.includes(item.color) ? item.color : product.colors[0];
    const lineTotal = product.price * qty;
    total += lineTotal;
    lineItems.push({ id: product.id, name: product.name, price: product.price, qty, size, color, lineTotal });
  }

  const id = 'VIBE-' + String(1000 + (++orderCounterSeed));
  const order = {
    id,
    createdAt: new Date().toISOString(),
    customer: {
      name: String(payload.customer.name).trim(),
      email: String(payload.customer.email).trim(),
      phone: payload.customer.phone ? String(payload.customer.phone).trim() : '',
      address: String(payload.customer.address).trim()
    },
    items: lineItems,
    total: Math.round(total * 100) / 100,
    status: 'nowe'
  };
  try {
    saveOrder(order);
  } catch (err) {
    console.error('Blad zapisu zamowienia:', err.message);
    return sendJson(res, 500, { error: 'Nie udalo sie zapisac zamowienia.' });
  }
  console.log(`[ZAMOWIENIE] ${id} - ${order.customer.email} - ${order.total} zl`);
  return sendJson(res, 201, { ok: true, orderId: id, total: order.total });
}

// ---- router ----
const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  const method = req.method || 'GET';

  // API
  if (url.startsWith('/api/')) {
    if (method === 'GET' && url === '/api/health') {
      return sendJson(res, 200, { status: 'ok', products: PRODUCTS.length, time: new Date().toISOString() });
    }
    if (method === 'GET' && url === '/api/products') {
      return sendJson(res, 200, PRODUCTS);
    }
    if (method === 'GET' && url.startsWith('/api/products/')) {
      const id = url.replace('/api/products/', '').split('?')[0];
      const product = PRODUCTS.find((p) => p.id === id);
      if (!product) return sendJson(res, 404, { error: 'Nie znaleziono produktu.' });
      return sendJson(res, 200, product);
    }
    if (method === 'POST' && url === '/api/orders') {
      try {
        const raw = await readBody(req);
        return handleCreateOrder(req, res, raw);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }
    return sendJson(res, 404, { error: 'Nieznany endpoint API.' });
  }

  // Pliki statyczne
  return serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Vibe sklep dziala -> http://${HOST}:${PORT}`);
  console.log(`  Produktow w katalogu: ${PRODUCTS.length}`);
  console.log(`  Zamowienia zapisywane do: ${ORDERS_FILE}\n`);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\nOtrzymano ${sig}, zamykam serwer...`);
    server.close(() => process.exit(0));
  });
}
