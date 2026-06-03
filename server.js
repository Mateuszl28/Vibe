'use strict';

/*
 * Vibe - sklep z bluzami i koszulkami
 * Czysty Node.js, zero zaleznosci. Uruchomienie: node server.js
 * Konfiguracja przez zmienne srodowiskowe: PORT (domyslnie 8080), HOST (0.0.0.0)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');
const auth = require('./lib/auth');

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
// Produkty zyja w bazie. Przy pierwszym uruchomieniu zasiewamy je z products.json.
db.seedProductsIfEmpty(loadProducts());
let PRODUCTS = db.getAllProducts();

// Bazowy adres witryny (do SEO: canonical, OG, sitemap). Ustaw przez SITE_URL.
const SITE_URL = (process.env.SITE_URL || `http://85.215.197.199:${PORT}`).replace(/\/$/, '');

// ---- Konto administratora (login + haslo z konfiguracji) ----
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
if (!db.userExists(ADMIN_USER)) {
  db.createUser({ username: ADMIN_USER, name: 'Administrator', password_hash: auth.hashPassword(ADMIN_PASSWORD), role: 'admin' });
  console.log(`[ADMIN] Utworzono konto administratora (login: ${ADMIN_USER}).`);
} else {
  // Synchronizuj haslo admina z konfiguracja (zmiana ADMIN_PASSWORD + restart = nowe haslo)
  db.setUserPassword(ADMIN_USER, auth.hashPassword(ADMIN_PASSWORD));
}
if (ADMIN_PASSWORD === 'admin123') {
  console.warn('[BEZPIECZENSTWO] Admin uzywa DOMYSLNEGO hasla "admin123". Ustaw ADMIN_PASSWORD w konfiguracji!');
}

// ---- Sesje (cookie HttpOnly + SameSite) ----
const SESSION_DAYS = 30;
function currentUser(req) {
  const token = auth.parseCookies(req.headers.cookie).vibe_session;
  return db.getSessionUser(token);
}
function startSession(res, userId) {
  const token = auth.newToken();
  const expires = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  db.createSession(token, userId, expires);
  // Uwaga: dodaj " Secure;" gdy uruchomisz HTTPS.
  res.setHeader('Set-Cookie', `vibe_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 24 * 3600}`);
}
function endSession(req, res) {
  const token = auth.parseCookies(req.headers.cookie).vibe_session;
  if (token) db.deleteSession(token);
  res.setHeader('Set-Cookie', 'vibe_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
}
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
}

// ---- Ochrona przed brute-force logowania (limit prob na IP) ----
const loginAttempts = new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec) return false;
  if (now - rec.first > 15 * 60 * 1000) { loginAttempts.delete(ip); return false; } // okno 15 min
  return rec.count >= 8;
}
function noteFailedLogin(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now - rec.first > 15 * 60 * 1000) loginAttempts.set(ip, { count: 1, first: now });
  else rec.count++;
}
function clearAttempts(ip) { loginAttempts.delete(ip); }
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ---- pomocnicze SEO/SVG ----
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + Math.round(255 * pct / 100)));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + Math.round(255 * pct / 100)));
  const b = Math.max(0, Math.min(255, (n & 255) + Math.round(255 * pct / 100)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
function contrast(hex) {
  const n = parseInt(hex.slice(1), 16);
  const yiq = ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return yiq >= 150 ? '#1a1a1a' : '#ffffff';
}
function garmentPath(category, color) {
  if (category === 'bluza') {
    return `<g fill="none" stroke="${color}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" transform="translate(-70,-70)">
      <path d="M70 35 q30 -20 60 0 l30 18 -18 30 -12 -7 v70 h-90 v-70 l-12 7 -18 -30 z"/>
      <path d="M85 35 q15 22 30 0"/></g>`;
  }
  return `<g fill="none" stroke="${color}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" transform="translate(-70,-60)">
    <path d="M70 30 l-40 22 18 30 12 -7 v62 h80 v-62 l12 7 18 -30 -40 -22 q-30 22 -60 0 z"/></g>`;
}
// Kafelek produktu (proporcje 4:5) — uzywany na stronie produktu
function productTileSvg(p) {
  return `<svg viewBox="0 0 320 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(p.name)}">
    <defs><linearGradient id="t-${p.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.color}"/><stop offset="1" stop-color="${shade(p.color, -18)}"/>
    </linearGradient></defs>
    <rect width="320" height="400" fill="url(#t-${p.id})"/>
    <g transform="translate(160,180)">${garmentPath(p.category, p.accent)}</g>
    <text x="160" y="350" text-anchor="middle" font-family="Sora, Arial" font-size="24" font-weight="800" fill="${contrast(p.color)}" opacity="0.92">${esc(p.name)}</text>
  </svg>`;
}
// Obrazek Open Graph per produkt (1200x630)
function productOgSvg(p) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
    <defs><linearGradient id="o-${p.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.color}"/><stop offset="1" stop-color="${shade(p.color, -22)}"/>
    </linearGradient></defs>
    <rect width="1200" height="630" fill="url(#o-${p.id})"/>
    <g transform="translate(900,315) scale(2.4)">${garmentPath(p.category, p.accent)}</g>
    <text x="80" y="150" font-family="Sora, Arial" font-size="40" font-weight="800" fill="${contrast(p.color)}" opacity="0.85">VIBE.</text>
    <text x="80" y="320" font-family="Sora, Arial" font-size="72" font-weight="800" fill="${contrast(p.color)}">${esc(p.name)}</text>
    <text x="80" y="400" font-family="Inter, Arial" font-size="44" font-weight="700" fill="${contrast(p.color)}" opacity="0.85">${p.price.toFixed(2)} zł</text>
  </svg>`;
}

function colorHex(name) {
  const map = { czarny:'#18181b', bialy:'#f4f4f5', szary:'#9aa1ad', grafit:'#2b2f36',
    bezowy:'#c8b59a', oliwkowy:'#5c6b3f', granatowy:'#1e2a4a', kremowy:'#ece4d4', piaskowy:'#d8c4a0' };
  return map[name] || '#888';
}
// Kafelek na karte (bez napisu) — spojny z wersja kliencka
function productCardSvg(p) {
  return `<svg viewBox="0 0 320 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><linearGradient id="c-${p.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.color}"/><stop offset="1" stop-color="${shade(p.color, -18)}"/>
    </linearGradient></defs>
    <rect width="320" height="400" fill="url(#c-${p.id})"/>
    <g transform="translate(160,180)">${garmentPath(p.category, p.accent)}</g>
  </svg>`;
}
function moneyPl(n) { return n.toFixed(2).replace('.', ',') + ' zł'; }
function starsStr(score) {
  const f = Math.round(score);
  return '★★★★★'.slice(0, f) + '☆☆☆☆☆'.slice(0, 5 - f);
}
// Serwerowo wyrenderowana karta produktu (z linkiem -> SEO)
function serverCard(p) {
  const r = ratingFor(p.id);
  const sold = p.stock <= 0;
  const stockBadge = sold ? '<span class="badge soldout">Wyprzedane</span>'
    : (p.stock <= 5 ? '<span class="badge low">Ostatnie sztuki</span>' : '');
  const addBtn = sold ? '<button class="btn-add" type="button" disabled>Wyprzedane</button>'
    : `<button class="btn-add" data-quick="${p.id}" type="button">Do koszyka</button>`;
  return `<a class="card${sold ? ' soldout' : ''}" href="/produkt/${p.id}" data-id="${p.id}">
    <div class="card-img">${productCardSvg(p)}<span class="badge cat">${p.category === 'bluza' ? 'Bluza' : 'Koszulka'}</span>${p.featured ? '<span class="badge hot">Bestseller</span>' : ''}${stockBadge}</div>
    <div class="card-body">
      <div class="card-name">${esc(p.name)}</div>
      <div class="card-rating">${starsStr(r.score)} <span>${r.score.toFixed(1)} (${r.count})</span></div>
      <div class="card-colors">${p.colors.map((c) => `<span class="swatch" style="background:${colorHex(c)}" title="${esc(c)}"></span>`).join('')}</div>
      <div class="card-foot"><span class="price">${moneyPl(p.price)}</span>${addBtn}</div>
    </div>
  </a>`;
}
function buildCatalogHtml() { return PRODUCTS.map((p) => serverCard(p)).join(''); }

// ---- SEO: dane strukturalne JSON-LD ----
function buildJsonLd() {
  const store = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Vibe',
    description: 'Sklep ze streetwearem premium — bluzy i koszulki.',
    url: SITE_URL + '/',
    image: SITE_URL + '/img/og-cover.svg',
    logo: SITE_URL + '/img/favicon.svg',
    priceRange: '79-249 zł',
    currenciesAccepted: 'PLN',
    sameAs: [
      'https://instagram.com/vibe',
      'https://tiktok.com/@vibe',
      'https://facebook.com/vibe'
    ]
  };
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: PRODUCTS.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.name,
        category: p.category === 'bluza' ? 'Bluzy' : 'Koszulki',
        description: p.description,
        url: SITE_URL + '/?produkt=' + p.id,
        offers: {
          '@type': 'Offer',
          price: p.price.toFixed(2),
          priceCurrency: 'PLN',
          availability: 'https://schema.org/InStock'
        }
      }
    }))
  };
  return `<script type="application/ld+json">${JSON.stringify([store, itemList])}</script>`;
}

// Render szablonu HTML z podstawieniem placeholderow SEO (cache w pamieci).
const renderCache = {};
function renderTemplate(absPath) {
  if (renderCache[absPath]) return renderCache[absPath];
  let html = fs.readFileSync(absPath, 'utf8');
  html = html.replace(/__SITE_URL__/g, SITE_URL);
  if (html.includes('__JSONLD__')) html = html.replace('__JSONLD__', buildJsonLd());
  if (html.includes('__CATALOG__')) html = html.replace('__CATALOG__', buildCatalogHtml());
  renderCache[absPath] = html;
  return html;
}
function getIndexHtml() {
  return renderTemplate(path.join(PUBLIC_DIR, 'index.html'));
}

// Osobne podstrony (czyste URL-e). Pliki w katalogu pages/ (poza public, nie serwowane statycznie).
const PAGES_DIR = path.join(ROOT, 'pages');
const PAGES = {
  '/dostawa-zwroty': 'dostawa-zwroty.html',
  '/tabela-rozmiarow': 'tabela-rozmiarow.html',
  '/kontakt': 'kontakt.html'
};
// Strony aplikacji (konta) — NIE trafiaja do sitemap, maja noindex w HTML.
const APP_PAGES = {
  '/logowanie': 'auth.html',
  '/rejestracja': 'auth.html',
  '/konto': 'konto.html',
  '/admin': 'admin.html'
};

// Pseudo-oceny (stabilne na podstawie id) — identyczne jak na frontendzie
function ratingFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return { score: (4.5 + (h % 5) / 10), count: 40 + (h % 260) };
}

// JSON-LD dla pojedynczego produktu (Product + BreadcrumbList)
function buildProductJsonLd(p) {
  const r = ratingFor(p.id);
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    image: SITE_URL + '/img/produkt/' + p.id + '.svg',
    category: p.category === 'bluza' ? 'Bluzy' : 'Koszulki',
    brand: { '@type': 'Brand', name: 'Vibe' },
    color: p.colors.join(', '),
    offers: {
      '@type': 'Offer',
      price: p.price.toFixed(2),
      priceCurrency: 'PLN',
      availability: 'https://schema.org/InStock',
      url: SITE_URL + '/produkt/' + p.id
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: r.score.toFixed(1),
      reviewCount: r.count,
      bestRating: '5'
    }
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Strona główna', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: p.category === 'bluza' ? 'Bluzy' : 'Koszulki', item: SITE_URL + '/' },
      { '@type': 'ListItem', position: 3, name: p.name, item: SITE_URL + '/produkt/' + p.id }
    ]
  };
  return `<script type="application/ld+json">${JSON.stringify([product, crumbs])}</script>`;
}

// Render strony produktu z szablonu pages/produkt.html
const productCache = {};
function getProductHtml(p) {
  if (productCache[p.id]) return productCache[p.id];
  const r = ratingFor(p.id);
  const tpl = fs.readFileSync(path.join(PAGES_DIR, 'produkt.html'), 'utf8');
  const catLabel = p.category === 'bluza' ? 'Bluzy' : 'Koszulki';
  const sizeOpts = p.sizes.map((s, i) => `<button type="button" class="opt ${i === 0 ? 'selected' : ''}" data-size="${esc(s)}">${esc(s)}</button>`).join('');
  const colorOpts = p.colors.map((c, i) => `<button type="button" class="opt ${i === 0 ? 'selected' : ''}" data-color="${esc(c)}">${esc(c)}</button>`).join('');
  const stars = '★★★★★'.slice(0, Math.round(r.score)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(r.score));
  const repl = {
    SITE_URL,
    JSONLD: buildProductJsonLd(p),
    P_ID: esc(p.id),
    P_NAME: esc(p.name),
    P_DESC: esc(p.description),
    P_CAT: esc(catLabel),
    P_PRICE: p.price.toFixed(2).replace('.', ',') + ' zł',
    P_IMG: productTileSvg(p),
    P_SIZES: sizeOpts,
    P_COLORS: colorOpts,
    P_STARS: stars,
    P_SCORE: r.score.toFixed(1),
    P_COUNT: String(r.count),
    P_ADDBTN: p.stock > 0
      ? `<button class="btn btn-primary btn-block" id="ppAdd" data-id="${esc(p.id)}">Dodaj do koszyka</button>`
      : '<button class="btn btn-primary btn-block" disabled>Wyprzedane</button>',
    P_STOCK_NOTE: p.stock > 0
      ? (p.stock <= 5 ? `<p class="pp-stock low">Zostały ostatnie sztuki: ${p.stock}</p>` : '<p class="pp-stock">✔ Dostępny, wysyłka 48h</p>')
      : '<p class="pp-stock soldout">Produkt chwilowo niedostępny</p>'
  };
  let html = tpl.replace(/__([A-Z_]+)__/g, (m, key) => (key in repl ? repl[key] : m));
  productCache[p.id] = html;
  return html;
}
function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(html);
}

// Przeladowanie produktow z bazy + uniewaznienie cache stron (po zmianach admina)
function refreshProducts() {
  PRODUCTS = db.getAllProducts();
  for (const k in renderCache) delete renderCache[k];
  for (const k in productCache) delete productCache[k];
}

const ROBOTS_TXT = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
function buildSitemap() {
  const urls = [SITE_URL + '/']
    .concat(Object.keys(PAGES).map((slug) => SITE_URL + slug))
    .concat(PRODUCTS.map((p) => SITE_URL + '/produkt/' + p.id));
  const body = urls.map((u) => `  <url><loc>${u}</loc><changefreq>weekly</changefreq></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

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
      // SPA fallback -> wygenerowany index.html (z danymi SEO)
      try {
        sendHtml(res, getIndexHtml());
      } catch {
        res.writeHead(404);
        res.end('404 Not Found');
      }
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

// ---- zamowienia (baza danych) ----
function validateOrder(payload) {
  const errors = [];
  const c = payload && payload.customer ? payload.customer : {};
  if (!c.name || String(c.name).trim().length < 2) errors.push('Podaj imie i nazwisko.');
  if (!c.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(c.email))) errors.push('Podaj poprawny e-mail.');
  if (!c.address || String(c.address).trim().length < 3) errors.push('Podaj adres dostawy.');
  if (!Array.isArray(payload.items) || payload.items.length === 0) errors.push('Koszyk jest pusty.');
  return errors;
}

function handleCreateOrder(req, res, raw, user) {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    return sendJson(res, 400, { error: 'Niepoprawny JSON.' });
  }
  const errors = validateOrder(payload);
  if (errors.length) return sendJson(res, 400, { error: errors.join(' ') });

  // Ceny liczymy PO STRONIE SERWERA na podstawie bazy (nie ufamy klientowi)
  const lineItems = [];
  const needPerProduct = {};
  let total = 0;
  for (const item of payload.items) {
    const product = PRODUCTS.find((p) => p.id === item.id);
    if (!product) return sendJson(res, 400, { error: `Nieznany produkt: ${item.id}` });
    const qty = Math.max(1, Math.min(99, parseInt(item.qty, 10) || 1));
    const size = product.sizes.includes(item.size) ? item.size : product.sizes[0];
    const color = product.colors.includes(item.color) ? item.color : product.colors[0];
    const lineTotal = product.price * qty;
    total += lineTotal;
    needPerProduct[product.id] = (needPerProduct[product.id] || 0) + qty;
    lineItems.push({ id: product.id, name: product.name, price: product.price, qty, size, color, lineTotal });
  }

  // Kontrola stanu magazynowego (swieze dane z bazy)
  for (const id in needPerProduct) {
    const fresh = db.getProductById(id);
    if (!fresh || fresh.stock < needPerProduct[id]) {
      const name = fresh ? fresh.name : id;
      return sendJson(res, 409, { error: `Brak wystarczajacej liczby sztuk: ${name} (dostepne: ${fresh ? fresh.stock : 0}).` });
    }
  }

  const order = {
    id: 'VIBE-' + String(1001 + db.countOrders()),
    user_id: user ? user.id : null,
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
    db.createOrder(order);
    for (const id in needPerProduct) db.decrementStock(id, needPerProduct[id]);
    refreshProducts(); // zaktualizuj katalog/cache po zdjeciu stanu
  } catch (err) {
    console.error('Blad zapisu zamowienia:', err.message);
    return sendJson(res, 500, { error: 'Nie udalo sie zapisac zamowienia.' });
  }
  console.log(`[ZAMOWIENIE] ${order.id} - ${order.customer.email} - ${order.total} zl${user ? ' (user ' + user.id + ')' : ''}`);
  return sendJson(res, 201, { ok: true, orderId: order.id, total: order.total });
}

// ---- Uwierzytelnianie ----
function handleRegister(req, res, raw) {
  let p; try { p = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { error: 'Niepoprawny JSON.' }); }
  const name = String(p.name || '').trim();
  const email = String(p.email || '').trim().toLowerCase();
  const password = String(p.password || '');
  if (name.length < 2) return sendJson(res, 400, { error: 'Podaj imie i nazwisko (min. 2 znaki).' });
  if (!EMAIL_RE.test(email)) return sendJson(res, 400, { error: 'Podaj poprawny adres e-mail.' });
  if (password.length < 8) return sendJson(res, 400, { error: 'Haslo musi miec min. 8 znakow.' });
  if (db.userExists(email)) return sendJson(res, 409, { error: 'Konto z tym e-mailem juz istnieje.' });
  let user;
  try {
    user = db.createUser({ email, name, password_hash: auth.hashPassword(password), role: 'customer' });
  } catch (err) {
    return sendJson(res, 409, { error: 'Nie udalo sie utworzyc konta (e-mail zajety).' });
  }
  startSession(res, user.id);
  return sendJson(res, 201, { ok: true, user });
}

function handleLogin(req, res, raw, ip) {
  if (tooManyAttempts(ip)) return sendJson(res, 429, { error: 'Za duzo prob logowania. Sprobuj za 15 minut.' });
  let p; try { p = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { error: 'Niepoprawny JSON.' }); }
  const login = String(p.login || '').trim().toLowerCase();
  const password = String(p.password || '');
  const row = db.getUserForAuth(login);
  if (!row || !auth.verifyPassword(password, row.password_hash)) {
    noteFailedLogin(ip);
    return sendJson(res, 401, { error: 'Niepoprawny login lub haslo.' });
  }
  clearAttempts(ip);
  startSession(res, row.id);
  return sendJson(res, 200, { ok: true, user: db.getUserById(row.id) });
}

// ---- wiadomosci z formularza kontaktowego ----
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
function handleContact(res, raw) {
  let p;
  try { p = JSON.parse(raw || '{}'); } catch { return sendJson(res, 400, { error: 'Niepoprawny JSON.' }); }
  const name = String(p.name || '').trim();
  const email = String(p.email || '').trim();
  const message = String(p.message || '').trim();
  if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || message.length < 5) {
    return sendJson(res, 400, { error: 'Uzupelnij poprawnie imie, e-mail i wiadomosc.' });
  }
  try {
    let list = [];
    try { list = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } catch {}
    list.push({ name, email, message, createdAt: new Date().toISOString() });
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('Blad zapisu wiadomosci:', err.message);
    return sendJson(res, 500, { error: 'Nie udalo sie wyslac wiadomosci.' });
  }
  console.log(`[KONTAKT] ${email} - ${name}`);
  return sendJson(res, 201, { ok: true });
}

// ---- produkty: walidacja/normalizacja (panel admina) ----
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
function parseList(v) {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}
function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
function buildProductFromPayload(p) {
  const name = String(p.name || '').trim();
  const category = p.category === 'bluza' ? 'bluza' : (p.category === 'koszulka' ? 'koszulka' : '');
  const price = Math.round(Number(p.price) * 100) / 100;
  const colors = parseList(p.colors);
  const sizes = parseList(p.sizes);
  const color = HEX_RE.test(p.color) ? p.color : '#1f2933';
  const accent = HEX_RE.test(p.accent) ? p.accent : '#7c5cff';
  const description = String(p.description || '').trim();
  const featured = !!p.featured;
  let stock = parseInt(p.stock, 10);
  if (!Number.isFinite(stock) || stock < 0) stock = 0;
  const errors = [];
  if (name.length < 2) errors.push('Podaj nazwe produktu.');
  if (!category) errors.push('Wybierz kategorie (bluza/koszulka).');
  if (!(price > 0) || !isFinite(price)) errors.push('Podaj poprawna cene (> 0).');
  if (!colors.length) errors.push('Podaj min. 1 kolor.');
  if (!sizes.length) errors.push('Podaj min. 1 rozmiar.');
  if (description.length < 3) errors.push('Podaj opis.');
  return { errors, product: { name, category, price, colors, sizes, color, accent, description, featured, stock } };
}

// ---- router ----
const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const url = req.url || '/';
  const method = req.method || 'GET';
  const pathOnly = url.split('?')[0];

  // SEO: robots.txt i sitemap.xml
  if (method === 'GET' && pathOnly === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(ROBOTS_TXT);
  }
  if (method === 'GET' && pathOnly === '/sitemap.xml') {
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
    return res.end(buildSitemap());
  }

  // Strona glowna -> wygenerowany index.html z danymi strukturalnymi
  if (method === 'GET' && (pathOnly === '/' || pathOnly === '/index.html')) {
    return sendHtml(res, getIndexHtml());
  }

  // Osobne podstrony (Pomoc): /dostawa-zwroty, /tabela-rozmiarow, /kontakt
  if (method === 'GET' && PAGES[pathOnly]) {
    try {
      return sendHtml(res, renderTemplate(path.join(PAGES_DIR, PAGES[pathOnly])));
    } catch {
      res.writeHead(404); return res.end('404');
    }
  }

  // Strony kont (logowanie/rejestracja/konto/admin) z kontrola dostepu po stronie serwera
  if (method === 'GET' && APP_PAGES[pathOnly]) {
    const u = currentUser(req);
    if (pathOnly === '/konto' && !u) { res.writeHead(302, { Location: '/logowanie?next=/konto' }); return res.end(); }
    if (pathOnly === '/admin' && (!u || u.role !== 'admin')) { res.writeHead(302, { Location: '/logowanie?next=/admin' }); return res.end(); }
    if ((pathOnly === '/logowanie' || pathOnly === '/rejestracja') && u) {
      res.writeHead(302, { Location: u.role === 'admin' ? '/admin' : '/konto' }); return res.end();
    }
    try { return sendHtml(res, renderTemplate(path.join(PAGES_DIR, APP_PAGES[pathOnly]))); }
    catch { res.writeHead(404); return res.end('404'); }
  }

  // Obrazek Open Graph produktu: /img/produkt/<id>.svg
  if (method === 'GET' && pathOnly.startsWith('/img/produkt/') && pathOnly.endsWith('.svg')) {
    const id = pathOnly.slice('/img/produkt/'.length, -'.svg'.length);
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
    return res.end(productOgSvg(p));
  }

  // Strona produktu: /produkt/<id>
  if (method === 'GET' && pathOnly.startsWith('/produkt/')) {
    const id = pathOnly.slice('/produkt/'.length).replace(/\/$/, '');
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<h1>404 — nie znaleziono produktu</h1><a href="/">Wróć do sklepu</a>'); }
    try {
      return sendHtml(res, getProductHtml(p));
    } catch (err) {
      console.error('Blad renderowania produktu:', err.message);
      res.writeHead(500); return res.end('500');
    }
  }

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
        return handleCreateOrder(req, res, raw, currentUser(req));
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }
    if (method === 'POST' && url === '/api/contact') {
      try {
        const raw = await readBody(req);
        return handleContact(res, raw);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    // --- Uwierzytelnianie ---
    if (method === 'POST' && url === '/api/auth/register') {
      try { return handleRegister(req, res, await readBody(req)); }
      catch (err) { return sendJson(res, 400, { error: err.message }); }
    }
    if (method === 'POST' && url === '/api/auth/login') {
      try { return handleLogin(req, res, await readBody(req), ip); }
      catch (err) { return sendJson(res, 400, { error: err.message }); }
    }
    if (method === 'POST' && url === '/api/auth/logout') {
      endSession(req, res);
      return sendJson(res, 200, { ok: true });
    }
    if (method === 'GET' && url === '/api/auth/me') {
      const u = currentUser(req);
      return sendJson(res, 200, { user: u || null });
    }

    // --- Konto klienta ---
    if (method === 'GET' && url === '/api/orders/mine') {
      const u = currentUser(req);
      if (!u) return sendJson(res, 401, { error: 'Wymagane logowanie.' });
      return sendJson(res, 200, { orders: db.getOrdersByUser(u.id) });
    }

    // --- Panel admina (twarda kontrola roli) ---
    if (url.startsWith('/api/admin/')) {
      const u = currentUser(req);
      if (!u || u.role !== 'admin') return sendJson(res, 403, { error: 'Brak uprawnien.' });
      if (method === 'GET' && url === '/api/admin/orders') {
        return sendJson(res, 200, { orders: db.getAllOrders() });
      }
      if (method === 'GET' && url === '/api/admin/users') {
        return sendJson(res, 200, { users: db.getAllUsers() });
      }
      if (method === 'GET' && url === '/api/admin/messages') {
        let list = [];
        try { list = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } catch {}
        return sendJson(res, 200, { messages: list.reverse() });
      }
      if (method === 'POST' && url === '/api/admin/users/role') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const id = parseInt(p.id, 10);
          const role = p.role === 'admin' ? 'admin' : (p.role === 'customer' ? 'customer' : null);
          if (!id || !role) return sendJson(res, 400, { error: 'Niepoprawne dane.' });
          if (id === u.id) return sendJson(res, 400, { error: 'Nie mozesz zmienic wlasnej roli.' });
          const target = db.getUserById(id);
          if (!target) return sendJson(res, 404, { error: 'Nie ma takiego uzytkownika.' });
          if (target.role === 'admin' && role === 'customer' && db.countAdmins() <= 1)
            return sendJson(res, 400, { error: 'To ostatni administrator.' });
          db.setUserRole(id, role);
          return sendJson(res, 200, { ok: true });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      if (method === 'POST' && url === '/api/admin/users/delete') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const id = parseInt(p.id, 10);
          if (!id) return sendJson(res, 400, { error: 'Niepoprawne dane.' });
          if (id === u.id) return sendJson(res, 400, { error: 'Nie mozesz usunac wlasnego konta.' });
          const target = db.getUserById(id);
          if (!target) return sendJson(res, 404, { error: 'Nie ma takiego uzytkownika.' });
          if (target.role === 'admin' && db.countAdmins() <= 1)
            return sendJson(res, 400, { error: 'Nie mozna usunac ostatniego admina.' });
          db.deleteUser(id);
          return sendJson(res, 200, { ok: true });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      if (method === 'POST' && url === '/api/admin/messages/delete') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          let list = [];
          try { list = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } catch {}
          const before = list.length;
          list = list.filter((m) => m.createdAt !== p.createdAt);
          fs.writeFileSync(MESSAGES_FILE, JSON.stringify(list, null, 2));
          return sendJson(res, 200, { ok: true, removed: before - list.length });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      if (method === 'POST' && url === '/api/admin/order-status') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const allowed = ['nowe', 'w realizacji', 'wyslane', 'zrealizowane', 'anulowane'];
          if (!p.id || !allowed.includes(p.status)) return sendJson(res, 400, { error: 'Niepoprawne dane.' });
          const ok = db.updateOrderStatus(String(p.id), p.status);
          return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Nie znaleziono zamowienia.' });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      // Produkty: dodawanie / edycja / usuwanie
      if (method === 'POST' && url === '/api/admin/products') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const { errors, product } = buildProductFromPayload(p);
          if (errors.length) return sendJson(res, 400, { error: errors.join(' ') });
          let id = slugify(p.id || product.name) || ('produkt-' + (db.countProducts() + 1));
          if (db.getProductById(id)) id = id + '-' + (db.countProducts() + 1);
          db.createProduct({ ...product, id, sort: db.countProducts() });
          refreshProducts();
          return sendJson(res, 201, { ok: true, id });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      if (method === 'POST' && url === '/api/admin/products/update') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          if (!p.id || !db.getProductById(String(p.id))) return sendJson(res, 404, { error: 'Nie ma takiego produktu.' });
          const { errors, product } = buildProductFromPayload(p);
          if (errors.length) return sendJson(res, 400, { error: errors.join(' ') });
          db.updateProduct({ ...product, id: String(p.id) });
          refreshProducts();
          return sendJson(res, 200, { ok: true });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      if (method === 'POST' && url === '/api/admin/products/delete') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const ok = db.deleteProduct(String(p.id || ''));
          if (ok) refreshProducts();
          return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Nie znaleziono produktu.' });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      return sendJson(res, 404, { error: 'Nieznany endpoint admina.' });
    }

    return sendJson(res, 404, { error: 'Nieznany endpoint API.' });
  }

  // Pliki statyczne
  return serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Vibe sklep dziala -> http://${HOST}:${PORT}`);
  console.log(`  Produktow w katalogu: ${PRODUCTS.length}`);
  console.log(`  Baza danych: data/vibe.db (SQLite) | login admina: ${ADMIN_USER}\n`);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\nOtrzymano ${sig}, zamykam serwer...`);
    server.close(() => process.exit(0));
  });
}
