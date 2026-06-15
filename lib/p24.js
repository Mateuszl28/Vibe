'use strict';

/*
 * Przelewy24 — integracja z REST API v1 (czysty Node.js, zero zaleznosci).
 *
 * Konfiguracja przez zmienne srodowiskowe (NIE commitujemy kluczy do repo):
 *   P24_MERCHANT_ID  - ID sprzedawcy (liczba), np. 402226
 *   P24_POS_ID       - ID sklepu/POS (liczba); domyslnie = P24_MERCHANT_ID
 *   P24_CRC          - klucz CRC z panelu
 *   P24_API_KEY      - klucz do API/raportow (haslo do Basic Auth)
 *   P24_SANDBOX      - 'true' (domyslnie) = sandbox.przelewy24.pl, 'false' = produkcja
 *
 * Format podpisow (SHA-384 z JSON, dokladna kolejnosc pol) potwierdzony wg
 * oficjalnego API P24 i biblioteki referencyjnej node-przelewy24:
 *   register: { sessionId, merchantId, amount, currency, crc }
 *   verify:   { sessionId, orderId, amount, currency, crc }
 *   notyfikacja: { merchantId, posId, sessionId, amount, originAmount, currency, orderId, methodId, statement, crc }
 */

const https = require('https');
const crypto = require('crypto');

const MERCHANT_ID = parseInt(process.env.P24_MERCHANT_ID || '0', 10);
const POS_ID = parseInt(process.env.P24_POS_ID || String(MERCHANT_ID), 10);
const CRC = process.env.P24_CRC || '';
const API_KEY = process.env.P24_API_KEY || '';
const SANDBOX = (process.env.P24_SANDBOX || 'true').toLowerCase() !== 'false';

const HOST = SANDBOX ? 'sandbox.przelewy24.pl' : 'secure.przelewy24.pl';

// Czy integracja jest skonfigurowana (bez kompletu kluczy modul lezy bezczynnie).
function isConfigured() {
  return !!(MERCHANT_ID && POS_ID && CRC && API_KEY);
}

function sha384(obj) {
  return crypto.createHash('sha384').update(JSON.stringify(obj)).digest('hex');
}

function authHeader() {
  return 'Basic ' + Buffer.from(`${POS_ID}:${API_KEY}`).toString('base64');
}

// Niskopoziomowe zadanie HTTPS do API P24 (JSON in/out). Zwraca { status, json }.
function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request({
      host: HOST,
      port: 443,
      method,
      path: '/api/v1' + path,
      timeout: 15000,
      headers: {
        'Authorization': authHeader(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(payload ? { 'Content-Length': payload.length } : {})
      }
    }, (r) => {
      let data = '';
      r.setEncoding('utf8');
      r.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
      r.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch { /* nie-JSON */ }
        resolve({ status: r.statusCode, json });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('Przekroczono limit czasu polaczenia z P24')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Rejestracja transakcji. Zwraca { token, link } (link = adres bramki do przekierowania klienta).
 * amount = kwota w groszach (np. 199.99 PLN -> 19999). Rzuca wyjatkiem przy bledzie.
 */
async function registerTransaction({ sessionId, amount, currency = 'PLN', description, email, urlReturn, urlStatus }) {
  const sign = sha384({ sessionId, merchantId: MERCHANT_ID, amount, currency, crc: CRC });
  const body = {
    merchantId: MERCHANT_ID,
    posId: POS_ID,
    sessionId,
    amount,
    currency,
    description: String(description || sessionId).slice(0, 1024),
    email: String(email || '').slice(0, 50),
    country: 'PL',
    language: 'pl',
    urlReturn,
    urlStatus,
    sign
  };
  const { status, json } = await apiRequest('POST', '/transaction/register', body);
  const token = json && json.data && json.data.token;
  if (status !== 200 || !token) {
    const msg = (json && (json.error || JSON.stringify(json.error || json))) || `HTTP ${status}`;
    throw new Error(`P24 register: ${msg}`);
  }
  return { token, link: `https://${HOST}/trnRequest/${token}` };
}

/**
 * Weryfikacja (potwierdzenie) transakcji po otrzymaniu notyfikacji. Zwraca true gdy P24 potwierdzi.
 * orderId = numer transakcji nadany przez P24 (z notyfikacji), amount = grosze.
 */
async function verifyTransaction({ sessionId, orderId, amount, currency = 'PLN' }) {
  const sign = sha384({ sessionId, orderId, amount, currency, crc: CRC });
  const body = { merchantId: MERCHANT_ID, posId: POS_ID, sessionId, amount, currency, orderId, sign };
  const { status, json } = await apiRequest('PUT', '/transaction/verify', body);
  return status === 200 && !!(json && json.data && json.data.status === 'success');
}

/**
 * Sprawdza autentycznosc notyfikacji (webhook) — przelicza podpis z naszym kluczem CRC.
 * Kolejnosc pol musi byc dokladnie taka jak u P24.
 */
function verifyNotificationSign(n) {
  const expected = sha384({
    merchantId: n.merchantId,
    posId: n.posId,
    sessionId: n.sessionId,
    amount: n.amount,
    originAmount: n.originAmount,
    currency: n.currency,
    orderId: n.orderId,
    methodId: n.methodId,
    statement: n.statement,
    crc: CRC
  });
  // Porownanie odporne na timing.
  const a = Buffer.from(expected);
  const b = Buffer.from(String(n.sign || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  isConfigured,
  registerTransaction,
  verifyTransaction,
  verifyNotificationSign,
  config: { sandbox: SANDBOX, merchantId: MERCHANT_ID, posId: POS_ID, host: HOST }
};
