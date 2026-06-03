'use strict';

/*
 * Bezpieczenstwo hasel i sesji (tylko wbudowany modul crypto).
 *  - scrypt z losowa sola (16 bajtow) -> haslo NIGDY nie jest przechowywane jawnie.
 *  - porownanie hashy w czasie stalym (timingSafeEqual) -> brak ataku czasowego.
 *  - token sesji: 32 losowe bajty (kryptograficznie bezpieczne).
 */

const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const hashed = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== hashed.length) return false;
  return crypto.timingSafeEqual(expected, hashed);
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

module.exports = { hashPassword, verifyPassword, newToken, parseCookies };
