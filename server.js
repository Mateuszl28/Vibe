'use strict';

/*
 * Vibe - sklep z bluzami i koszulkami
 * Czysty Node.js, zero zaleznosci. Uruchomienie: node server.js
 * Konfiguracja przez zmienne srodowiskowe: PORT (domyslnie 8080), HOST (0.0.0.0)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const db = require('./lib/db');
const auth = require('./lib/auth');
const PRODUCT_I18N = require('./lib/product-i18n'); // tlumaczenia nazw/opisow produktow (SEO EN/DE)
// Slownik tlumaczen produktow wstrzykiwany do przegladarki, zeby klient (i18n.js)
// tlumaczyl nazwy i opisy produktow (karty, strona produktu, koszyk).
// Laczymy slownik statyczny (lib/product-i18n.js) z tlumaczeniami z panelu admina
// (pola name_en/name_de/desc_en/desc_de przy produkcie). Panel ma pierwszenstwo.
let PRODUCT_I18N_SCRIPT = '';
function buildProductI18nScript() {
  const en = Object.assign({}, PRODUCT_I18N.en);
  const de = Object.assign({}, PRODUCT_I18N.de);
  try {
    for (const p of db.getAllProducts()) {
      if (p.name_en) en[p.name] = p.name_en;
      if (p.desc_en) en[p.description] = p.desc_en;
      if (p.name_de) de[p.name] = p.name_de;
      if (p.desc_de) de[p.description] = p.desc_de;
    }
  } catch (e) { /* baza moze byc jeszcze niegotowa */ }
  PRODUCT_I18N_SCRIPT = '<script>window.__VIBE_PRODUCT_I18N__=' +
    JSON.stringify({ en, de }).replace(/</g, '\\u003c') + ';</script>';
}

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
  '.webp': 'image/webp',
  '.avif': 'image/avif'
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
buildProductI18nScript();

// Domyslne ustawienia sklepu (edytowalne z panelu admina)
db.seedSettings({
  free_shipping_threshold: '0',
  shipping_cost: '25.00',
  announce_text: 'Wysyłka 24h  ·  14 dni na zwrot  ·  Bezpieczne płatności',
  contact_email: 'kontakt@vibeleszno.com',
  contact_phone: '+48 665 799 919'
});

// Katalog na wgrane zdjecia produktow (serwowany jako statyczny z /uploads)
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Doklejenie realnych ocen (z opinii klientow) do produktow
function applyRatings(list) {
  const m = db.getRatingsMap();
  list.forEach((p) => { p.rating = m[p.id] || { avg: 0, count: 0 }; });
  return list;
}
applyRatings(PRODUCTS);

// Stan magazynowy z uwzglednieniem wariantow (per rozmiar/kolor)
function variantKey(size, color) { return `${size}||${color}`; }
function availableStock(p) {
  if (p.variants && Object.keys(p.variants).length) {
    return Object.values(p.variants).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
  }
  return p.stock;
}
function variantStock(p, size, color) {
  if (p.variants && Object.keys(p.variants).length) {
    const k = variantKey(size, color);
    return k in p.variants ? (parseInt(p.variants[k], 10) || 0) : 0;
  }
  return p.stock;
}

// Bazowy adres witryny (do SEO: canonical, OG, sitemap). Ustaw przez SITE_URL.
const SITE_URL = (process.env.SITE_URL || 'https://vibeleszno.com').replace(/\/$/, '');

// Dane do przelewu — instrukcja platnosci pokazywana po zlozeniu zamowienia.
// UWAGA: ustaw realne dane przez zmienne srodowiskowe (PAY_ACCOUNT, PAY_RECIPIENT, PAY_BANK)
// albo podmien wartosci domyslne ponizej. Numer konta moze byc z lub bez "PL".
const PAYMENT = {
  recipient: process.env.PAY_RECIPIENT || 'VIP Nieruchomości Paweł Domagała',
  account: process.env.PAY_ACCOUNT || '61 1140 2004 0000 3002 7763 8000',
  bank: process.env.PAY_BANK || 'mBank'
};

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

// ---- Sesje (cookie HttpOnly + SameSite + Secure na HTTPS) ----
const SESSION_DAYS = 30;
// HTTPS rozpoznajemy po naglowku od nginx (proxy_set_header X-Forwarded-Proto $scheme).
function isSecureReq(req) {
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}
function currentUser(req) {
  const token = auth.parseCookies(req.headers.cookie).vibe_session;
  return db.getSessionUser(token);
}
function sessionCookie(req, value, maxAge) {
  const secure = isSecureReq(req) ? ' Secure;' : '';
  return `vibe_session=${value}; HttpOnly;${secure} SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}
function startSession(req, res, userId) {
  const token = auth.newToken();
  const expires = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  db.createSession(token, userId, expires);
  res.setHeader('Set-Cookie', sessionCookie(req, token, SESSION_DAYS * 24 * 3600));
}
function endSession(req, res) {
  const token = auth.parseCookies(req.headers.cookie).vibe_session;
  if (token) db.deleteSession(token);
  res.setHeader('Set-Cookie', sessionCookie(req, '', 0));
}

// Content-Security-Policy: 'self' + tylko zaufane zewnetrzne zrodla (Google Fonts, InPost Geowidget).
// Brak inline <script>/on*= w kodzie sklepu, wiec script-src moze byc bez 'unsafe-inline' (realna ochrona przed XSS).
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://geowidget.inpost.pl",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://geowidget.inpost.pl",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.inpost.pl https://*.easypack24.net",
  "frame-src https://geowidget.inpost.pl",
  "worker-src 'self' blob:"
].join('; ');
function setSecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  if (isSecureReq(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

// Ochrona CSRF (uzupelnienie SameSite=Strict): dla zadan zmieniajacych stan
// sprawdzamy, czy Origin zgadza sie z hostem. Brak Origin (np. nie-przegladarkowy klient) nie blokujemy.
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

// Prosty limiter zadan na IP (rejestracja, formularz kontaktowy) — anty-spam/abuse.
const rlBuckets = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const rec = rlBuckets.get(key);
  if (!rec || now - rec.first > windowMs) { rlBuckets.set(key, { count: 1, first: now }); return false; }
  rec.count++;
  return rec.count > max;
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
// Galeria zdjec na stronie produktu: glowne zdjecie + miniatury (przelaczane w JS)
function buildGallery(p) {
  const imgs = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
  if (!imgs.length) return productTileSvg(p);
  const main = `<div class="gallery-main"><img class="gallery-photo" id="galleryMain" src="${esc(imgs[0])}" alt="${esc(p.name)}"></div>`;
  if (imgs.length === 1) return main;
  const thumbs = imgs.map((src, i) =>
    `<button type="button" class="gallery-thumb${i === 0 ? ' active' : ''}" data-src="${esc(src)}" aria-label="Zdjęcie ${i + 1}"><img src="${esc(src)}" alt="" width="64" height="64"></button>`
  ).join('');
  return main + `<div class="gallery-thumbs">${thumbs}</div>`;
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
  const rt = p.rating || { avg: 0, count: 0 };
  const ratingHtml = rt.count > 0
    ? `<div class="card-rating">${starsStr(rt.avg)} <span>${rt.avg.toFixed(1)} (${rt.count})</span></div>`
    : '';
  const avail = availableStock(p);
  const sold = avail <= 0;
  const stockBadge = sold ? '<span class="badge soldout">Wyprzedane</span>'
    : (avail <= 5 ? '<span class="badge low">Ostatnie sztuki</span>' : '');
  const addBtn = sold ? '<button class="btn-add" type="button" disabled>Wyprzedane</button>'
    : `<button class="btn-add" data-quick="${p.id}" type="button">Do koszyka</button>`;
  const media = p.image ? `<img class="card-photo" src="${esc(p.image)}" alt="${esc(p.name)}" width="800" height="1000" loading="lazy">` : productCardSvg(p);
  return `<a class="card${sold ? ' soldout' : ''}" href="/produkt/${p.id}" data-id="${p.id}">
    <div class="card-img">${media}<span class="badge cat">${p.category === 'bluza' ? 'Bluza' : 'Koszulka'}</span>${p.featured ? '<span class="badge hot">Bestseller</span>' : ''}${stockBadge}</div>
    <div class="card-body">
      <div class="card-name">${esc(p.name)}</div>
      ${ratingHtml}
      <div class="card-colors">${p.colors.map((c) => `<span class="swatch" style="background:${colorHex(c)}" title="${esc(c)}"></span>`).join('')}</div>
      <div class="card-foot"><span class="price">${moneyPl(p.price)}</span>${addBtn}</div>
    </div>
  </a>`;
}
function buildCatalogHtml() { return PRODUCTS.map((p) => serverCard(p)).join(''); }

// ---- SEO: FAQ (jedno zrodlo prawdy dla widocznej tresci i schematu FAQPage) ----
const FAQ = [
  {
    q: 'Jak dobrać rozmiar bluzy lub koszulki Vibe?',
    a: 'W każdej karcie produktu znajdziesz dostępne rozmiary od S do XXL. Dokładne wymiary w centymetrach (obwód klatki, długość) zebraliśmy w <a href="/tabela-rozmiarow">tabeli rozmiarów</a>. Jeśli wahasz się między dwoma rozmiarami, przy oversize wybierz mniejszy, a przy klasycznym kroju — większy.'
  },
  {
    q: 'Ile kosztuje i jak długo trwa dostawa?',
    a: 'Zamówienia złożone do 13:00 w dni robocze wysyłamy tego samego dnia — kurierem lub do paczkomatu. Czas doręczenia to zwykle 1–2 dni robocze. Szczegóły i koszty znajdziesz na stronie <a href="/dostawa-zwroty">Dostawa i zwroty</a>.'
  },
  {
    q: 'Czy mogę zwrócić lub wymienić zamówiony produkt?',
    a: 'Tak. Masz 14 dni na zwrot bez podawania przyczyny. Wystarczy, że produkt jest nieużywany i z metką. Zasady zwrotów i wymiany opisaliśmy w sekcji <a href="/dostawa-zwroty">Dostawa i zwroty</a>.'
  },
  {
    q: 'Z jakiego materiału uszyte są ubrania Vibe?',
    a: 'Stawiamy na naturalną, gęstą bawełnę. Koszulki to 100% oddychającej bawełny, a bluzy mają mocny, miękki materiał z podwójnym kapturem. Kolory nie blakną po praniu, a szwy są wzmocnione.'
  },
  {
    q: 'Czy Vibe to sklep z Leszna?',
    a: 'Tak, Vibe to polska marka odzieżowa z okolic Leszna (Wilkowice, ul. Pszenna 30). Wysyłamy zamówienia w całej Polsce, a klientów z Leszna i okolic obsługujemy szczególnie szybko.'
  },
  {
    q: 'Jak skontaktować się ze sklepem?',
    a: 'Napisz na kontakt@vibeleszno.com, zadzwoń pod +48 665 799 919 (pn–pt 9:00–17:00) lub skorzystaj z formularza na stronie <a href="/kontakt">Kontakt</a>.'
  }
];
function stripTags(s) { return s.replace(/<[^>]+>/g, ''); }
function buildFaqHtml() {
  const items = FAQ.map((f) =>
    `      <details class="faq-item">\n        <summary>${f.q}</summary>\n        <div class="faq-answer"><p>${f.a}</p></div>\n      </details>`
  ).join('\n');
  return `<section class="container page-wrap" aria-label="Najczęściej zadawane pytania">\n    <div class="content">\n      <h2>Najczęściej zadawane pytania</h2>\n${items}\n    </div>\n  </section>`;
}
function buildFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) }
    }))
  };
}

// ---- SEO: dane strukturalne JSON-LD ----
function buildJsonLd() {
  const store = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: 'Vibe',
    description: 'Sklep ze streetwearem premium — bluzy i koszulki. Leszno i okolice.',
    url: SITE_URL + '/',
    image: SITE_URL + '/img/logo.jpg',
    logo: SITE_URL + '/img/logo.jpg',
    priceRange: '79-249 zł',
    currenciesAccepted: 'PLN',
    paymentAccepted: 'Przelew, BLIK, karta płatnicza',
    email: 'kontakt@vibeleszno.com',
    telephone: '+48665799919',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'ul. Pszenna 30',
      postalCode: '64-115',
      addressLocality: 'Wilkowice',
      addressRegion: 'wielkopolskie',
      addressCountry: 'PL'
    },
    areaServed: [
      { '@type': 'City', name: 'Leszno' },
      { '@type': 'City', name: 'Wilkowice' }
    ],
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '17:00'
    }]
  };
  // Prawdziwe profile social (env SOCIAL_LINKS, po przecinku) -> sameAs. Brak = nie dodajemy
  // (Google nie lubi martwych/placeholderowych linkow).
  const social = (process.env.SOCIAL_LINKS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (social.length) store.sameAs = social;
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: PRODUCTS.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: (() => {
        const rt = p.rating || { avg: 0, count: 0 };
        const prod = {
          '@type': 'Product',
          name: p.name,
          category: p.category === 'bluza' ? 'Bluzy' : 'Koszulki',
          description: p.description,
          image: p.image ? SITE_URL + p.image : SITE_URL + '/img/produkt/' + p.id + '.svg',
          brand: { '@type': 'Brand', name: 'Vibe' },
          sku: String(p.id),
          url: SITE_URL + '/produkt/' + p.id,
          offers: {
            '@type': 'Offer',
            price: p.price.toFixed(2),
            priceCurrency: 'PLN',
            availability: availableStock(p) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: SITE_URL + '/produkt/' + p.id
          }
        };
        // AggregateRating tylko gdy sa prawdziwe opinie (wymog Google)
        if (rt.count > 0) {
          prod.aggregateRating = { '@type': 'AggregateRating', ratingValue: rt.avg.toFixed(1), reviewCount: rt.count, bestRating: '5' };
        }
        return prod;
      })()
    }))
  };
  return `<script type="application/ld+json">${JSON.stringify([store, itemList, buildFaqJsonLd()])}</script>`;
}

// Render szablonu HTML z podstawieniem placeholderow SEO (cache w pamieci).
const renderCache = {};
function renderTemplate(absPath) {
  if (renderCache[absPath]) return renderCache[absPath];
  let html = fs.readFileSync(absPath, 'utf8');
  html = html.replace(/__SITE_URL__/g, SITE_URL);
  if (html.includes('__ANNOUNCE__')) html = html.replace(/__ANNOUNCE__/g, esc(db.getSettings().announce_text || ''));
  if (html.includes('__JSONLD__')) html = html.replace('__JSONLD__', buildJsonLd());
  if (html.includes('__CATALOG__')) html = html.replace('__CATALOG__', buildCatalogHtml());
  if (html.includes('__FAQ__')) html = html.replace('__FAQ__', buildFaqHtml());
  html = html.replace('</body>', PAYMENTS_HTML + COOKIE_HTML + PRODUCT_I18N_SCRIPT + '</body>');
  renderCache[absPath] = html;
  return html;
}
function getIndexHtml() {
  return renderTemplate(path.join(PUBLIC_DIR, 'index.html'));
}
function get404Html() {
  return renderTemplate(path.join(PAGES_DIR, '404.html'));
}

// Osobne podstrony (czyste URL-e). Pliki w katalogu pages/ (poza public, nie serwowane statycznie).
const PAGES_DIR = path.join(ROOT, 'pages');
const PAGES = {
  '/eventy': 'eventy.html',
  '/dostawa-zwroty': 'dostawa-zwroty.html',
  '/tabela-rozmiarow': 'tabela-rozmiarow.html',
  '/kontakt': 'kontakt.html',
  '/regulamin': 'regulamin.html',
  '/polityka-prywatnosci': 'polityka-prywatnosci.html'
};

// Baner cookies (RODO) — wstrzykiwany do kazdej strony przed </body>
const COOKIE_HTML = `<div class="cookie-bar" id="cookieBar" hidden>
  <span>Używamy plików cookie i pamięci przeglądarki do działania koszyka, logowania i statystyk. Szczegóły w <a href="/polityka-prywatnosci">polityce prywatności</a>.</span>
  <button class="btn btn-primary" id="cookieAccept" type="button">Akceptuję</button>
</div>
<script>(function(){try{if(!localStorage.getItem('vibe_cookie')){var b=document.getElementById('cookieBar');if(b){b.hidden=false;document.getElementById('cookieAccept').onclick=function(){localStorage.setItem('vibe_cookie','1');b.hidden=true;};}}}catch(e){}})();</script>`;
// Pasek akceptowanych metod platnosci (Przelewy24) — wstrzykiwany do kazdej strony przed </body>.
// Logotypy lokalne w /img/payments/ (mozna podmienic na oficjalne pliki z paczki ZIP z panelu Przelewy24).
const PAYMENTS_HTML = `<style>.pay-bar{border-top:1px solid #eee;background:#fafafa;padding:14px 20px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 14px}.pay-bar__label{font-size:.82rem;color:#6b7280;font-weight:500}.pay-bar__logos{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center}.pay-bar__logos img{height:24px;width:auto;display:block}</style>
<div class="pay-bar" role="group" aria-label="Akceptowane metody płatności">
  <span class="pay-bar__label">Bezpieczne płatności</span>
  <span class="pay-bar__logos">
    <img src="/img/payments/blik.svg" alt="BLIK" width="36" height="24" loading="lazy" />
    <img src="/img/payments/visa.svg" alt="Visa" width="36" height="24" loading="lazy" />
    <img src="/img/payments/mastercard.svg" alt="Mastercard" width="36" height="24" loading="lazy" />
    <img src="/img/payments/przelewy24.svg" alt="Przelewy24" width="72" height="24" loading="lazy" />
  </span>
</div>`;
// Strony aplikacji (konta) — NIE trafiaja do sitemap, maja noindex w HTML.
const APP_PAGES = {
  '/logowanie': 'auth.html',
  '/rejestracja': 'auth.html',
  '/konto': 'konto.html',
  '/admin': 'admin.html',
  '/ulubione': 'ulubione.html',
  '/koszyk': 'koszyk.html'
};

function starsHtml(avg) {
  const f = Math.round(avg);
  return '★★★★★'.slice(0, f) + '☆☆☆☆☆'.slice(0, 5 - f);
}

// JSON-LD dla pojedynczego produktu (Product + BreadcrumbList)
function buildProductJsonLd(p) {
  const rt = p.rating || { avg: 0, count: 0 };
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    image: p.image ? SITE_URL + p.image : SITE_URL + '/img/produkt/' + p.id + '.svg',
    category: p.category === 'bluza' ? 'Bluzy' : 'Koszulki',
    brand: { '@type': 'Brand', name: 'Vibe' },
    sku: String(p.id),
    color: p.colors.join(', '),
    offers: {
      '@type': 'Offer',
      price: p.price.toFixed(2),
      priceCurrency: 'PLN',
      availability: availableStock(p) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: SITE_URL + '/produkt/' + p.id
    }
  };
  // AggregateRating tylko gdy sa prawdziwe opinie (wymog Google)
  if (rt.count > 0) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rt.avg.toFixed(1),
      reviewCount: rt.count,
      bestRating: '5'
    };
  }
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
  const rt = p.rating || { avg: 0, count: 0 };
  const tpl = fs.readFileSync(path.join(PAGES_DIR, 'produkt.html'), 'utf8');
  const catLabel = p.category === 'bluza' ? 'Bluzy' : 'Koszulki';
  const sizeOpts = p.sizes.map((s, i) => `<button type="button" class="opt ${i === 0 ? 'selected' : ''}" data-size="${esc(s)}">${esc(s)}</button>`).join('');
  const colorOpts = p.colors.map((c, i) => `<button type="button" class="opt ${i === 0 ? 'selected' : ''}" data-color="${esc(c)}">${esc(c)}</button>`).join('');
  const ratingHtml = rt.count > 0
    ? `<span class="stars">${starsHtml(rt.avg)}</span> <span class="muted">${rt.avg.toFixed(1)} · ${rt.count} ${rt.count === 1 ? 'opinia' : 'opinii'}</span>`
    : '<span class="muted">Brak opinii — bądź pierwszy</span>';
  const repl = {
    SITE_URL,
    ANNOUNCE: esc(db.getSettings().announce_text || ''),
    JSONLD: buildProductJsonLd(p),
    P_ID: esc(p.id),
    P_NAME: esc(p.name),
    P_DESC: esc(p.description),
    P_CAT: esc(catLabel),
    P_PRICE: p.price.toFixed(2).replace('.', ',') + ' zł',
    P_IMG: buildGallery(p),
    P_OGIMG: p.image ? SITE_URL + p.image : SITE_URL + '/img/logo.jpg',
    P_SIZES: sizeOpts,
    P_COLORS: colorOpts,
    P_RATING: ratingHtml,
    P_ADDBTN: availableStock(p) > 0
      ? `<button class="btn btn-primary btn-block" id="ppAdd" data-id="${esc(p.id)}">Dodaj do koszyka</button>`
      : '<button class="btn btn-primary btn-block" id="ppAdd" data-id="' + esc(p.id) + '" disabled>Wyprzedane</button>',
    P_STOCK_NOTE: availableStock(p) > 0
      ? (availableStock(p) <= 5 ? `<p class="pp-stock low" id="ppStock">Zostały ostatnie sztuki: ${availableStock(p)}</p>` : '<p class="pp-stock" id="ppStock">✔ Dostępny, wysyłka 24h</p>')
      : '<p class="pp-stock soldout" id="ppStock">Produkt chwilowo niedostępny</p>'
  };
  let html = tpl.replace(/__([A-Z_]+)__/g, (m, key) => (key in repl ? repl[key] : m));
  html = html.replace('</body>', COOKIE_HTML + PRODUCT_I18N_SCRIPT + '</body>');
  productCache[p.id] = html;
  return html;
}
function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(html);
}

// ---- SEO wielojezyczne (PL/EN/DE): title/description/hreflang/canonical per jezyk ----
const I18N_HEAD = {
  en: {
    '/': { t: 'Vibe — premium hoodies & t-shirts | streetwear online', d: 'Vibe is a premium streetwear shop. Hooded sweatshirts and t-shirts in the finest cotton. Fast shipping, 14-day returns. Wear your vibe.' },
    '/kontakt': { t: 'Contact | Vibe', d: 'Contact the Vibe shop — write via the form, e-mail kontakt@vibeleszno.com or call. Help Mon–Fri 9:00–17:00.' },
    '/dostawa-zwroty': { t: 'Shipping & returns | Vibe', d: 'Delivery methods and costs at Vibe and return rules: 14-day returns, no reason needed.' },
    '/tabela-rozmiarow': { t: 'Size guide | Vibe', d: 'Vibe hoodie and t-shirt size guide (S–XXL): measurements in cm, chest and length. See how to measure correctly.' },
    '/regulamin': { t: 'Terms & Conditions | Vibe', d: 'Terms and Conditions of the Vibe online shop — ordering, payments, delivery, right of withdrawal (returns) and complaints.' },
    '/polityka-prywatnosci': { t: 'Privacy policy | Vibe', d: 'Vibe shop privacy policy — what data we collect, why, cookies and your rights (GDPR).' },
    '/eventy': { t: 'Events | Vibe — Vibe City Festival', d: 'Vibe brand events. Upcoming: Vibe City Festival — connecting generations. See details and buy tickets online.' }
  },
  de: {
    '/': { t: 'Vibe — Premium Hoodies & T-Shirts | Streetwear online', d: 'Vibe ist ein Premium-Streetwear-Shop. Hoodies und T-Shirts aus bester Baumwolle. Schneller Versand, 14 Tage Rückgabe. Trag deinen Vibe.' },
    '/kontakt': { t: 'Kontakt | Vibe', d: 'Kontaktiere den Vibe-Shop — über das Formular, per E-Mail kontakt@vibeleszno.com oder telefonisch. Hilfe Mo–Fr 9:00–17:00.' },
    '/dostawa-zwroty': { t: 'Versand & Rückgabe | Vibe', d: 'Versandarten und -kosten bei Vibe sowie Rückgaberegeln: 14 Tage Rückgabe ohne Angabe von Gründen.' },
    '/tabela-rozmiarow': { t: 'Größentabelle | Vibe', d: 'Größentabelle für Vibe Hoodies und T-Shirts (S–XXL): Maße in cm, Brust und Länge. So misst du richtig.' },
    '/regulamin': { t: 'AGB | Vibe', d: 'AGB des Vibe-Onlineshops — Bestellung, Zahlung, Versand, Widerrufsrecht (Rückgaben) und Reklamationen.' },
    '/polityka-prywatnosci': { t: 'Datenschutz | Vibe', d: 'Datenschutzerklärung des Vibe-Shops — welche Daten wir erfassen, warum, Cookies und deine Rechte (DSGVO).' },
    '/eventy': { t: 'Events | Vibe — Vibe City Festival', d: 'Events der Marke Vibe. Demnächst: Vibe City Festival — Generationen verbinden. Details ansehen und Tickets online kaufen.' }
  }
};
const OG_LOCALE = { pl: 'pl_PL', en: 'en_GB', de: 'de_DE' };

// Wstrzykuje hreflang/canonical/lang oraz (dla EN/DE) tlumaczony title+description.
function localizePage(html, lang, seoPath) {
  const loc = SITE_URL + seoPath;
  const alts =
    `\n  <link rel="alternate" hreflang="pl" href="${loc}" />` +
    `\n  <link rel="alternate" hreflang="en" href="${loc}?lang=en" />` +
    `\n  <link rel="alternate" hreflang="de" href="${loc}?lang=de" />` +
    `\n  <link rel="alternate" hreflang="x-default" href="${loc}" />` +
    `\n  <meta property="og:locale:alternate" content="en_GB" />` +
    `\n  <meta property="og:locale:alternate" content="de_DE" />\n`;
  // hreflang dodajemy zawsze (rowniez na PL)
  html = html.replace('</head>', alts + '</head>');
  if (lang !== 'pl') {
    html = html.replace('<html lang="pl"', `<html lang="${lang}"`);
    // canonical -> wersja jezykowa (self-referential)
    html = html.replace(/(<link rel="canonical" href=")([^"]*)(")/, (m, a, href, c) => a + href + (href.includes('?') ? '&' : '?') + 'lang=' + lang + c);
    // og:locale
    html = html.replace('content="pl_PL"', `content="${OG_LOCALE[lang]}"`);
    // tytul + opis (jesli mamy tlumaczenie dla tej sciezki)
    let h = I18N_HEAD[lang] && I18N_HEAD[lang][seoPath];
    // strony produktow: tlumaczymy nazwe + opis ze slownika produktow
    if (!h && seoPath.indexOf('/produkt/') === 0) {
      const pid = seoPath.slice('/produkt/'.length);
      const p = db.getProductById(pid);
      const map = PRODUCT_I18N[lang] || {};
      if (p) {
        const name = map[p.name] || p.name;
        const desc = map[p.description] || p.description;
        h = { t: name + ' — Vibe', d: desc };
      }
    }
    if (h) {
      html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(h.t)}</title>`);
      html = html.replace(/(<meta name="description" content=")[\s\S]*?(")/, `$1${esc(h.d)}$2`);
      html = html.replace(/(<meta property="og:title" content=")[\s\S]*?(")/, `$1${esc(h.t)}$2`);
      html = html.replace(/(<meta property="og:description" content=")[\s\S]*?(")/, `$1${esc(h.d)}$2`);
      html = html.replace(/(<meta name="twitter:title" content=")[\s\S]*?(")/, `$1${esc(h.t)}$2`);
    }
  }
  return html;
}

// Uniewaznienie cache stron (po zmianach admina: produkty, ustawienia)
function clearPageCache() {
  for (const k in renderCache) delete renderCache[k];
  for (const k in productCache) delete productCache[k];
}
// Przeladowanie produktow z bazy + czyszczenie cache
function refreshProducts() {
  PRODUCTS = applyRatings(db.getAllProducts());
  buildProductI18nScript();
  clearPageCache();
}

const ROBOTS_TXT = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
function buildSitemap() {
  const lastmod = new Date().toISOString().slice(0, 10);
  // [loc, changefreq, priority]
  const entries = [[SITE_URL + '/', 'daily', '1.0']]
    .concat(PRODUCTS.map((p) => [SITE_URL + '/produkt/' + p.id, 'weekly', '0.8']))
    .concat(Object.keys(PAGES).map((slug) => [SITE_URL + slug, 'monthly', '0.5']));
  const body = entries.map(([loc, cf, pr]) => {
    // hreflang: kazda strona ma warianty pl/en/de (+x-default) — Google odkrywa wersje jezykowe
    const alt =
      `<xhtml:link rel="alternate" hreflang="pl" href="${loc}"/>` +
      `<xhtml:link rel="alternate" hreflang="en" href="${loc}?lang=en"/>` +
      `<xhtml:link rel="alternate" hreflang="de" href="${loc}?lang=de"/>` +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/>`;
    return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${cf}</changefreq><priority>${pr}</priority>${alt}</url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>`;
}

// ---- pomocnicze ----
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store' // odpowiedzi API (dane konta/zamowien) nie trafiaja do cache
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
  // Musi byc DOKLADNIE w PUBLIC_DIR (nie tylko prefiks — blokuje np. ../public-secret).
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Nieznany zasob -> prawdziwa strona 404 (status 404, nie soft-404 z trescia strony glownej)
      try {
        const html = get404Html();
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(html);
      } catch {
        res.writeHead(404);
        res.end('404 Not Found');
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    // Wersjonowane zasoby (?v=) sa odciskiem palca -> mozna cache'owac na rok i oznaczyc immutable.
    // HTML nigdy nie cache'ujemy (no-cache). Reszta (niewersjonowane obrazy/fonty) -> 1 dzien.
    const versioned = /[?&]v=/.test(urlPath);
    const cacheControl = ext === '.html' ? 'no-cache'
      : versioned ? 'public, max-age=31536000, immutable'
      : 'public, max-age=86400';
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheControl
    };
    // Negocjacja WebP: dla jpg/png, gdy klient akceptuje image/webp i istnieje wariant .webp,
    // serwujemy lzejszy WebP pod tym samym URL (bez zmian w HTML, dziala dla SSR i klienta).
    if (NEGOTIABLE_IMG.has(ext)) {
      headers['Vary'] = 'Accept';
      if (String(req.headers['accept'] || '').includes('image/webp')) {
        const webpPath = filePath.slice(0, -ext.length) + '.webp';
        if (fs.existsSync(webpPath)) {
          headers['Content-Type'] = 'image/webp';
          res.writeHead(200, headers);
          fs.createReadStream(webpPath).pipe(res);
          return;
        }
      }
    }
    // Kompresja zasobow tekstowych (br/gzip). Binaria (obrazy/fonty) sa juz skompresowane.
    if (COMPRESSIBLE.has(ext)) {
      headers['Vary'] = 'Accept-Encoding';
      const enc = pickEncoding(req.headers['accept-encoding']);
      if (enc) {
        try {
          const buf = getCompressed(filePath, stat.mtimeMs, enc);
          headers['Content-Encoding'] = enc;
          res.writeHead(200, headers);
          res.end(buf);
          return;
        } catch { /* w razie bledu kompresji — serwuj nieskompresowane */ }
      }
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
}
// Typy tekstowe warte kompresji (binaria pomijamy — sa juz skompresowane).
const COMPRESSIBLE = new Set(['.js', '.css', '.svg', '.json', '.html', '.map', '.txt', '.xml', '.webmanifest', '.ico']);
function pickEncoding(accept) {
  const a = String(accept || '').toLowerCase();
  if (a.includes('br')) return 'br';
  if (a.includes('gzip')) return 'gzip';
  return null;
}
// Cache skompresowanych buforow: klucz = sciezka+mtime+enc. Po deployu mtime sie zmienia -> auto-odswiezenie.
const compCache = new Map();
function getCompressed(filePath, mtimeMs, enc) {
  const key = filePath + '|' + mtimeMs + '|' + enc;
  let buf = compCache.get(key);
  if (buf) return buf;
  const raw = fs.readFileSync(filePath);
  buf = enc === 'br'
    ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } })
    : zlib.gzipSync(raw, { level: 9 });
  // Ochrona pamieci: usuwamy wpisy tego pliku z innym mtime (po deployu plik ma nowy mtime).
  const prefix = filePath + '|', curMtime = '|' + mtimeMs + '|';
  for (const k of compCache.keys()) {
    if (k.startsWith(prefix) && !k.includes(curMtime)) compCache.delete(k);
  }
  compCache.set(key, buf);
  return buf;
}

// ---- WebP: lzejsze warianty zdjec produktow (cwebp, systemowy binarny) ----
const NEGOTIABLE_IMG = new Set(['.jpg', '.jpeg', '.png']);
const WEBP_MAX = 1280;   // maks. dluzszy bok (wystarcza na retina w galerii/kartach)
const WEBP_QUALITY = 80;
let CWEBP_OK = null;
function cwebpAvailable() {
  if (CWEBP_OK !== null) return CWEBP_OK;
  try { execFileSync('cwebp', ['-version'], { stdio: 'ignore' }); CWEBP_OK = true; }
  catch { CWEBP_OK = false; console.warn('cwebp niedostepny — pomijam generowanie WebP.'); }
  return CWEBP_OK;
}
// Wymiary JPEG/PNG z bufora (bez zaleznosci).
function imageDims(buf) {
  try {
    if (buf[0] === 0xFF && buf[1] === 0xD8) { // JPEG
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xFF) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
          return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    } else if (buf.toString('ascii', 1, 4) === 'PNG') {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
  } catch { /* nieznany format */ }
  return null;
}
// Generuje wariant .webp obok pliku zrodlowego (downscale dluzszego boku + q80). Zwraca true/false.
function ensureWebp(absPath) {
  if (!cwebpAvailable()) return false;
  const ext = path.extname(absPath).toLowerCase();
  if (!NEGOTIABLE_IMG.has(ext)) return false;
  const dest = absPath.slice(0, -ext.length) + '.webp';
  try {
    const d = imageDims(fs.readFileSync(absPath));
    const args = ['-quiet', '-q', String(WEBP_QUALITY)];
    if (d && d.w && d.h) {
      if (d.w >= d.h && d.w > WEBP_MAX) args.push('-resize', String(WEBP_MAX), '0');
      else if (d.h > d.w && d.h > WEBP_MAX) args.push('-resize', '0', String(WEBP_MAX));
    }
    args.push(absPath, '-o', dest);
    execFileSync('cwebp', args, { stdio: 'ignore' });
    return true;
  } catch (e) { try { fs.unlinkSync(dest); } catch {} return false; }
}
// Usuwa wariant .webp obok pliku (przy kasowaniu zdjecia).
function removeWebp(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (!NEGOTIABLE_IMG.has(ext)) return;
  try { fs.unlinkSync(absPath.slice(0, -ext.length) + '.webp'); } catch {}
}

// ---- walidacja adresu (PL): dane musza byc realne, nie losowe ----
const PL_LETTER = 'A-Za-zĄąĆćĘꟳłŃńÓ󌜟żŹź';
const RE_PL_LETTER = new RegExp(`[${PL_LETTER}]`, 'g');

// Kod pocztowy: poprawny format polski NN-NNN (00-000 to placeholder, odrzucamy).
function isPostalFormatPL(s) {
  const v = String(s || '').trim();
  return /^\d{2}-\d{3}$/.test(v) && v !== '00-000';
}
// Miasto: same litery (+ spacje, myslnik, apostrof, kropka), min. 2 litery, bez cyfr.
function isCityFormatPL(s) {
  const v = String(s || '').trim();
  if (v.length < 2 || v.length > 40 || /\d/.test(v)) return false;
  if (!new RegExp(`^[${PL_LETTER} .'\\-]+$`).test(v)) return false;
  return (v.match(RE_PL_LETTER) || []).length >= 2;
}
// Ulica: musi miec nazwe (>=2 litery) ORAZ numer domu (cyfra) — odrzuca "asdf", "1234".
function isStreetRealPL(s) {
  const v = String(s || '').trim();
  if (v.length < 3 || v.length > 80) return false;
  return (v.match(RE_PL_LETTER) || []).length >= 2 && /\d/.test(v);
}
// Telefon PL: po odrzuceniu prefiksu kraju dokladnie 9 cyfr, nie wszystkie identyczne.
function normalizePhonePL(s) {
  let p = String(s || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+48')) p = p.slice(3);
  else if (p.startsWith('0048')) p = p.slice(4);
  else if (p.length === 11 && p.startsWith('48')) p = p.slice(2);
  return p;
}
function isPhoneRealPL(s) {
  const p = normalizePhonePL(s);
  return /^\d{9}$/.test(p) && !/^(\d)\1{8}$/.test(p);
}

// Porownanie miasta z nazwami zwroconymi przez baze pocztowa (luzne, bez diakrytykow).
function normCity(s) {
  return String(s || '').toLowerCase().replace(/ł/g, 'l')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
}
function cityMatchesPlaces(input, places) {
  const a = normCity(input);
  return places.some((p) => {
    const b = normCity(p);
    return a && b && (a === b || (a.length >= 3 && (a.includes(b) || b.includes(a))));
  });
}

// Weryfikacja kodu pocztowego w realnej bazie (Zippopotam, darmowe, bez klucza).
// exists: true=istnieje, false=nie ma takiego kodu, null=nie udalo sie sprawdzic (fallback do formatu).
const postalCache = new Map();
function fetchPostalPL(code) {
  return new Promise((resolve) => {
    if (postalCache.has(code)) return resolve(postalCache.get(code));
    let done = false;
    const finish = (v, cacheIt) => { if (done) return; done = true; if (cacheIt) postalCache.set(code, v); resolve(v); };
    const req = https.get(`https://api.zippopotam.us/pl/${encodeURIComponent(code)}`, { timeout: 4000 }, (r) => {
      if (r.statusCode === 404) { r.resume(); return finish({ exists: false, places: [] }, true); }
      if (r.statusCode !== 200) { r.resume(); return finish({ exists: null, places: [] }, false); }
      let data = ''; r.setEncoding('utf8');
      r.on('data', (c) => { data += c; if (data.length > 1e5) req.destroy(); });
      r.on('end', () => {
        try {
          const j = JSON.parse(data);
          const places = (j.places || []).map((p) => p['place name']).filter(Boolean);
          finish({ exists: true, places }, true);
        } catch { finish({ exists: null, places: [] }, false); }
      });
    });
    req.on('timeout', () => { req.destroy(); finish({ exists: null, places: [] }, false); });
    req.on('error', () => finish({ exists: null, places: [] }, false));
  });
}

// ---- zamowienia (baza danych) ----
async function validateOrder(payload) {
  const errors = [];
  const c = payload && payload.customer ? payload.customer : {};
  const method = payload && payload.deliveryMethod === 'paczkomat' ? 'paczkomat' : 'kurier';
  if (!c.name || String(c.name).trim().length < 2) errors.push('Podaj imie i nazwisko.');
  if (!c.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(c.email))) errors.push('Podaj poprawny e-mail.');
  if (!isPhoneRealPL(c.phone)) errors.push('Podaj poprawny numer telefonu (9 cyfr, np. 600 700 800).');
  if (method === 'paczkomat') {
    if (!payload.parcelLocker || String(payload.parcelLocker).trim().length < 3) errors.push('Podaj kod paczkomatu.');
  } else {
    if (!isStreetRealPL(c.street)) errors.push('Podaj ulicę i numer domu (np. Kwiatowa 12).');
    if (!isCityFormatPL(c.city)) errors.push('Podaj poprawną nazwę miasta (same litery).');
    const postal = String(c.postalCode || '').trim();
    if (!isPostalFormatPL(postal)) {
      errors.push('Podaj kod pocztowy w formacie 00-000.');
    } else {
      const info = await fetchPostalPL(postal);
      if (info.exists === false) {
        errors.push(`Kod pocztowy ${postal} nie istnieje — sprawdź jego poprawność.`);
      } else if (info.exists === true && info.places.length && isCityFormatPL(c.city)) {
        if (!cityMatchesPlaces(c.city, info.places)) {
          errors.push(`Kod ${postal} nie pasuje do miasta „${String(c.city).trim()}”. Dla tego kodu poprawne to: ${info.places.slice(0, 3).join(', ')}.`);
        }
      } else if (info.exists === null) {
        console.warn(`[ADRES] kod ${postal} niezweryfikowany (baza pocztowa niedostepna) — przepuszczam po formacie.`);
      }
    }
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) errors.push('Koszyk jest pusty.');
  return errors;
}

async function handleCreateOrder(req, res, raw, user) {
  // Tylko zalogowani uzytkownicy moga zlozyc zamowienie.
  if (!user) return sendJson(res, 401, { error: 'Aby złożyć zamówienie, zaloguj się lub załóż konto.' });
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    return sendJson(res, 400, { error: 'Niepoprawny JSON.' });
  }
  const errors = await validateOrder(payload);
  if (errors.length) return sendJson(res, 400, { error: errors.join(' ') });

  // Ceny liczymy PO STRONIE SERWERA na podstawie bazy (nie ufamy klientowi)
  const lineItems = [];
  const needPerProduct = {}; // id -> { total, variants: { key: qty } }
  let total = 0;
  for (const item of payload.items) {
    const product = PRODUCTS.find((p) => p.id === item.id);
    if (!product) return sendJson(res, 400, { error: `Nieznany produkt: ${item.id}` });
    const qty = Math.max(1, Math.min(99, parseInt(item.qty, 10) || 1));
    const size = product.sizes.includes(item.size) ? item.size : product.sizes[0];
    const color = product.colors.includes(item.color) ? item.color : product.colors[0];
    const lineTotal = product.price * qty;
    total += lineTotal;
    if (!needPerProduct[product.id]) needPerProduct[product.id] = { total: 0, variants: {} };
    needPerProduct[product.id].total += qty;
    const vk = variantKey(size, color);
    needPerProduct[product.id].variants[vk] = (needPerProduct[product.id].variants[vk] || 0) + qty;
    lineItems.push({ id: product.id, name: product.name, price: product.price, qty, size, color, lineTotal });
  }

  // Kontrola stanu magazynowego (swieze dane z bazy, per wariant gdy zdefiniowane)
  for (const id in needPerProduct) {
    const fresh = db.getProductById(id);
    if (!fresh) return sendJson(res, 409, { error: `Nieznany produkt: ${id}` });
    const need = needPerProduct[id];
    if (fresh.variants && Object.keys(fresh.variants).length) {
      for (const vk in need.variants) {
        const have = parseInt(fresh.variants[vk], 10) || 0;
        if (have < need.variants[vk]) {
          return sendJson(res, 409, { error: `Brak wystarczajacej liczby sztuk: ${fresh.name} (wariant ${vk.replace('||', '/')}, dostepne: ${have}).` });
        }
      }
    } else if (fresh.stock < need.total) {
      return sendJson(res, 409, { error: `Brak wystarczajacej liczby sztuk: ${fresh.name} (dostepne: ${fresh.stock}).` });
    }
  }

  // Dostawa i rabat liczone PO STRONIE SERWERA (na podstawie ustawien i bazy kodow)
  const settings = db.getSettings();
  const threshold = parseFloat(settings.free_shipping_threshold) || 0;
  const shipCost = parseFloat(settings.shipping_cost) || 0;
  const shipping = (threshold > 0 && total >= threshold) ? 0 : shipCost;

  let discount = 0;
  let discountCode = '';
  if (payload.discountCode) {
    const d = db.getDiscount(payload.discountCode);
    if (d && d.active) {
      discount = d.type === 'percent' ? total * (d.value / 100) : d.value;
      discount = Math.min(discount, total); // nie wiecej niz wartosc produktow
      discountCode = d.code;
    }
  }
  const grandTotal = Math.max(0, total + shipping - discount);

  const deliveryMethod = payload.deliveryMethod === 'paczkomat' ? 'paczkomat' : 'kurier';
  const parcelLocker = deliveryMethod === 'paczkomat' ? String(payload.parcelLocker || '').trim().toUpperCase() : '';
  const parcelLockerAddr = deliveryMethod === 'paczkomat' ? String(payload.parcelLockerAddress || '').trim().slice(0, 200) : '';

  const order = {
    id: db.nextOrderId(),
    user_id: user ? user.id : null,
    createdAt: new Date().toISOString(),
    deliveryMethod,
    parcelLocker,
    parcelLockerAddr,
    customer: (() => {
      const c = payload.customer;
      const street = String(c.street || '').trim();
      const postalCode = String(c.postalCode || '').trim();
      const city = String(c.city || '').trim();
      const address = deliveryMethod === 'paczkomat'
        ? ('Paczkomat ' + parcelLocker + (parcelLockerAddr ? ' (' + parcelLockerAddr + ')' : ''))
        : `${street}, ${postalCode} ${city}`;
      return {
        name: String(c.name).trim(),
        email: String(c.email).trim(),
        phone: c.phone ? String(c.phone).trim() : '',
        street, postalCode, city,
        address
      };
    })(),
    items: lineItems,
    shipping: Math.round(shipping * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    discountCode,
    total: Math.round(grandTotal * 100) / 100,
    status: 'nowe'
  };
  try {
    db.createOrder(order);
    for (const id in needPerProduct) {
      const fresh = db.getProductById(id);
      const need = needPerProduct[id];
      if (fresh.variants && Object.keys(fresh.variants).length) {
        const v = { ...fresh.variants };
        for (const vk in need.variants) v[vk] = Math.max(0, (parseInt(v[vk], 10) || 0) - need.variants[vk]);
        db.setVariants(id, v);
      } else {
        db.decrementStock(id, need.total);
      }
    }
    refreshProducts(); // zaktualizuj katalog/cache po zdjeciu stanu
  } catch (err) {
    console.error('Blad zapisu zamowienia:', err.message);
    return sendJson(res, 500, { error: 'Nie udalo sie zapisac zamowienia.' });
  }
  console.log(`[ZAMOWIENIE] ${order.id} - ${order.customer.email} - ${order.total} zl${user ? ' (user ' + user.id + ')' : ''}`);
  sendOrderEmails(order); // powiadomienia e-mail (klient + sklep), best-effort
  return sendJson(res, 201, {
    ok: true, orderId: order.id, total: order.total,
    payment: {
      recipient: PAYMENT.recipient,
      account: PAYMENT.account,
      bank: PAYMENT.bank,
      title: order.id,
      amount: order.total
    }
  });
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
  startSession(req, res, user.id);
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
  startSession(req, res, row.id);
  return sendJson(res, 200, { ok: true, user: db.getUserById(row.id) });
}

// ---- wiadomosci z formularza kontaktowego ----
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// ---- Wysylka e-mail (mini-klient SMTP, bez zaleznosci) ----
// Konfiguracja przez zmienne srodowiskowe. Gdy brak SMTP_HOST/USER/PASS,
// wysylka jest pomijana, a wiadomosci i tak zapisuja sie do messages.json.
const SMTP = {
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT, 10) || 465,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  to: process.env.CONTACT_TO || process.env.SMTP_USER || ''
};

// Adresy powiadamiane o NOWYCH ZAMOWIENIACH (oprocz klienta, ktory dostaje osobne potwierdzenie).
// Staly zestaw: kontakt@vibeleszno.com + vip@vipnieruchomosci.eu (mozna dopisac wiecej przez ORDER_NOTIFY_TO, po przecinku).
const ORDER_NOTIFY = [...new Set(
  ['kontakt@vibeleszno.com', 'vip@vipnieruchomosci.eu', process.env.ORDER_NOTIFY_TO || '']
    .join(',').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
)].join(', ');

function b64(s) { return Buffer.from(s, 'utf8').toString('base64'); }

// Naglowek z polskimi znakami -> MIME encoded-word (UTF-8 base64)
function encHeader(s) { return `=?UTF-8?B?${b64(s)}?=`; }

// Tresc base64, lamana co 76 znakow (unikamy problemow z dlugimi liniami / kropkami)
function b64Body(s) { return b64(s).replace(/(.{76})/g, '$1\r\n'); }

// Rozbicie listy odbiorcow "a@x, b@y" -> ['a@x','b@y']
function parseRecipients(to) {
  return String(to || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function buildMail({ fromName, from, to, replyTo, subject, text }) {
  const date = new Date().toUTCString().replace(/GMT$/, '+0000');
  const toHeader = parseRecipients(to).map((a) => `<${a}>`).join(', ');
  const lines = [
    `From: ${encHeader(fromName)} <${from}>`,
    `To: ${toHeader}`,
    replyTo ? `Reply-To: <${replyTo}>` : null,
    `Subject: ${encHeader(subject)}`,
    `Date: ${date}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64Body(text)
  ].filter((l) => l !== null);
  return lines.join('\r\n');
}

// Sekwencyjny dialog SMTP po TLS (port 465). Zwraca Promise.
function smtpSend({ from, to, replyTo, subject, text, fromName }) {
  return new Promise((resolve, reject) => {
    if (!SMTP.host || !SMTP.user || !SMTP.pass) {
      return reject(new Error('SMTP nie jest skonfigurowany (SMTP_HOST/SMTP_USER/SMTP_PASS).'));
    }
    const socket = tls.connect({ host: SMTP.host, port: SMTP.port, servername: SMTP.host });
    socket.setEncoding('utf8');
    socket.setTimeout(15000, () => { socket.destroy(new Error('SMTP timeout')); });

    let buffer = '';
    let resolver = null;
    socket.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\r\n');
      for (let i = 0; i < lines.length; i++) {
        // ostatnia linia odpowiedzi ma format "NNN " (spacja po kodzie)
        if (/^\d{3} /.test(lines[i])) {
          const code = parseInt(lines[i].slice(0, 3), 10);
          buffer = lines.slice(i + 1).join('\r\n');
          const r = resolver; resolver = null;
          if (r) r(code);
          break;
        }
      }
    });
    socket.on('error', reject);
    const expect = () => new Promise((r) => { resolver = r; });
    const send = (s) => socket.write(s + '\r\n');

    (async () => {
      try {
        if (await expect() !== 220) throw new Error('Brak powitania SMTP.');
        send(`EHLO ${SMTP.host}`);
        if (await expect() !== 250) throw new Error('EHLO odrzucone.');
        send('AUTH LOGIN');
        if (await expect() !== 334) throw new Error('AUTH LOGIN odrzucone.');
        send(b64(SMTP.user));
        if (await expect() !== 334) throw new Error('Nazwa uzytkownika odrzucona.');
        send(b64(SMTP.pass));
        if (await expect() !== 235) throw new Error('Logowanie SMTP nieudane (zle haslo?).');
        send(`MAIL FROM:<${from}>`);
        if (await expect() !== 250) throw new Error('MAIL FROM odrzucone.');
        const rcpts = parseRecipients(to);
        if (!rcpts.length) throw new Error('Brak odbiorcy (CONTACT_TO).');
        for (const rcpt of rcpts) {
          send(`RCPT TO:<${rcpt}>`);
          const c = await expect();
          if (c !== 250 && c !== 251) throw new Error(`RCPT TO odrzucone (${rcpt}).`);
        }
        send('DATA');
        if (await expect() !== 354) throw new Error('DATA odrzucone.');
        socket.write(buildMail({ fromName, from, to, replyTo, subject, text }) + '\r\n.\r\n');
        if (await expect() !== 250) throw new Error('Serwer nie przyjal wiadomosci.');
        send('QUIT');
        socket.end();
        resolve();
      } catch (err) {
        try { socket.end(); } catch {}
        reject(err);
      }
    })();
  });
}
// Tresc maila z podsumowaniem zamowienia (klient + sklep)
function buildOrderEmailText(order) {
  const money = (n) => Number(n).toFixed(2).replace('.', ',') + ' zł';
  const sub = order.items.reduce((s, it) => s + it.lineTotal, 0);
  const lines = [];
  lines.push(`Numer zamówienia: ${order.id}`);
  lines.push('');
  lines.push('Produkty:');
  for (const it of order.items) {
    lines.push(`  • ${it.name} (${it.size}, ${it.color}) × ${it.qty} — ${money(it.lineTotal)}`);
  }
  lines.push('');
  lines.push(`Wartość produktów: ${money(sub)}`);
  if (order.discount > 0) lines.push(`Rabat${order.discountCode ? ' (' + order.discountCode + ')' : ''}: -${money(order.discount)}`);
  const methodLabel = order.deliveryMethod === 'paczkomat' ? 'Paczkomat' : 'Kurier';
  lines.push(`Dostawa (${methodLabel}): ${order.shipping === 0 ? 'gratis' : money(order.shipping)}`);
  lines.push(`RAZEM DO ZAPŁATY: ${money(order.total)}`);
  lines.push('');
  lines.push('Dane do wysyłki:');
  lines.push(`  ${order.customer.name}`);
  lines.push(`  Sposób dostawy: ${methodLabel}`);
  if (order.deliveryMethod === 'paczkomat') {
    lines.push(`  Kod paczkomatu: ${order.parcelLocker}`);
    if (order.parcelLockerAddr) lines.push(`  Adres paczkomatu: ${order.parcelLockerAddr}`);
  } else lines.push(`  ${order.customer.address}`);
  if (order.customer.phone) lines.push(`  tel. ${order.customer.phone}`);
  lines.push(`  ${order.customer.email}`);
  lines.push('');
  lines.push('--- PŁATNOŚĆ (przelew tradycyjny) ---');
  lines.push(`Odbiorca: ${PAYMENT.recipient}`);
  lines.push(`Nr konta${PAYMENT.bank ? ' (' + PAYMENT.bank + ')' : ''}: ${PAYMENT.account}`);
  lines.push(`Tytuł przelewu: ${order.id}`);
  lines.push(`Kwota: ${money(order.total)}`);
  lines.push('Zamówienie realizujemy po zaksięgowaniu wpłaty.');
  return lines.join('\n') + '\n';
}

// Wyslanie powiadomien o zamowieniu (best-effort, nie blokuje odpowiedzi)
function sendOrderEmails(order) {
  if (!(SMTP.host && SMTP.user && SMTP.pass)) return;
  const summary = buildOrderEmailText(order);
  const shopAddr = (SMTP.to || SMTP.user).split(',')[0].trim();
  // 1) potwierdzenie do klienta
  smtpSend({
    fromName: 'Vibe',
    from: SMTP.user,
    to: order.customer.email,
    replyTo: shopAddr,
    subject: `Potwierdzenie zamówienia ${order.id} — Vibe`,
    text: `Dziękujemy za zamówienie w Vibe! 🎉\n\nPrzyjęliśmy je do realizacji — poniżej podsumowanie.\n\n${summary}\nW razie pytań po prostu odpowiedz na tę wiadomość.\n`
  }).catch((err) => console.error('[ZAMOWIENIE] mail do klienta nie wyslany:', err.message));
  // 2) powiadomienie na skrzynke sklepu
  smtpSend({
    fromName: 'Vibe — sklep',
    from: SMTP.user,
    to: ORDER_NOTIFY,
    replyTo: order.customer.email,
    subject: `Nowe zamówienie ${order.id} — ${Number(order.total).toFixed(2)} zł`,
    text: `Nowe zamówienie w sklepie:\n\n${summary}`
  }).catch((err) => console.error('[ZAMOWIENIE] mail do sklepu nie wyslany:', err.message));
}

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

  // Powiadomienie e-mail (best-effort) — nie blokuje odpowiedzi dla klienta.
  if (SMTP.host && SMTP.user && SMTP.pass) {
    const subject = `Nowa wiadomość z formularza — ${name}`;
    const body = `Imię: ${name}\nE-mail: ${email}\n\nWiadomość:\n${message}\n`;
    smtpSend({
      fromName: 'Vibe — formularz',
      from: SMTP.user,        // From musi byc kontem uwierzytelnionym w nazwa.pl
      to: SMTP.to,            // dokad trafia powiadomienie
      replyTo: email,         // "Odpowiedz" idzie wprost do klienta
      subject,
      text: body
    }).catch((err) => console.error('[KONTAKT] e-mail nie wyslany:', err.message));
  }

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
  const gender = ['meska', 'damska', 'unisex'].includes(p.gender) ? p.gender : 'unisex';
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
  const name_en = String(p.name_en || '').trim();
  const name_de = String(p.name_de || '').trim();
  const desc_en = String(p.desc_en || '').trim();
  const desc_de = String(p.desc_de || '').trim();
  return { errors, product: { name, category, price, colors, sizes, color, accent, description, featured, stock, gender, name_en, name_de, desc_en, desc_de } };
}

// ---- router ----
const server = http.createServer(async (req, res) => {
  setSecurityHeaders(req, res);
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const url = req.url || '/';
  const method = req.method || 'GET';
  const pathOnly = url.split('?')[0];
  // Jezyk strony do SEO (?lang=en|de) — wplywa na <html lang>, title/description, canonical, hreflang
  const langMatch = /[?&]lang=(en|de)\b/.exec(url);
  const lang = langMatch ? langMatch[1] : 'pl';

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
    return sendHtml(res, localizePage(getIndexHtml(), lang, '/'));
  }

  // Osobne podstrony (Pomoc): /dostawa-zwroty, /tabela-rozmiarow, /kontakt
  if (method === 'GET' && PAGES[pathOnly]) {
    try {
      return sendHtml(res, localizePage(renderTemplate(path.join(PAGES_DIR, PAGES[pathOnly])), lang, pathOnly));
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
    if (!p) {
      try { const h = get404Html(); res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); return res.end(h); }
      catch { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<h1>404 — nie znaleziono produktu</h1><a href="/">Wróć do sklepu</a>'); }
    }
    try {
      return sendHtml(res, localizePage(getProductHtml(p), lang, '/produkt/' + p.id));
    } catch (err) {
      console.error('Blad renderowania produktu:', err.message);
      res.writeHead(500); return res.end('500');
    }
  }

  // API
  if (url.startsWith('/api/')) {
    // CSRF: zadania zmieniajace stan musza pochodzic z tego samego origin.
    if (method !== 'GET' && method !== 'HEAD' && !sameOrigin(req)) {
      return sendJson(res, 403, { error: 'Nieprawidlowe zrodlo zadania (CSRF).' });
    }
    if (method === 'GET' && url === '/api/health') {
      return sendJson(res, 200, { status: 'ok', products: PRODUCTS.length, time: new Date().toISOString() });
    }
    if (method === 'GET' && url === '/api/products') {
      return sendJson(res, 200, PRODUCTS);
    }
    if (method === 'GET' && /^\/api\/products\/[^/]+\/reviews$/.test(pathOnly)) {
      const id = pathOnly.split('/')[3];
      const rt = db.getRatingsMap()[id] || { avg: 0, count: 0 };
      const u = currentUser(req);
      let canReview = false; let myReview = null;
      if (u) {
        myReview = db.getUserReview(id, u.id);
        canReview = db.getOrdersByUser(u.id).some((o) => o.status !== 'anulowane' && o.items.some((it) => it.id === id));
      }
      return sendJson(res, 200, { reviews: db.getReviews(id), avg: rt.avg, count: rt.count, canReview, myReview, loggedIn: !!u });
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
        return await handleCreateOrder(req, res, raw, currentUser(req));
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }
    if (method === 'POST' && url === '/api/contact') {
      if (rateLimited('contact:' + ip, 6, 10 * 60 * 1000)) return sendJson(res, 429, { error: 'Za duzo wiadomosci. Sprobuj ponownie za chwile.' });
      try {
        const raw = await readBody(req);
        return handleContact(res, raw);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }
    if (method === 'POST' && url === '/api/reviews') {
      try {
        const u = currentUser(req);
        if (!u) return sendJson(res, 401, { error: 'Zaloguj się, aby dodać opinię.' });
        const p = JSON.parse(await readBody(req) || '{}');
        const id = String(p.productId || '');
        const rating = parseInt(p.rating, 10);
        if (!db.getProductById(id)) return sendJson(res, 404, { error: 'Nie ma takiego produktu.' });
        if (!(rating >= 1 && rating <= 5)) return sendJson(res, 400, { error: 'Ocena musi być od 1 do 5.' });
        const purchased = db.getOrdersByUser(u.id).some((o) => o.status !== 'anulowane' && o.items.some((it) => it.id === id));
        if (!purchased) return sendJson(res, 403, { error: 'Opinię możesz dodać dopiero po zakupie tego produktu.' });
        db.upsertReview({ productId: id, userId: u.id, rating, comment: String(p.comment || '').slice(0, 1000) });
        refreshProducts();
        return sendJson(res, 201, { ok: true });
      } catch (err) { return sendJson(res, 400, { error: err.message }); }
    }
    if (method === 'GET' && url === '/api/settings') {
      const s = db.getSettings();
      return sendJson(res, 200, {
        freeShippingThreshold: parseFloat(s.free_shipping_threshold) || 0,
        shippingCost: parseFloat(s.shipping_cost) || 0,
        geowidgetToken: process.env.GEOWIDGET_TOKEN || ''
      });
    }
    if (method === 'POST' && url === '/api/discount/validate') {
      try {
        const p = JSON.parse(await readBody(req) || '{}');
        const d = db.getDiscount(p.code);
        if (!d || !d.active) return sendJson(res, 404, { error: 'Niepoprawny lub nieaktywny kod.' });
        const sub = Math.max(0, parseFloat(p.subtotal) || 0);
        let amount = d.type === 'percent' ? sub * (d.value / 100) : d.value;
        amount = Math.min(amount, sub);
        return sendJson(res, 200, { code: d.code, type: d.type, value: d.value, amount: Math.round(amount * 100) / 100 });
      } catch (err) { return sendJson(res, 400, { error: err.message }); }
    }

    // --- Uwierzytelnianie ---
    if (method === 'POST' && url === '/api/auth/register') {
      if (rateLimited('reg:' + ip, 10, 60 * 60 * 1000)) return sendJson(res, 429, { error: 'Za duzo prob rejestracji. Sprobuj pozniej.' });
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
    if (method === 'POST' && url === '/api/auth/change-password') {
      try {
        const u = currentUser(req);
        if (!u) return sendJson(res, 401, { error: 'Wymagane logowanie.' });
        const p = JSON.parse(await readBody(req) || '{}');
        const cur = String(p.currentPassword || '');
        const nw = String(p.newPassword || '');
        if (nw.length < 8) return sendJson(res, 400, { error: 'Nowe haslo musi miec min. 8 znakow.' });
        if (!auth.verifyPassword(cur, db.getPasswordHash(u.id))) return sendJson(res, 400, { error: 'Aktualne haslo jest niepoprawne.' });
        db.setPasswordById(u.id, auth.hashPassword(nw));
        return sendJson(res, 200, { ok: true });
      } catch (err) { return sendJson(res, 400, { error: err.message }); }
    }
    if (method === 'POST' && url === '/api/auth/profile') {
      try {
        const u = currentUser(req);
        if (!u) return sendJson(res, 401, { error: 'Wymagane logowanie.' });
        const p = JSON.parse(await readBody(req) || '{}');
        const name = String(p.name || '').trim();
        const email = String(p.email || '').trim().toLowerCase();
        if (name.length < 2) return sendJson(res, 400, { error: 'Podaj imie i nazwisko.' });
        if (email && !EMAIL_RE.test(email)) return sendJson(res, 400, { error: 'Podaj poprawny e-mail.' });
        if (email && db.emailTakenByOther(email, u.id)) return sendJson(res, 409, { error: 'Ten e-mail jest juz zajety.' });
        db.updateProfile(u.id, name, email || null);
        return sendJson(res, 200, { ok: true, user: db.getUserById(u.id) });
      } catch (err) { return sendJson(res, 400, { error: err.message }); }
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
      if (method === 'POST' && url === '/api/admin/users/password') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const id = parseInt(p.id, 10);
          const pw = String(p.password || '');
          if (!id || pw.length < 8) return sendJson(res, 400, { error: 'Haslo min. 8 znakow.' });
          const target = db.getUserById(id);
          if (!target) return sendJson(res, 404, { error: 'Nie ma takiego uzytkownika.' });
          db.setPasswordById(id, auth.hashPassword(pw));
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
      if (method === 'POST' && url === '/api/admin/order-delete') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const ok = db.deleteOrder(String(p.id || ''));
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
      // Ustawienia sklepu
      if (method === 'GET' && url === '/api/admin/settings') {
        return sendJson(res, 200, { settings: db.getSettings() });
      }
      if (method === 'POST' && url === '/api/admin/settings') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const allowed = ['free_shipping_threshold', 'shipping_cost', 'announce_text', 'contact_email', 'contact_phone'];
          for (const k of allowed) if (k in p) db.setSetting(k, p[k]);
          clearPageCache();
          return sendJson(res, 200, { ok: true, settings: db.getSettings() });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      // Kody rabatowe
      if (method === 'GET' && url === '/api/admin/discounts') {
        return sendJson(res, 200, { discounts: db.getDiscounts() });
      }
      if (method === 'POST' && url === '/api/admin/discounts') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const code = String(p.code || '').trim();
          const type = p.type === 'amount' ? 'amount' : 'percent';
          const value = parseFloat(p.value);
          if (code.length < 2 || !(value > 0)) return sendJson(res, 400, { error: 'Podaj kod i wartosc > 0.' });
          if (type === 'percent' && value > 100) return sendJson(res, 400, { error: 'Procent maksymalnie 100.' });
          if (db.getDiscount(code)) return sendJson(res, 409, { error: 'Taki kod juz istnieje.' });
          db.createDiscount({ code, type, value, active: true });
          return sendJson(res, 201, { ok: true });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      if (method === 'POST' && url === '/api/admin/discounts/toggle') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const d = db.getDiscount(p.code);
          if (!d) return sendJson(res, 404, { error: 'Nie ma takiego kodu.' });
          db.setDiscountActive(p.code, !d.active);
          return sendJson(res, 200, { ok: true, active: !d.active });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      if (method === 'POST' && url === '/api/admin/discounts/delete') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const ok = db.deleteDiscount(p.code);
          return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Nie ma takiego kodu.' });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      // Notatka do zamowienia
      if (method === 'POST' && url === '/api/admin/order-note') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const ok = db.setOrderNote(String(p.id || ''), String(p.note || ''));
          return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Nie ma zamowienia.' });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      // Zdjecia produktu: dodanie / usuniecie jednego / usuniecie wszystkich
      if (method === 'POST' && url === '/api/admin/products/image') {
        try {
          const p = JSON.parse(await readBody(req, 7e6) || '{}');
          const prod = db.getProductById(String(p.id || ''));
          if (!prod) return sendJson(res, 404, { error: 'Nie ma takiego produktu.' });
          let images = Array.isArray(prod.images) ? prod.images.slice() : (prod.image ? [prod.image] : []);
          const unlinkByPath = (pub) => { const ap = path.join(UPLOADS_DIR, path.basename(String(pub))); try { fs.unlinkSync(ap); } catch {} removeWebp(ap); };

          // usuniecie wszystkich zdjec
          if (p.remove) {
            images.forEach(unlinkByPath);
            for (const e of ['png', 'jpg', 'webp']) { try { fs.unlinkSync(path.join(UPLOADS_DIR, prod.id + '.' + e)); } catch {} }
            db.setProductImages(prod.id, []);
            refreshProducts();
            return sendJson(res, 200, { ok: true, images: [] });
          }
          // usuniecie jednego zdjecia (po sciezce)
          if (p.removeImage) {
            const target = String(p.removeImage);
            if (images.includes(target)) { unlinkByPath(target); images = images.filter((x) => x !== target); }
            db.setProductImages(prod.id, images);
            refreshProducts();
            return sendJson(res, 200, { ok: true, images });
          }
          // dodanie nowego zdjecia
          const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(p.image || '');
          if (!m) return sendJson(res, 400, { error: 'Nieobslugiwany format (png/jpg/webp).' });
          if (images.length >= 6) return sendJson(res, 400, { error: 'Maksymalnie 6 zdjec na produkt.' });
          const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
          const buf = Buffer.from(m[2], 'base64');
          if (buf.length > 4 * 1024 * 1024) return sendJson(res, 400, { error: 'Zdjecie za duze (max 4 MB).' });
          const fname = `${prod.id}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}.${ext}`;
          const savedPath = path.join(UPLOADS_DIR, fname);
          fs.writeFileSync(savedPath, buf);
          ensureWebp(savedPath); // lzejszy wariant WebP serwowany przez negocjacje Accept
          images.push('/uploads/' + fname);
          db.setProductImages(prod.id, images);
          refreshProducts();
          return sendJson(res, 201, { ok: true, images });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      // Moderacja opinii
      if (method === 'GET' && url === '/api/admin/reviews') {
        return sendJson(res, 200, { reviews: db.getAllReviews() });
      }
      if (method === 'POST' && url === '/api/admin/reviews/delete') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const ok = db.deleteReview(String(p.productId || ''), parseInt(p.userId, 10));
          if (ok) refreshProducts();
          return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Nie ma takiej opinii.' });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      // Stany wariantow (per rozmiar/kolor)
      if (method === 'POST' && url === '/api/admin/products/variants') {
        try {
          const p = JSON.parse(await readBody(req) || '{}');
          const prod = db.getProductById(String(p.id || ''));
          if (!prod) return sendJson(res, 404, { error: 'Nie ma takiego produktu.' });
          let variants = null;
          if (p.variants && typeof p.variants === 'object') {
            variants = {};
            for (const k in p.variants) { const n = parseInt(p.variants[k], 10); if (Number.isFinite(n) && n >= 0) variants[k] = n; }
            if (!Object.keys(variants).length) variants = null;
          }
          db.setVariants(prod.id, variants);
          refreshProducts();
          return sendJson(res, 200, { ok: true });
        } catch (err) { return sendJson(res, 400, { error: err.message }); }
      }
      // Backup bazy (pobranie pliku vibe.db)
      if (method === 'GET' && url === '/api/admin/backup') {
        try {
          db.checkpoint();
          const buf = fs.readFileSync(path.join(DATA_DIR, 'vibe.db'));
          res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="vibe-backup.db"' });
          return res.end(buf);
        } catch (err) { return sendJson(res, 500, { error: 'Backup nieudany: ' + err.message }); }
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
