'use strict';

/* ====== Stan ====== */
let PRODUCTS = [];
let currentFilter = 'all';
let cart = loadCart();

/* ====== Pomocnicze ====== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const money = (n) => n.toFixed(2).replace('.', ',') + ' zł';

function loadCart() {
  try { return JSON.parse(localStorage.getItem('vibe_cart')) || []; }
  catch { return []; }
}
function saveCart() {
  localStorage.setItem('vibe_cart', JSON.stringify(cart));
  renderCartCount();
}

/* Placeholder produktu jako SVG (bez zewnetrznych obrazkow) */
function productSvg(p) {
  const initials = p.name.replace(/[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9 ]/g, '').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  const icon = p.category === 'bluza' ? hoodieIcon(p.accent) : tshirtIcon(p.accent);
  return `<svg viewBox="0 0 320 400" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g-${p.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.color}"/>
      <stop offset="1" stop-color="${shade(p.color, -18)}"/>
    </linearGradient></defs>
    <rect width="320" height="400" fill="url(#g-${p.id})"/>
    <g transform="translate(160,180)">${icon}</g>
    <text x="160" y="350" text-anchor="middle" font-family="Segoe UI, Arial" font-size="26" font-weight="800" fill="${contrast(p.color)}" opacity="0.9">${initials}</text>
  </svg>`;
}
function hoodieIcon(c) {
  return `<g fill="none" stroke="${c}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" transform="translate(-70,-70)">
    <path d="M70 35 q30 -20 60 0 l30 18 -18 30 -12 -7 v70 h-90 v-70 l-12 7 -18 -30 z"/>
    <path d="M85 35 q15 22 30 0"/></g>`;
}
function tshirtIcon(c) {
  return `<g fill="none" stroke="${c}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" transform="translate(-70,-60)">
    <path d="M70 30 l-40 22 18 30 12 -7 v62 h80 v-62 l12 7 18 -30 -40 -22 q-30 22 -60 0 z"/></g>`;
}
function colorHex(name) {
  const map = { czarny:'#18181b', bialy:'#f4f4f5', biały:'#f4f4f5', szary:'#9aa1ad', grafit:'#2b2f36',
    bezowy:'#c8b59a', beżowy:'#c8b59a', oliwkowy:'#5c6b3f', granatowy:'#1e2a4a', kremowy:'#ece4d4',
    piaskowy:'#d8c4a0' };
  return map[name] || '#888';
}
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + Math.round(255 * pct / 100);
  let g = ((n >> 8) & 255) + Math.round(255 * pct / 100);
  let b = (n & 255) + Math.round(255 * pct / 100);
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
function contrast(hex) {
  const n = parseInt(hex.slice(1), 16);
  const yiq = ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return yiq >= 150 ? '#1a1a1a' : '#ffffff';
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ====== Pobranie produktow ====== */
async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    PRODUCTS = await res.json();
    renderProducts();
  } catch (err) {
    $('#productGrid').innerHTML = '<div class="loading">Nie udało się pobrać produktów. Odśwież stronę.</div>';
  }
}

/* ====== Render katalogu ====== */
function renderProducts() {
  const grid = $('#productGrid');
  const list = PRODUCTS.filter(p => currentFilter === 'all' || p.category === currentFilter);
  if (!list.length) { grid.innerHTML = '<div class="loading">Brak produktów.</div>'; return; }
  grid.innerHTML = list.map(p => `
    <article class="card" data-id="${p.id}">
      <div class="card-img">
        ${productSvg(p)}
        <span class="card-tag">${p.category === 'bluza' ? 'Bluza' : 'Koszulka'}</span>
      </div>
      <div class="card-body">
        <div class="card-name">${p.name}</div>
        <div class="card-colors">
          ${p.colors.map(c => `<span class="swatch" style="background:${colorHex(c)}" title="${c}"></span>`).join('')}
        </div>
        <div class="card-foot">
          <span class="price">${money(p.price)}</span>
          <button class="btn-add" data-quick="${p.id}">Dodaj</button>
        </div>
      </div>
    </article>`).join('');
}

/* ====== Modal produktu ====== */
let modalSel = { size: null, color: null };
function openProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  modalSel = { size: p.sizes[0], color: p.colors[0] };
  $('#productModalBody').innerHTML = `
    <div class="pm-img">${productSvg(p)}</div>
    <div class="pm-info">
      <span class="card-tag" style="position:static;display:inline-block;margin-bottom:10px">${p.category === 'bluza' ? 'Bluza' : 'Koszulka'}</span>
      <h3>${p.name}</h3>
      <span class="price">${money(p.price)}</span>
      <p class="pm-desc">${p.description}</p>
      <div class="option-group">
        <label>Rozmiar</label>
        <div class="options" id="sizeOpts">
          ${p.sizes.map((s, i) => `<button class="opt ${i === 0 ? 'selected' : ''}" data-size="${s}">${s}</button>`).join('')}
        </div>
      </div>
      <div class="option-group">
        <label>Kolor</label>
        <div class="options" id="colorOpts">
          ${p.colors.map((c, i) => `<button class="opt ${i === 0 ? 'selected' : ''}" data-color="${c}">${c}</button>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="addToCartBtn" data-id="${p.id}">Dodaj do koszyka</button>
    </div>`;
  $('#productModal').hidden = false;
}

/* ====== Koszyk ====== */
function addToCart(id, size, color, qty = 1) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  size = size || p.sizes[0];
  color = color || p.colors[0];
  const key = `${id}|${size}|${color}`;
  const existing = cart.find(i => i.key === key);
  if (existing) existing.qty += qty;
  else cart.push({ key, id, size, color, qty });
  saveCart();
  toast(`Dodano: ${p.name}`);
}
function removeFromCart(key) { cart = cart.filter(i => i.key !== key); saveCart(); renderCart(); }
function changeQty(key, delta) {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.key !== key);
  saveCart(); renderCart();
}
function cartTotal() {
  return cart.reduce((sum, i) => {
    const p = PRODUCTS.find(x => x.id === i.id);
    return sum + (p ? p.price * i.qty : 0);
  }, 0);
}
function renderCartCount() {
  $('#cartCount').textContent = cart.reduce((s, i) => s + i.qty, 0);
}
function renderCart() {
  const box = $('#cartItems');
  if (!cart.length) { box.innerHTML = '<div class="cart-empty">Koszyk jest pusty.<br>Dodaj coś z kolekcji 👕</div>'; }
  else {
    box.innerHTML = cart.map(i => {
      const p = PRODUCTS.find(x => x.id === i.id);
      if (!p) return '';
      return `<div class="cart-item">
        <div class="cart-item-img">${productSvg(p)}</div>
        <div class="cart-item-info">
          <div class="ci-name">${p.name}</div>
          <div class="ci-meta">${i.size} · ${i.color}</div>
          <div class="qty">
            <button data-dec="${i.key}">−</button><span>${i.qty}</span><button data-inc="${i.key}">+</button>
          </div>
        </div>
        <div class="ci-right">
          <strong>${money(p.price * i.qty)}</strong>
          <button class="ci-remove" data-rm="${i.key}">Usuń</button>
        </div>
      </div>`;
    }).join('');
  }
  $('#cartTotal').textContent = money(cartTotal());
}

/* ====== Checkout ====== */
function checkoutFormHtml() {
  return `<h3>Dane do zamówienia</h3>
    <form id="checkoutForm" class="checkout-form">
      <label>Imię i nazwisko<input name="name" required minlength="2" /></label>
      <label>E-mail<input name="email" type="email" required /></label>
      <label>Telefon<input name="phone" type="tel" /></label>
      <label>Adres dostawy<textarea name="address" required rows="3"></textarea></label>
      <div class="form-summary" id="formSummary"></div>
      <p class="form-error" id="formError" hidden></p>
      <button type="submit" class="btn btn-primary btn-block">Zamawiam i płacę</button>
      <p class="muted small">To wersja demo — płatność nie jest pobierana.</p>
    </form>`;
}
function openCheckout() {
  if (!cart.length) { toast('Koszyk jest pusty'); return; }
  // Zawsze odbudowujemy formularz (po udanym zamowieniu byl zastapiony ekranem sukcesu)
  $('#checkoutContent').innerHTML = checkoutFormHtml();
  $('#checkoutForm').addEventListener('submit', submitOrder);
  const rows = cart.map(i => {
    const p = PRODUCTS.find(x => x.id === i.id);
    return `<div class="fs-row"><span>${p.name} (${i.size}/${i.color}) ×${i.qty}</span><span>${money(p.price * i.qty)}</span></div>`;
  }).join('');
  $('#formSummary').innerHTML = rows + `<div class="fs-row fs-total"><span>Razem</span><span>${money(cartTotal())}</span></div>`;
  $('#cartDrawer').hidden = true;
  $('#checkoutModal').hidden = false;
}

async function submitOrder(e) {
  e.preventDefault();
  const form = e.target;
  const err = $('#formError');
  err.hidden = true;
  const payload = {
    customer: {
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value,
      address: form.address.value
    },
    items: cart.map(i => ({ id: i.id, size: i.size, color: i.color, qty: i.qty }))
  };
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Przetwarzanie…';
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Błąd zamówienia');
    // sukces
    cart = []; saveCart();
    $('#checkoutContent').innerHTML = `
      <div class="success-box">
        <div class="check">✅</div>
        <h3>Dziękujemy za zamówienie!</h3>
        <p class="muted">Numer zamówienia:</p>
        <p class="order-id">${data.orderId}</p>
        <p class="muted" style="margin-top:10px">Na podany e-mail wyślemy potwierdzenie.<br>Kwota: <strong>${money(data.total)}</strong></p>
        <button class="btn btn-primary" style="margin-top:18px" data-close-checkout>Wróć do sklepu</button>
      </div>`;
  } catch (e2) {
    err.textContent = e2.message; err.hidden = false;
    btn.disabled = false; btn.textContent = 'Zamawiam i płacę';
  }
}

/* ====== Zdarzenia ====== */
function setFilter(f) {
  currentFilter = f;
  $('#shopTitle').textContent = f === 'all' ? 'Cała kolekcja' : (f === 'bluza' ? 'Bluzy' : 'Koszulki');
  $$('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
  $$('.nav-link').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
  renderProducts();
}

document.addEventListener('click', (e) => {
  const t = e.target;

  // filtry
  if (t.dataset.filter) { e.preventDefault(); setFilter(t.dataset.filter); window.scrollTo({ top: document.querySelector('#sklep').offsetTop - 70, behavior: 'smooth' }); return; }

  // szybkie dodanie z karty
  if (t.dataset.quick) { e.stopPropagation(); addToCart(t.dataset.quick); return; }

  // klik w karte -> modal
  const card = t.closest('.card');
  if (card && card.dataset.id) { openProduct(card.dataset.id); return; }

  // wybor rozmiaru/koloru w modalu
  if (t.dataset.size) { modalSel.size = t.dataset.size; $$('#sizeOpts .opt').forEach(o => o.classList.toggle('selected', o === t)); return; }
  if (t.dataset.color) { modalSel.color = t.dataset.color; $$('#colorOpts .opt').forEach(o => o.classList.toggle('selected', o === t)); return; }

  // dodaj z modalu
  if (t.id === 'addToCartBtn') { addToCart(t.dataset.id, modalSel.size, modalSel.color); $('#productModal').hidden = true; return; }

  // koszyk - operacje
  if (t.dataset.inc) { changeQty(t.dataset.inc, 1); return; }
  if (t.dataset.dec) { changeQty(t.dataset.dec, -1); return; }
  if (t.dataset.rm) { removeFromCart(t.dataset.rm); return; }

  // otwarcie/zamkniecie koszyka
  if (t.closest('#cartBtn')) { renderCart(); $('#cartDrawer').hidden = false; return; }
  if (t.hasAttribute('data-close-cart') || (t.id === 'cartDrawer')) { $('#cartDrawer').hidden = true; return; }

  // checkout
  if (t.id === 'checkoutBtn') { openCheckout(); return; }
  if (t.hasAttribute('data-close-checkout') || t.id === 'checkoutModal') { $('#checkoutModal').hidden = true; return; }

  // zamkniecie modali
  if (t.hasAttribute('data-close') || t.id === 'productModal') { $('#productModal').hidden = true; return; }
  if (t.dataset.nav === 'home') { e.preventDefault(); setFilter('all'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $('#productModal').hidden = true; $('#cartDrawer').hidden = true; $('#checkoutModal').hidden = true;
  }
});

/* ====== Start ====== */
renderCartCount();
fetchProducts();
