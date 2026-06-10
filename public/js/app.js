'use strict';

/* ====== Stan ====== */
let PRODUCTS = [];
let currentFilter = 'all';
let searchQuery = '';
let sortBy = 'featured';
let shopSettings = { freeShippingThreshold: 0, shippingCost: 25 };
let appliedDiscount = null;
let cart = loadCart();

/* ====== Pomocnicze ====== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const money = (n) => n.toFixed(2).replace('.', ',') + ' zł';
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function loadCart() {
  try { return JSON.parse(localStorage.getItem('vibe_cart')) || []; }
  catch { return []; }
}
function saveCart() {
  localStorage.setItem('vibe_cart', JSON.stringify(cart));
  renderCartCount();
  if (document.body.dataset.page === 'cart') initCartPage();
}

/* ====== Lista życzeń (localStorage) ====== */
let wishlist = loadWishlist();
function loadWishlist() { try { return JSON.parse(localStorage.getItem('vibe_wishlist')) || []; } catch { return []; } }
function saveWishlist() { localStorage.setItem('vibe_wishlist', JSON.stringify(wishlist)); renderWishCount(); }
function inWishlist(id) { return wishlist.includes(id); }
function toggleWishlist(id) {
  if (inWishlist(id)) wishlist = wishlist.filter((x) => x !== id);
  else wishlist.push(id);
  saveWishlist();
}
function renderWishCount() { $$('#wishCount').forEach((el) => { el.textContent = wishlist.length; }); }

/* Dostępność z uwzględnieniem wariantów (po stronie klienta) */
function clientVariantStock(p, size, color) {
  if (p.variants && Object.keys(p.variants).length) {
    const k = `${size}||${color}`;
    return k in p.variants ? (parseInt(p.variants[k], 10) || 0) : 0;
  }
  return p.stock;
}
function clientAvailable(p) {
  if (p.variants && Object.keys(p.variants).length) {
    return Object.values(p.variants).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
  }
  return p.stock;
}

/* Placeholder produktu jako SVG (bez zewnetrznych obrazkow) */
function productSvg(p) {
  const icon = p.category === 'bluza' ? hoodieIcon(p.accent) : tshirtIcon(p.accent);
  return `<svg viewBox="0 0 320 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><linearGradient id="g-${p.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.color}"/>
      <stop offset="1" stop-color="${shade(p.color, -18)}"/>
    </linearGradient></defs>
    <rect width="320" height="400" fill="url(#g-${p.id})"/>
    <g transform="translate(160,180)">${icon}</g>
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

function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 2200);
}

/* Gwiazdki z realnej sredniej oceny */
function starsHtml(avg) {
  const full = Math.round(avg);
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
}

/* ====== Pobranie produktow ====== */
async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    PRODUCTS = await res.json();
  } catch (err) {
    if ($('#productGrid')) $('#productGrid').innerHTML = '<div class="loading">Nie udało się pobrać produktów. Odśwież stronę.</div>';
    return;
  }
  if ($('#productGrid')) renderProducts();
  if ($('#relatedGrid')) renderRelated();
  updatePpAvailability();
  if (document.body.dataset.page === 'wishlist') initWishlistPage();
  if (document.body.dataset.page === 'cart') initCartPage();
  applyReveal();
}

/* ====== Dostępność wariantu na stronie produktu ====== */
function updatePpAvailability() {
  const btn = $('#ppAdd'); if (!btn) return;
  const p = PRODUCTS.find((x) => x.id === document.body.dataset.productId); if (!p) return;
  const sizeEl = $('#sizeOpts .opt.selected'), colorEl = $('#colorOpts .opt.selected');
  const av = clientVariantStock(p, sizeEl && sizeEl.dataset.size, colorEl && colorEl.dataset.color);
  btn.disabled = av <= 0;
  btn.textContent = av <= 0 ? 'Wyprzedane' : 'Dodaj do koszyka';
  const note = $('#ppStock');
  if (note) {
    note.className = 'pp-stock' + (av <= 0 ? ' soldout' : (av <= 5 ? ' low' : ''));
    note.textContent = av <= 0 ? 'Wybrany wariant niedostępny' : (av <= 5 ? `Zostały ostatnie sztuki: ${av}` : '✔ Dostępny, wysyłka 24h');
  }
}

/* ====== Strona ulubionych ====== */
function initWishlistPage() {
  const grid = $('#wishlistGrid'); if (!grid) return;
  const items = PRODUCTS.filter((p) => wishlist.includes(p.id));
  grid.innerHTML = items.length
    ? items.map((p, i) => cardHtml(p, i)).join('')
    : '<p class="muted">Brak ulubionych produktów. Klikaj serce ♥ na produktach, aby je tu zapisać.</p>';
  applyReveal(grid);
}

/* ====== Strona koszyka ====== */
function initCartPage() {
  const box = $('#cartPage'); if (!box) return;
  if (!cart.length) { box.innerHTML = '<p class="muted">Twój koszyk jest pusty. <a href="/#sklep" style="color:var(--accent)">Przejdź do sklepu →</a></p>'; return; }
  const items = cart.map((i) => {
    const p = PRODUCTS.find((x) => x.id === i.id); if (!p) return '';
    const media = p.image ? `<img class="card-photo" src="${p.image}" alt="">` : productSvg(p);
    return `<div class="cart-item">
      <div class="cart-item-img">${media}</div>
      <div class="cart-item-info"><div class="ci-name">${p.name}</div><div class="ci-meta">${i.size} · ${i.color}</div>
        <div class="qty"><button data-dec="${i.key}">−</button><span>${i.qty}</span><button data-inc="${i.key}">+</button></div></div>
      <div class="ci-right"><strong>${money(p.price * i.qty)}</strong><button class="ci-remove" data-rm="${i.key}">Usuń</button></div>
    </div>`;
  }).join('');
  const sub = cartTotal();
  const ship = (shopSettings.freeShippingThreshold > 0 && sub >= shopSettings.freeShippingThreshold) ? 0 : shopSettings.shippingCost;
  box.innerHTML = `<div class="cart-page-grid">
    <div>${items}</div>
    <div class="panel-card">
      <h3>Podsumowanie</h3>
      <div class="fs-row"><span>Produkty</span><span>${money(sub)}</span></div>
      <div class="fs-row"><span>Dostawa</span><span>${ship === 0 ? 'gratis 🎉' : money(ship)}</span></div>
      <div class="fs-row fs-total"><span>Razem</span><span>${money(Math.max(0, sub + ship))}</span></div>
      <button class="btn btn-primary btn-block" id="checkoutBtn" style="margin-top:14px">Przejdź do zamówienia</button>
      <p class="muted small" style="margin-top:8px">Kod rabatowy podasz w następnym kroku.</p>
    </div>
  </div>`;
}

/* ====== WOW: odslanianie przy scrollu ====== */
const revealObserver = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); revealObserver.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' })
  : null;
function applyReveal(scope = document) {
  if (!revealObserver) return;
  const sel = '.feature, .card, .info-card, .newsletter-box, .related h2, .product-gallery, .pp-info';
  $$(sel, scope).filter((el) => !el.classList.contains('reveal')).forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = ((i % 6) * 70) + 'ms';
    revealObserver.observe(el);
  });
}

/* ====== WOW: przycisk powrotu na gore ====== */
function initToTop() {
  const btn = $('#toTop');
  if (!btn) return;
  window.addEventListener('scroll', () => { btn.classList.toggle('show', window.scrollY > 400); }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ====== Karta produktu (link do strony produktu) ====== */
function cardHtml(p, i) {
  const rt = p.rating || { avg: 0, count: 0 };
  const ratingHtml = rt.count > 0
    ? `<div class="card-rating">${starsHtml(rt.avg)} <span>${rt.avg.toFixed(1)} (${rt.count})</span></div>`
    : '';
  const avail = clientAvailable(p);
  const sold = avail <= 0;
  const stockBadge = sold ? '<span class="badge soldout">Wyprzedane</span>'
    : (avail <= 5 ? '<span class="badge low">Ostatnie sztuki</span>' : '');
  const addBtn = sold ? '<button class="btn-add" type="button" disabled>Wyprzedane</button>'
    : `<button class="btn-add" data-quick="${p.id}" type="button">Do koszyka</button>`;
  const media = p.image ? `<img class="card-photo" src="${p.image}" alt="${p.name}" loading="lazy">` : productSvg(p);
  return `
    <a class="card${sold ? ' soldout' : ''}" href="/produkt/${p.id}" data-id="${p.id}" style="animation-delay:${i * 50}ms">
      <div class="card-img">
        ${media}
        <button class="wish-btn ${inWishlist(p.id) ? 'on' : ''}" data-wish="${p.id}" type="button" aria-label="Dodaj do ulubionych">♥</button>
        <span class="badge cat">${p.category === 'bluza' ? 'Bluza' : 'Koszulka'}</span>
        ${p.featured ? '<span class="badge hot">Bestseller</span>' : ''}
        ${stockBadge}
      </div>
      <div class="card-body">
        <div class="card-name">${p.name}</div>
        ${ratingHtml}
        <div class="card-colors">
          ${p.colors.map(c => `<span class="swatch" style="background:${colorHex(c)}" title="${c}"></span>`).join('')}
        </div>
        <div class="card-foot">
          <span class="price">${money(p.price)}</span>
          ${addBtn}
        </div>
      </div>
    </a>`;
}

function sortProducts(list, by) {
  const a = list.slice();
  if (by === 'price-asc') a.sort((x, y) => x.price - y.price);
  else if (by === 'price-desc') a.sort((x, y) => y.price - x.price);
  else if (by === 'name') a.sort((x, y) => x.name.localeCompare(y.name, 'pl'));
  else a.sort((x, y) => (y.featured ? 1 : 0) - (x.featured ? 1 : 0)); // featured na gore
  return a;
}
function renderProducts() {
  const grid = $('#productGrid');
  let list = PRODUCTS.filter(p => currentFilter === 'all' || p.category === currentFilter);
  const q = searchQuery.trim().toLowerCase();
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || p.category.includes(q));
  list = sortProducts(list, sortBy);
  grid.innerHTML = list.length
    ? list.map((p, i) => cardHtml(p, i)).join('')
    : `<div class="loading">Brak produktów spełniających kryteria${q ? ` „${q}"` : ''}.</div>`;
  applyReveal(grid);
}
function initShopTools() {
  const search = $('#searchInput'), sort = $('#sortSelect');
  if (search) search.addEventListener('input', () => { searchQuery = search.value; renderProducts(); });
  if (sort) sort.addEventListener('change', () => { sortBy = sort.value; renderProducts(); });
}

function renderRelated() {
  const grid = $('#relatedGrid');
  const currentId = document.body.dataset.productId;
  const current = PRODUCTS.find(p => p.id === currentId);
  let list = PRODUCTS.filter(p => p.id !== currentId);
  if (current) list.sort((a, b) => (b.category === current.category) - (a.category === current.category));
  grid.innerHTML = list.slice(0, 4).map((p, i) => cardHtml(p, i)).join('');
}

/* ====== Koszyk ====== */
function addToCart(id, size, color, qty = 1) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  if (clientAvailable(p) <= 0) { toast('Produkt niedostępny'); return; }
  size = p.sizes.includes(size) ? size : p.sizes[0];
  color = p.colors.includes(color) ? color : p.colors[0];
  const key = `${id}|${size}|${color}`;
  const existing = cart.find(i => i.key === key);
  if (existing) existing.qty += qty;
  else cart.push({ key, id, size, color, qty });
  saveCart();
  // mikrointerakcja: "pop" licznika koszyka
  const cc = $('#cartCount');
  if (cc) { cc.classList.remove('pop'); void cc.offsetWidth; cc.classList.add('pop'); }
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
  const el = $('#cartCount');
  if (el) el.textContent = cart.reduce((s, i) => s + i.qty, 0);
}
function renderCart() {
  const box = $('#cartItems');
  if (!box) return;
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
  const tot = $('#cartTotal'); if (tot) tot.textContent = money(cartTotal());
}

/* ====== Checkout ====== */
function checkoutFormHtml() {
  return `<h3>Dane do zamówienia</h3>
    <form id="checkoutForm" class="checkout-form">
      <label>Imię i nazwisko<input name="name" required minlength="2" /></label>
      <label>E-mail<input name="email" type="email" required /></label>
      <label>Telefon<input name="phone" type="tel" required /></label>
      <div class="delivery-choice">
        <label class="dm-opt"><input type="radio" name="deliveryMethod" value="kurier" checked /> <span>🚚 Kurier</span></label>
        <label class="dm-opt"><input type="radio" name="deliveryMethod" value="paczkomat" /> <span>📦 Paczkomat</span></label>
      </div>
      <div id="kurierFields">
        <label>Ulica i numer<input name="street" /></label>
        <div class="addr-row">
          <label>Kod pocztowy<input name="postalCode" placeholder="00-000" /></label>
          <label>Miasto<input name="city" /></label>
        </div>
      </div>
      <div id="paczkomatFields" hidden>
        <label>Kod paczkomatu<input name="parcelLocker" placeholder="np. LES01A" /></label>
        <p class="muted small">Podaj kod paczkomatu InPost, do którego mamy wysłać przesyłkę.</p>
      </div>
      <div class="discount-row">
        <input type="text" id="discountInput" placeholder="Kod rabatowy" autocomplete="off" />
        <button type="button" class="btn btn-ghost" id="applyDiscount">Zastosuj</button>
      </div>
      <p class="discount-msg" id="discountMsg" hidden></p>
      <div class="form-summary" id="formSummary"></div>
      <p class="form-error" id="formError" hidden></p>
      <button type="submit" class="btn btn-primary btn-block">Zamawiam</button>
      <p class="muted small">Płatność: przelew tradycyjny. Dane do przelewu (z numerem zamówienia w tytule) pokażemy zaraz po złożeniu zamówienia i wyślemy na e-mail.</p>
    </form>`;
}
function checkoutTotals() {
  const sub = cartTotal();
  const shipping = (shopSettings.freeShippingThreshold > 0 && sub >= shopSettings.freeShippingThreshold) ? 0 : shopSettings.shippingCost;
  let discount = 0;
  if (appliedDiscount) {
    discount = appliedDiscount.type === 'percent' ? sub * (appliedDiscount.value / 100) : appliedDiscount.value;
    discount = Math.min(discount, sub);
  }
  return { sub, shipping, discount, total: Math.max(0, sub + shipping - discount) };
}
function renderCheckoutSummary() {
  const t = checkoutTotals();
  const rows = cart.map(i => {
    const p = PRODUCTS.find(x => x.id === i.id);
    return `<div class="fs-row"><span>${p.name} (${i.size}/${i.color}) ×${i.qty}</span><span>${money(p.price * i.qty)}</span></div>`;
  }).join('');
  const dm = (document.querySelector('input[name="deliveryMethod"]:checked') || {}).value;
  const dmLabel = dm === 'paczkomat' ? 'Dostawa (Paczkomat)' : 'Dostawa (Kurier)';
  $('#formSummary').innerHTML = rows
    + `<div class="fs-row"><span>${dmLabel}</span><span>${t.shipping === 0 ? 'gratis 🎉' : money(t.shipping)}</span></div>`
    + (t.discount > 0 ? `<div class="fs-row"><span>Rabat ${appliedDiscount.code}</span><span>-${money(t.discount)}</span></div>` : '')
    + `<div class="fs-row fs-total"><span>Razem</span><span>${money(t.total)}</span></div>`;
}
async function applyDiscount() {
  const code = ($('#discountInput').value || '').trim();
  const msg = $('#discountMsg');
  if (!code) { appliedDiscount = null; msg.hidden = true; renderCheckoutSummary(); return; }
  try {
    const res = await fetch('/api/discount/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, subtotal: cartTotal() })
    });
    const data = await res.json();
    msg.hidden = false;
    if (res.ok) { appliedDiscount = data; msg.textContent = `Kod ${data.code} zastosowany (−${money(data.amount)})`; msg.style.color = 'var(--ok)'; }
    else { appliedDiscount = null; msg.textContent = data.error || 'Niepoprawny kod'; msg.style.color = 'var(--danger)'; }
  } catch { appliedDiscount = null; }
  renderCheckoutSummary();
}
function updateDeliveryFields() {
  const form = $('#checkoutForm'); if (!form) return;
  const method = (form.querySelector('input[name="deliveryMethod"]:checked') || {}).value || 'kurier';
  const isLocker = method === 'paczkomat';
  $('#kurierFields').hidden = isLocker;
  $('#paczkomatFields').hidden = !isLocker;
  // required tylko na widocznych polach (ukryte required blokuje wysylke formularza)
  ['street', 'postalCode', 'city'].forEach((n) => { const el = form.elements[n]; if (el) el.required = !isLocker; });
  const locker = form.elements['parcelLocker']; if (locker) locker.required = isLocker;
}
function openCheckout() {
  if (!cart.length) { toast('Koszyk jest pusty'); return; }
  appliedDiscount = null;
  $('#checkoutContent').innerHTML = checkoutFormHtml();
  $('#checkoutForm').addEventListener('submit', submitOrder);
  $('#applyDiscount').addEventListener('click', applyDiscount);
  $$('#checkoutForm input[name="deliveryMethod"]').forEach((r) => r.addEventListener('change', () => { updateDeliveryFields(); renderCheckoutSummary(); }));
  updateDeliveryFields();
  renderCheckoutSummary();
  if ($('#cartDrawer')) $('#cartDrawer').hidden = true;
  $('#checkoutModal').hidden = false;
}
function copyToClipboard(text, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = 'Skopiowano ✓'; btn.classList.add('copied'); setTimeout(() => { btn.textContent = o; btn.classList.remove('copied'); }, 1600); } };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else { fallbackCopy(text, done); }
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); done && done(); } catch {}
  document.body.removeChild(ta);
}
function paymentInstructionsHtml(pay) {
  if (!pay) return '';
  const acc = String(pay.account || '');
  const accPlain = acc.replace(/\s/g, '');
  const row = (label, shown, copyVal) =>
    `<div class="pay-row"><div class="pay-cell"><span class="pay-label">${label}</span><span class="pay-val">${shown}</span></div>` +
    `<button class="pay-copy" type="button" data-copy="${copyVal.replace(/"/g, '&quot;')}">Kopiuj</button></div>`;
  return `<div class="pay-instr">
      <h4>Dokończ zakup — opłać przelewem</h4>
      <p class="muted small">Wykonaj zwykły przelew na poniższe dane. W tytule koniecznie podaj numer zamówienia. Zamówienie realizujemy po zaksięgowaniu wpłaty.</p>
      ${row('Odbiorca', pay.recipient, pay.recipient)}
      ${row('Nr konta' + (pay.bank ? ' (' + pay.bank + ')' : ''), acc, accPlain)}
      ${row('Tytuł przelewu', pay.title, pay.title)}
      ${row('Kwota', money(pay.amount), Number(pay.amount).toFixed(2))}
      <button class="btn btn-ghost btn-block pay-copy" type="button" style="margin-top:10px" data-copy="Odbiorca: ${pay.recipient}\nNr konta: ${accPlain}\nTytuł: ${pay.title}\nKwota: ${Number(pay.amount).toFixed(2)} PLN">Kopiuj wszystkie dane</button>
    </div>`;
}
async function submitOrder(e) {
  e.preventDefault();
  const form = e.target;
  const err = $('#formError');
  err.hidden = true;
  const deliveryMethod = (form.querySelector('input[name="deliveryMethod"]:checked') || {}).value || 'kurier';
  const payload = {
    customer: {
      name: form.name.value, email: form.email.value, phone: form.phone.value,
      street: form.street.value, postalCode: form.postalCode.value, city: form.city.value
    },
    deliveryMethod,
    parcelLocker: form.parcelLocker ? form.parcelLocker.value : '',
    items: cart.map(i => ({ id: i.id, size: i.size, color: i.color, qty: i.qty })),
    discountCode: appliedDiscount ? appliedDiscount.code : ''
  };
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Przetwarzanie…';
  try {
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Błąd zamówienia');
    cart = []; saveCart();
    $('#checkoutContent').innerHTML = `
      <div class="success-box">
        <div class="check">✅</div>
        <h3>Dziękujemy za zamówienie!</h3>
        <p class="muted">Numer zamówienia:</p>
        <p class="order-id">${data.orderId}</p>
        ${paymentInstructionsHtml(data.payment)}
        <p class="muted small" style="margin-top:12px">Potwierdzenie wraz z danymi do przelewu wyślemy też na podany e-mail.</p>
        <button class="btn btn-primary btn-block" style="margin-top:14px" data-close-checkout>Wróć do sklepu</button>
      </div>`;
    $$('#checkoutContent .pay-copy').forEach((b) => b.addEventListener('click', () => copyToClipboard(b.dataset.copy, b)));
  } catch (e2) {
    err.textContent = e2.message; err.hidden = false;
    btn.disabled = false; btn.textContent = 'Zamawiam i płacę';
  }
}

/* ====== Filtry (strona glowna) ====== */
function setFilter(f) {
  currentFilter = f;
  const titles = { all: 'Cała kolekcja', bluza: 'Bluzy', koszulka: 'Koszulki' };
  const subs = {
    all: 'Wszystkie bluzy i koszulki Vibe',
    bluza: 'Ciepłe bluzy z kapturem — premium bawełna',
    koszulka: 'Koszulki na co dzień — krój regular i oversize'
  };
  const t = $('#shopTitle'); if (t) t.textContent = titles[f];
  const sub = $('#shopSub'); if (sub) sub.textContent = subs[f];
  $$('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
  $$('.nav-link').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
  if ($('#productGrid')) renderProducts();
}

/* ====== Strona produktu: dodanie do koszyka ====== */
function ppAddToCart(id) {
  const sizeEl = $('#sizeOpts .opt.selected');
  const colorEl = $('#colorOpts .opt.selected');
  addToCart(id, sizeEl && sizeEl.dataset.size, colorEl && colorEl.dataset.color);
  renderCart();
  if ($('#cartDrawer')) $('#cartDrawer').hidden = false;
}

/* ====== Globalny handler klikniec ====== */
document.addEventListener('click', (e) => {
  const t = e.target;

  // serce — lista życzeń (nie nawiguj do produktu)
  if (t.dataset && t.dataset.wish) {
    e.preventDefault(); e.stopPropagation();
    toggleWishlist(t.dataset.wish);
    t.classList.toggle('on', inWishlist(t.dataset.wish));
    if (document.body.dataset.page === 'wishlist') initWishlistPage();
    return;
  }

  // szybkie dodanie z karty (nie nawiguj do strony produktu)
  if (t.dataset && t.dataset.quick) { e.preventDefault(); e.stopPropagation(); addToCart(t.dataset.quick); return; }

  // wybor opcji (rozmiar/kolor) na stronie produktu
  if (t.classList && t.classList.contains('opt')) {
    $$('.opt', t.parentElement).forEach(o => o.classList.toggle('selected', o === t));
    updatePpAvailability();
    return;
  }

  // galeria produktu: klik w miniature przelacza glowne zdjecie
  const thumb = t.closest && t.closest('.gallery-thumb');
  if (thumb) {
    const main = document.getElementById('galleryMain');
    if (main) main.src = thumb.dataset.src;
    document.querySelectorAll('.gallery-thumb').forEach((b) => b.classList.toggle('active', b === thumb));
    return;
  }

  // dodanie do koszyka ze strony produktu
  if (t.id === 'ppAdd') { ppAddToCart(t.dataset.id); return; }

  // filtry (strona glowna). Jesli nie jestesmy na stronie z katalogiem -> przejdz do /
  if (t.dataset && t.dataset.filter) {
    if ($('#productGrid')) {
      e.preventDefault(); setFilter(t.dataset.filter);
      const sklep = $('#sklep'); if (sklep) window.scrollTo({ top: sklep.offsetTop - 70, behavior: 'smooth' });
    }
    return; // na innych stronach link prowadzi do "/"
  }

  // koszyk - operacje
  if (t.dataset && t.dataset.inc) { changeQty(t.dataset.inc, 1); return; }
  if (t.dataset && t.dataset.dec) { changeQty(t.dataset.dec, -1); return; }
  if (t.dataset && t.dataset.rm) { removeFromCart(t.dataset.rm); return; }

  // koszyk - otwarcie / zamkniecie
  if (t.closest && t.closest('#cartBtn')) { renderCart(); $('#cartDrawer').hidden = false; return; }
  if (t.hasAttribute && (t.hasAttribute('data-close-cart') || t.id === 'cartDrawer')) { $('#cartDrawer').hidden = true; return; }

  // checkout
  if (t.id === 'checkoutBtn') { openCheckout(); return; }
  if (t.hasAttribute && (t.hasAttribute('data-close-checkout') || t.id === 'checkoutModal')) { $('#checkoutModal').hidden = true; return; }

  // logo -> strona glowna z resetem filtra (tylko gdy katalog na stronie)
  if (t.dataset && t.dataset.nav === 'home' && $('#productGrid')) {
    e.preventDefault(); setFilter('all'); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($('#cartDrawer')) $('#cartDrawer').hidden = true;
    if ($('#checkoutModal')) $('#checkoutModal').hidden = true;
  }
});

/* ====== Hero visual (strona glowna) ====== */
function renderHero() {
  const el = $('#heroVisual');
  if (!el) return;
  el.innerHTML = `<svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5b4bff"/><stop offset="1" stop-color="#8f86ff"/>
    </linearGradient></defs>
    <circle cx="250" cy="250" r="180" fill="url(#hg)" opacity="0.16"/>
    <circle cx="250" cy="250" r="120" fill="url(#hg)" opacity="0.12"/>
    <g transform="translate(250,250) scale(2.1)" fill="none" stroke="url(#hg)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
      <path d="M-60 -65 q40 -25 80 0 l38 22 -22 38 -16 -9 v85 h-118 v-85 l-16 9 -22 -38 z"/>
      <path d="M-42 -65 q20 28 40 0"/>
    </g>
    <text x="250" y="466" text-anchor="middle" font-family="Sora, sans-serif" font-size="28" font-weight="800" fill="#5b4bff" opacity="0.9">VIBE PREMIUM</text>
  </svg>`;
}

/* ====== Newsletter ====== */
const nf = $('#newsletterForm');
if (nf) nf.addEventListener('submit', (e) => { e.preventDefault(); e.target.reset(); toast('Zapisano! Sprawdź skrzynkę 📩'); });

/* ====== Opinie na stronie produktu ====== */
async function initReviews() {
  const box = $('#reviewsBox');
  if (!box) return;
  const id = document.body.dataset.productId;
  let data;
  try { data = await (await fetch('/api/products/' + id + '/reviews')).json(); }
  catch { box.innerHTML = '<p class="muted">Nie udało się wczytać opinii.</p>'; return; }

  const ppr = $('#ppRating');
  if (ppr) ppr.innerHTML = data.count > 0
    ? `<span class="stars">${starsHtml(data.avg)}</span> <span class="muted">${data.avg.toFixed(1)} · ${data.count} ${data.count === 1 ? 'opinia' : 'opinii'}</span>`
    : '<span class="muted">Brak opinii — bądź pierwszy</span>';

  const listHtml = data.reviews.length
    ? data.reviews.map((r) => `<div class="review">
        <div class="review-top"><strong>${escHtml(r.name)}</strong> <span class="stars">${starsHtml(r.rating)}</span>
        <span class="muted review-date">${new Date(r.createdAt).toLocaleDateString('pl-PL')}</span></div>
        ${r.comment ? `<p>${escHtml(r.comment)}</p>` : ''}</div>`).join('')
    : '<p class="muted">Brak opinii. Bądź pierwszy, który oceni ten produkt.</p>';

  let formHtml = '';
  const cur = data.myReview;
  if (data.canReview) {
    formHtml = `<div class="review-form">
      <h3>${cur ? 'Twoja opinia' : 'Dodaj opinię'}</h3>
      <div class="star-pick" id="starPick">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" class="${cur && n <= cur.rating ? 'on' : ''}">★</button>`).join('')}</div>
      <textarea id="reviewComment" rows="3" placeholder="Twoja opinia (opcjonalnie)">${cur ? escHtml(cur.comment || '') : ''}</textarea>
      <button class="btn btn-primary" id="submitReview" type="button">${cur ? 'Zaktualizuj opinię' : 'Wyślij opinię'}</button>
    </div>`;
  } else if (data.loggedIn) {
    formHtml = '<p class="muted review-note">Opinię możesz dodać dopiero po zakupie tego produktu.</p>';
  } else {
    formHtml = '<p class="muted review-note"><a href="/logowanie">Zaloguj się</a>, aby dodać opinię (po zakupie).</p>';
  }
  box.innerHTML = listHtml + formHtml;

  if (data.canReview) {
    let chosen = cur ? cur.rating : 0;
    const pick = $('#starPick');
    pick.addEventListener('click', (e) => {
      if (!e.target.dataset.star) return;
      chosen = parseInt(e.target.dataset.star, 10);
      $$('#starPick button').forEach((b) => b.classList.toggle('on', parseInt(b.dataset.star, 10) <= chosen));
    });
    $('#submitReview').addEventListener('click', async () => {
      if (!chosen) { toast('Wybierz ocenę (gwiazdki)'); return; }
      const res = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id, rating: chosen, comment: $('#reviewComment').value })
      });
      const d = await res.json();
      if (res.ok) { toast('Dziękujemy za opinię!'); initReviews(); }
      else toast(d.error || 'Nie udało się dodać opinii');
    });
  }
}

/* ====== Ustawienia sklepu (dostawa) ====== */
async function initSettings() {
  try {
    const r = await fetch('/api/settings');
    const s = await r.json();
    if (typeof s.freeShippingThreshold === 'number') shopSettings.freeShippingThreshold = s.freeShippingThreshold;
    if (typeof s.shippingCost === 'number') shopSettings.shippingCost = s.shippingCost;
  } catch {}
}

/* ====== Stan konta w naglowku ====== */
async function initAccountHeader() {
  const btn = $('#accountBtn');
  if (!btn) return;
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    const label = $('#accountLabel');
    if (data.user) {
      if (label) label.textContent = (data.user.name || '').split(' ')[0] || 'Konto';
      btn.href = data.user.role === 'admin' ? '/admin' : '/konto';
    } else {
      if (label) label.textContent = 'Zaloguj';
      btn.href = '/logowanie';
    }
  } catch {}
}

/* ====== Start ====== */
renderHero();
renderCartCount();
renderWishCount();
initAccountHeader();
initSettings();
initToTop();
initShopTools();
applyReveal();
initReviews();
fetchProducts();
