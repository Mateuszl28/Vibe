'use strict';

/* Obsluga stron: logowanie/rejestracja, panel klienta, panel admina */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const money = (n) => Number(n).toFixed(2).replace('.', ',') + ' zł';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const statusClass = (s) => 'status ' + String(s).replace(/\s+/g, '-');
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 2400);
}
async function api(url, opts) {
  const res = await fetch(url, opts);
  let data = {};
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}
function getNext() {
  const n = new URLSearchParams(location.search).get('next');
  return n && n.startsWith('/') ? n : null;
}
async function doLogout() {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = '/';
}

/* ====== Logowanie / Rejestracja ====== */
function initAuth() {
  const tabLogin = $('#tabLogin'), tabReg = $('#tabRegister');
  const loginForm = $('#loginForm'), regForm = $('#registerForm'), foot = $('#authFoot');
  function show(mode) {
    const reg = mode === 'register';
    tabLogin.classList.toggle('active', !reg);
    tabReg.classList.toggle('active', reg);
    loginForm.hidden = reg; regForm.hidden = !reg;
    foot.innerHTML = reg
      ? 'Masz już konto? <a href="#" id="switchToLogin">Zaloguj się</a>'
      : 'Nie masz konta? <a href="#" id="switchToRegister">Zarejestruj się</a>';
  }
  if (location.pathname === '/rejestracja') show('register');
  tabLogin.addEventListener('click', () => show('login'));
  tabReg.addEventListener('click', () => show('register'));
  document.addEventListener('click', (e) => {
    if (e.target.id === 'switchToRegister') { e.preventDefault(); show('register'); }
    if (e.target.id === 'switchToLogin') { e.preventDefault(); show('login'); }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginError'); err.hidden = true;
    const btn = loginForm.querySelector('button'); btn.disabled = true; btn.textContent = 'Logowanie…';
    const { ok, data } = await api('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginForm.login.value, password: loginForm.password.value })
    });
    if (ok) {
      const next = getNext();
      location.href = next || (data.user && data.user.role === 'admin' ? '/admin' : '/konto');
    } else {
      err.textContent = data.error || 'Błąd logowania'; err.hidden = false;
      btn.disabled = false; btn.textContent = 'Zaloguj się';
    }
  });

  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#registerError'); err.hidden = true;
    const btn = regForm.querySelector('button'); btn.disabled = true; btn.textContent = 'Tworzenie…';
    const { ok, data } = await api('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: regForm.name.value, email: regForm.email.value, password: regForm.password.value })
    });
    if (ok) { location.href = getNext() || '/konto'; }
    else { err.textContent = data.error || 'Błąd rejestracji'; err.hidden = false; btn.disabled = false; btn.textContent = 'Załóż konto'; }
  });
}

/* ====== Wspolne: render zamowienia ====== */
function orderCard(o, admin) {
  const items = o.items.map((i) => `<div>${esc(i.name)} — ${esc(i.size)}/${esc(i.color)} ×${i.qty} <span class="muted">(${money(i.lineTotal)})</span></div>`).join('');
  const date = new Date(o.createdAt).toLocaleString('pl-PL');
  const statusCtrl = admin
    ? `<select data-order="${esc(o.id)}">${['nowe', 'w realizacji', 'wyslane', 'zrealizowane', 'anulowane']
        .map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select>`
    : `<span class="${statusClass(o.status)}">${esc(o.status)}</span>`;
  return `<div class="order-card">
    <div class="order-top">
      <span class="oid">${esc(o.id)}</span>
      <span class="muted">${esc(date)}</span>
    </div>
    ${admin ? `<div class="muted" style="font-size:.85rem;margin-bottom:8px">${esc(o.customer.name)} · ${esc(o.customer.email)} · ${esc(o.customer.phone || '—')} · ${esc(o.customer.address)}</div>` : ''}
    <div class="order-items">${items}</div>
    ${(o.shipping || o.discount) ? `<div class="muted" style="font-size:.83rem;margin-top:6px">Dostawa: ${o.shipping ? money(o.shipping) : 'gratis'}${o.discount ? ` · Rabat ${esc(o.discountCode || '')}: -${money(o.discount)}` : ''}</div>` : ''}
    <div class="order-foot">
      <strong>${money(o.total)}</strong>
      ${statusCtrl}
    </div>
    ${admin ? `<div class="order-note">
      <textarea data-note="${esc(o.id)}" rows="2" placeholder="Notatka wewnętrzna…">${esc(o.note || '')}</textarea>
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="btn btn-ghost" data-savenote="${esc(o.id)}" type="button" style="padding:6px 12px">Zapisz notatkę</button>
        <button class="btn btn-ghost" data-print="${esc(o.id)}" type="button" style="padding:6px 12px">Drukuj</button>
      </div>
    </div>` : ''}
  </div>`;
}

/* ====== Panel klienta ====== */
async function initKonto() {
  const me = await api('/api/auth/me');
  if (!me.data.user) { location.href = '/logowanie?next=/konto'; return; }
  const u = me.data.user;
  $('#accountHello').textContent = `Cześć, ${u.name}! Konto od ${new Date(u.created_at).toLocaleDateString('pl-PL')}.`;
  $('#logoutBtn').addEventListener('click', doLogout);

  // Edycja profilu
  const pf = $('#profileForm');
  pf.name.value = u.name || '';
  pf.email.value = u.email || '';
  pf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#profileErr'); err.hidden = true;
    const { ok, data } = await api('/api/auth/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: pf.name.value, email: pf.email.value })
    });
    if (ok) toast('Zapisano dane konta');
    else { err.textContent = data.error || 'Błąd'; err.hidden = false; }
  });

  // Zmiana hasła
  const pwf = $('#passwordForm');
  pwf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#passwordErr'); err.hidden = true;
    const { ok, data } = await api('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: pwf.current.value, newPassword: pwf.newpass.value })
    });
    if (ok) { toast('Hasło zmienione'); pwf.reset(); }
    else { err.textContent = data.error || 'Błąd'; err.hidden = false; }
  });

  const ord = await api('/api/orders/mine');
  const box = $('#orders');
  const list = (ord.data.orders) || [];
  box.innerHTML = list.length
    ? list.map((o) => orderCard(o, false)).join('')
    : '<p class="muted">Nie masz jeszcze zamówień. <a href="/#sklep" style="color:var(--accent)">Zacznij zakupy →</a></p>';
}

/* ====== Panel admina ====== */
async function initAdmin() {
  const me = await api('/api/auth/me');
  if (!me.data.user || me.data.user.role !== 'admin') { location.href = '/logowanie?next=/admin'; return; }
  $('#adminHello').textContent = `Zalogowano jako ${me.data.user.name} (${me.data.user.username || me.data.user.email}).`;
  $('#logoutBtn').addEventListener('click', doLogout);

  // ----- Nawigacja sekcji (boczne menu) -----
  const navLinks = $$('#adminNav a');
  function showSection(sec) {
    navLinks.forEach((a) => a.classList.toggle('active', a.dataset.sec === sec));
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== sec; });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  navLinks.forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); showSection(a.dataset.sec); }));

  // ----- Dane -----
  const [ord, usr, msg] = await Promise.all([
    api('/api/admin/orders'), api('/api/admin/users'), api('/api/admin/messages')
  ]);
  let orders = ord.data.orders || [];
  const users = usr.data.users || [];
  const messages = msg.data.messages || [];
  let products = [];

  // ----- PULPIT -----
  function renderDash() {
    const revenue = orders.filter((o) => o.status !== 'anulowane').reduce((s, o) => s + o.total, 0);
    const newCount = orders.filter((o) => o.status === 'nowe').length;
    const customers = users.filter((u) => u.role === 'customer').length;
    $('#dashStats').innerHTML = `
      <div class="stat-card"><div class="num">${money(revenue)}</div><div class="lbl">Obrót (bez anulowanych)</div></div>
      <div class="stat-card"><div class="num">${orders.length}</div><div class="lbl">Zamówienia</div></div>
      <div class="stat-card"><div class="num">${newCount}</div><div class="lbl">Nowe do obsługi</div></div>
      <div class="stat-card"><div class="num">${customers}</div><div class="lbl">Klienci</div></div>`;

    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      days.push({ key: d.toLocaleDateString('pl-PL'), label: d.toLocaleDateString('pl-PL', { weekday: 'short' }), sum: 0 });
    }
    orders.forEach((o) => {
      const k = new Date(o.createdAt).toLocaleDateString('pl-PL');
      const day = days.find((x) => x.key === k);
      if (day && o.status !== 'anulowane') day.sum += o.total;
    });
    const max = Math.max(1, ...days.map((d) => d.sum));
    $('#dashChart').innerHTML = days.map((d) =>
      `<div class="bar-col"><div class="bar" style="height:${Math.max(2, Math.round(d.sum / max * 100))}%" title="${money(d.sum)}"></div><span>${d.label}</span></div>`).join('');

    $('#dashRecent').innerHTML = orders.length
      ? orders.slice(0, 5).map((o) => `<div class="mini-row"><span class="oid">${esc(o.id)}</span><span>${money(o.total)}</span><span class="${statusClass(o.status)}">${esc(o.status)}</span></div>`).join('')
      : '<p class="muted">Brak zamówień.</p>';

    const low = products.filter((p) => p.stock <= 5).sort((a, b) => a.stock - b.stock);
    $('#dashLowStock').innerHTML = low.length
      ? low.map((p) => `<div class="mini-row"><span>${esc(p.name)}</span><span class="status ${p.stock <= 0 ? 'anulowane' : 'w-realizacji'}">${p.stock} szt.</span></div>`).join('')
      : '<p class="muted">Wszystko dobrze zatowarowane 👍</p>';

    const sales = {};
    orders.forEach((o) => { if (o.status === 'anulowane') return; o.items.forEach((it) => {
      if (!sales[it.id]) sales[it.id] = { name: it.name, qty: 0, sum: 0 };
      sales[it.id].qty += it.qty; sales[it.id].sum += it.lineTotal;
    }); });
    const top = Object.values(sales).sort((a, b) => b.qty - a.qty).slice(0, 5);
    $('#dashTop').innerHTML = top.length
      ? top.map((t, i) => `<div class="mini-row"><span>${i + 1}. ${esc(t.name)}</span><span>${t.qty} szt. · ${money(t.sum)}</span></div>`).join('')
      : '<p class="muted">Brak danych sprzedaży.</p>';
  }

  // ----- ZAMÓWIENIA -----
  function getFilteredOrders() {
    const q = ($('#orderSearch').value || '').trim().toLowerCase();
    const st = $('#orderStatusFilter').value;
    let list = orders.slice();
    if (st) list = list.filter((o) => o.status === st);
    if (q) list = list.filter((o) => o.id.toLowerCase().includes(q) || o.customer.email.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q));
    return list;
  }
  function renderOrders() {
    const list = getFilteredOrders();
    $('#adminOrders').innerHTML = list.length ? list.map((o) => orderCard(o, true)).join('') : '<p class="muted">Brak zamówień dla kryteriów.</p>';
  }
  $('#orderSearch').addEventListener('input', renderOrders);
  $('#orderStatusFilter').addEventListener('change', renderOrders);
  $('#adminOrders').addEventListener('change', async (e) => {
    const sel = e.target;
    if (!sel.dataset.order) return;
    const { ok, data } = await api('/api/admin/order-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sel.dataset.order, status: sel.value })
    });
    if (ok) { const o = orders.find((x) => x.id === sel.dataset.order); if (o) o.status = sel.value; toast(`Status ${sel.dataset.order} → ${sel.value}`); renderDash(); }
    else toast(data.error || 'Błąd zmiany statusu');
  });

  // Eksport CSV (uniwersalny + kurierski)
  const csvCell = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  function downloadCsv(rows, filename) {
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  $('#exportOrders').addEventListener('click', () => {
    const list = getFilteredOrders();
    if (!list.length) { toast('Brak zamówień do eksportu'); return; }
    const rows = [['Nr', 'Data', 'Status', 'Klient', 'E-mail', 'Telefon', 'Adres', 'Produkty', 'Suma (zł)']];
    list.forEach((o) => {
      const items = o.items.map((i) => `${i.name} ${i.size}/${i.color} x${i.qty}`).join('; ');
      rows.push([o.id, new Date(o.createdAt).toLocaleString('pl-PL'), o.status, o.customer.name,
        o.customer.email, o.customer.phone || '', o.customer.address, items, o.total.toFixed(2)]);
    });
    downloadCsv(rows, 'zamowienia-vibe.csv');
    toast('Wyeksportowano CSV');
  });
  // Eksport kurierski — kolumny gotowe do mapowania w narzedziach kurierow (InPost/DPD/DHL)
  $('#exportCourier').addEventListener('click', () => {
    const list = getFilteredOrders();
    if (!list.length) { toast('Brak zamówień do eksportu'); return; }
    const rows = [['Imię i nazwisko', 'Telefon', 'E-mail', 'Ulica i nr', 'Kod pocztowy', 'Miasto', 'Kraj', 'Adres (pełny)', 'Nr zamówienia', 'Kwota pobrania (zł)', 'Waga (kg)', 'Uwagi']];
    list.forEach((o) => {
      const c = o.customer;
      rows.push([c.name, c.phone || '', c.email, c.street || '', c.postalCode || '', c.city || '', 'PL',
        c.address, o.id, o.total.toFixed(2), '', o.note || '']);
    });
    downloadCsv(rows, 'kurier-vibe.csv');
    toast('Wyeksportowano plik kurierski');
  });

  // Notatka do zamówienia + druk
  function printOrder(o) {
    const items = o.items.map((i) => `<tr><td>${esc(i.name)} (${esc(i.size)}/${esc(i.color)})</td><td>${i.qty}</td><td>${money(i.lineTotal)}</td></tr>`).join('');
    const w = window.open('', '_blank');
    if (!w) { toast('Pozwól na wyskakujące okna, by drukować'); return; }
    w.document.write(`<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><title>${esc(o.id)}</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;color:#16181d}h1{margin:0}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.r{text-align:right}.tot{font-size:1.2rem;font-weight:700}</style></head><body>
      <h1>VIBE — zamówienie ${esc(o.id)}</h1>
      <p>${esc(new Date(o.createdAt).toLocaleString('pl-PL'))} · status: ${esc(o.status)}</p>
      <p><strong>${esc(o.customer.name)}</strong><br>${esc(o.customer.email)} · ${esc(o.customer.phone || '')}<br>${esc(o.customer.address)}</p>
      <table><thead><tr><th>Produkt</th><th>Ilość</th><th>Kwota</th></tr></thead><tbody>${items}</tbody></table>
      <p>Dostawa: ${o.shipping ? money(o.shipping) : 'gratis'}${o.discount ? ` · Rabat ${esc(o.discountCode || '')}: -${money(o.discount)}` : ''}</p>
      <p class="tot">Razem: ${money(o.total)}</p>
      ${o.note ? `<p><em>Notatka: ${esc(o.note)}</em></p>` : ''}
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  }
  $('#adminOrders').addEventListener('click', async (e) => {
    const saveId = e.target.dataset.savenote;
    const printId = e.target.dataset.print;
    if (saveId) {
      const ta = document.querySelector(`textarea[data-note="${saveId}"]`);
      const { ok, data } = await api('/api/admin/order-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: saveId, note: ta.value })
      });
      if (ok) { const o = orders.find((x) => x.id === saveId); if (o) o.note = ta.value; toast('Zapisano notatkę'); }
      else toast(data.error || 'Błąd');
    }
    if (printId) { const o = orders.find((x) => x.id === printId); if (o) printOrder(o); }
  });

  // ----- KLIENCI / UŻYTKOWNICY -----
  const adminId = me.data.user.id;
  function renderCustomers() {
    const q = ($('#customerSearch').value || '').trim().toLowerCase();
    const stat = {};
    orders.forEach((o) => {
      const key = o.userId || ('e:' + o.customer.email);
      if (!stat[key]) stat[key] = { count: 0, sum: 0 };
      stat[key].count++; if (o.status !== 'anulowane') stat[key].sum += o.total;
    });
    let list = users.slice();
    if (q) list = list.filter((x) => (x.name || '').toLowerCase().includes(q) || (x.email || x.username || '').toLowerCase().includes(q));
    $('#adminCustomers').innerHTML = list.length ? `
      <table class="admin-table">
        <thead><tr><th>Imię</th><th>E-mail / login</th><th>Zamówienia</th><th>Wydane</th><th>Rola</th><th></th></tr></thead>
        <tbody>${list.map((x) => { const s = stat[x.id] || { count: 0, sum: 0 }; const self = x.id === adminId; return `<tr data-id="${x.id}">
          <td>${esc(x.name)}${self ? ' <span class="muted">(Ty)</span>' : ''}</td>
          <td>${esc(x.email || x.username || '—')}</td>
          <td>${s.count}</td><td>${money(s.sum)}</td>
          <td><select class="mini-input urole" ${self ? 'disabled' : ''}>
            <option value="customer" ${x.role === 'customer' ? 'selected' : ''}>klient</option>
            <option value="admin" ${x.role === 'admin' ? 'selected' : ''}>admin</option>
          </select></td>
          <td><div class="prod-actions"><button class="pw" type="button">Hasło</button><button class="del" type="button" ${self ? 'disabled' : ''}>Usuń</button></div></td>
        </tr>`; }).join('')}</tbody>
      </table>` : '<p class="muted">Brak użytkowników.</p>';
  }
  $('#customerSearch').addEventListener('input', renderCustomers);
  $('#adminCustomers').addEventListener('change', async (e) => {
    if (!e.target.classList.contains('urole')) return;
    const id = parseInt(e.target.closest('tr').dataset.id, 10);
    const { ok, data } = await api('/api/admin/users/role', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, role: e.target.value })
    });
    if (ok) { const us = users.find((u2) => u2.id === id); if (us) us.role = e.target.value; toast('Zmieniono rolę'); renderDash(); }
    else { toast(data.error || 'Błąd'); renderCustomers(); }
  });
  $('#adminCustomers').addEventListener('click', async (e) => {
    if (e.target.classList.contains('pw')) {
      const id = parseInt(e.target.closest('tr').dataset.id, 10);
      const us = users.find((u2) => u2.id === id);
      const pw = prompt(`Nowe hasło dla „${us ? us.name : id}" (min. 8 znaków):`);
      if (pw == null) return;
      if (pw.length < 8) { toast('Hasło musi mieć min. 8 znaków'); return; }
      const { ok, data } = await api('/api/admin/users/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, password: pw })
      });
      toast(ok ? 'Ustawiono nowe hasło' : (data.error || 'Błąd'));
      return;
    }
    if (!e.target.classList.contains('del')) return;
    const id = parseInt(e.target.closest('tr').dataset.id, 10);
    const us = users.find((u2) => u2.id === id);
    if (!confirm(`Usunąć konto „${us ? us.name : id}"? Tej operacji nie można cofnąć.`)) return;
    const { ok, data } = await api('/api/admin/users/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
    });
    if (ok) { const i = users.findIndex((u2) => u2.id === id); if (i >= 0) users.splice(i, 1); toast('Usunięto konto'); renderCustomers(); renderDash(); }
    else toast(data.error || 'Błąd');
  });

  // ----- WIADOMOŚCI -----
  function renderMessages() {
    $('#adminMessages').innerHTML = messages.length ? messages.map((m) => `
      <div class="order-card" data-ts="${esc(m.createdAt)}">
        <div class="order-top">
          <strong>${esc(m.name)}</strong>
          <span><span class="muted">${esc(new Date(m.createdAt).toLocaleString('pl-PL'))}</span>
          <button class="msg-del prod-actions" type="button" title="Usuń" style="margin-left:10px;border:none;background:none;color:var(--danger);cursor:pointer">✕</button></span>
        </div>
        <div class="muted" style="font-size:.85rem;margin-bottom:6px"><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></div>
        <div class="order-items">${esc(m.message)}</div>
      </div>`).join('') : '<p class="muted">Brak wiadomości.</p>';
  }
  $('#adminMessages').addEventListener('click', async (e) => {
    if (!e.target.classList.contains('msg-del')) return;
    const ts = e.target.closest('[data-ts]').dataset.ts;
    if (!confirm('Usunąć tę wiadomość?')) return;
    const { ok, data } = await api('/api/admin/messages/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ createdAt: ts })
    });
    if (ok) { const i = messages.findIndex((m) => m.createdAt === ts); if (i >= 0) messages.splice(i, 1); toast('Usunięto wiadomość'); renderMessages(); }
    else toast(data.error || 'Błąd');
  });

  // ----- PRODUKTY (CRUD) -----
  const pForm = $('#productForm');
  async function loadAdminProducts() {
    const r = await api('/api/products');
    products = Array.isArray(r.data) ? r.data : [];
    $('#adminProducts').innerHTML = products.length ? `
      <table class="admin-table">
        <thead><tr><th>Nazwa</th><th>Kat.</th><th>Cena</th><th>Stan</th><th>Bestseller</th><th></th></tr></thead>
        <tbody>${products.map((p) => `<tr data-id="${esc(p.id)}">
          <td>${esc(p.name)}</td>
          <td>${esc(p.category)}</td>
          <td>${money(p.price)}</td>
          <td>${p.stock <= 0 ? '<strong style="color:#e23b4e">0</strong>' : (p.stock <= 5 ? `<strong style="color:#c2410c">${p.stock}</strong>` : p.stock)}</td>
          <td>${p.featured ? '★' : '—'}</td>
          <td><div class="prod-actions"><button class="edit" type="button">Edytuj</button><button class="del" type="button">Usuń</button></div></td>
        </tr>`).join('')}</tbody>
      </table>` : '<p class="muted">Brak produktów.</p>';
    renderDash();
  }
  function resetProductForm() {
    pForm.reset(); pForm.editId.value = '';
    pForm.color.value = '#1f2933'; pForm.accent.value = '#7c5cff';
    $('#prodFormTitle').textContent = 'Dodaj produkt';
    $('#prodSubmit').textContent = 'Dodaj produkt';
    $('#prodCancel').hidden = true; $('#prodError').hidden = true;
    setPreview(null); $('#imgFile').value = '';
    $('#variantsPanel').hidden = true; editingProduct = null;
  }

  // ----- Edytor wariantów (stan per rozmiar/kolor) -----
  let editingProduct = null;
  function renderVariantsEditor(p) {
    editingProduct = p;
    const v = p.variants || {};
    $('#variantsBox').innerHTML = `
      <table class="admin-table" style="margin-top:8px">
        <thead><tr><th>Rozmiar \\ Kolor</th>${p.colors.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${p.sizes.map((s) => `<tr><td><strong>${esc(s)}</strong></td>${p.colors.map((c) => {
          const k = `${s}||${c}`;
          return `<td><input type="number" min="0" step="1" class="mini-input" style="width:80px" data-vk="${esc(k)}" value="${v[k] != null ? v[k] : ''}" placeholder="—" /></td>`;
        }).join('')}</tr>`).join('')}</tbody>
      </table>`;
    $('#variantsPanel').hidden = false;
  }
  async function saveVariants(variantsOrNull) {
    if (!editingProduct) return;
    const { ok, data } = await api('/api/admin/products/variants', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingProduct.id, variants: variantsOrNull })
    });
    toast(ok ? 'Zapisano stany wariantów' : (data.error || 'Błąd'));
    if (ok) loadAdminProducts();
  }
  $('#saveVariants').addEventListener('click', () => {
    const variants = {};
    $$('#variantsBox input[data-vk]').forEach((inp) => {
      const val = inp.value.trim();
      if (val !== '') { const n = parseInt(val, 10); if (Number.isFinite(n) && n >= 0) variants[inp.dataset.vk] = n; }
    });
    saveVariants(Object.keys(variants).length ? variants : null);
  });
  $('#clearVariants').addEventListener('click', () => { if (confirm('Wyłączyć warianty i używać ogólnego stanu?')) saveVariants(null); });
  $('#prodCancel').addEventListener('click', resetProductForm);
  $('#adminProducts').addEventListener('click', async (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const p = products.find((x) => x.id === tr.dataset.id);
    if (!p) return;
    if (e.target.classList.contains('edit')) {
      pForm.editId.value = p.id;
      pForm.name.value = p.name; pForm.category.value = p.category; pForm.price.value = p.price;
      pForm.stock.value = p.stock; pForm.featured.value = p.featured ? '1' : '0';
      pForm.colors.value = p.colors.join(', '); pForm.sizes.value = p.sizes.join(', ');
      pForm.color.value = p.color; pForm.accent.value = p.accent; pForm.description.value = p.description;
      $('#prodFormTitle').textContent = 'Edytuj: ' + p.name;
      $('#prodSubmit').textContent = 'Zapisz zmiany';
      $('#prodCancel').hidden = false; $('#prodError').hidden = true;
      setPreview(p.image ? p.image + '?t=' + Date.now() : null);
      renderVariantsEditor(p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (e.target.classList.contains('del')) {
      if (!confirm(`Usunąć produkt "${p.name}"?`)) return;
      const { ok, data } = await api('/api/admin/products/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id })
      });
      toast(ok ? 'Usunięto produkt' : (data.error || 'Błąd'));
      if (ok) loadAdminProducts();
    }
  });
  pForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#prodError'); err.hidden = true;
    const editId = pForm.editId.value;
    const payload = {
      id: editId || undefined,
      name: pForm.name.value, category: pForm.category.value, price: pForm.price.value,
      stock: pForm.stock.value, colors: pForm.colors.value, sizes: pForm.sizes.value, color: pForm.color.value,
      accent: pForm.accent.value, description: pForm.description.value, featured: pForm.featured.value === '1'
    };
    const { ok, data } = await api(editId ? '/api/admin/products/update' : '/api/admin/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (ok) { toast(editId ? 'Zapisano zmiany' : 'Dodano produkt'); resetProductForm(); loadAdminProducts(); }
    else { err.textContent = data.error || 'Błąd zapisu'; err.hidden = false; }
  });

  // ----- Zdjecie produktu -----
  const imgFile = $('#imgFile'), imgRemove = $('#imgRemove');
  function setPreview(src) {
    $('#imgPreview').innerHTML = src ? `<img src="${src}" alt="">` : '<div class="ph">Brak zdjęcia</div>';
    imgRemove.hidden = !src;
  }
  imgFile.addEventListener('change', async () => {
    const id = pForm.editId.value;
    if (!id) { toast('Najpierw zapisz produkt, potem dodaj zdjęcie (Edytuj).'); imgFile.value = ''; return; }
    const f = imgFile.files[0]; if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast('Zdjęcie za duże (max 4 MB).'); imgFile.value = ''; return; }
    const dataUrl = await new Promise((resv) => { const r = new FileReader(); r.onload = () => resv(r.result); r.readAsDataURL(f); });
    const { ok, data } = await api('/api/admin/products/image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, image: dataUrl })
    });
    if (ok) { setPreview(data.image + '?t=' + Date.now()); toast('Dodano zdjęcie'); loadAdminProducts(); }
    else toast(data.error || 'Błąd zdjęcia');
    imgFile.value = '';
  });
  imgRemove.addEventListener('click', async () => {
    const id = pForm.editId.value; if (!id) return;
    const { ok } = await api('/api/admin/products/image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, remove: true })
    });
    if (ok) { setPreview(null); toast('Usunięto zdjęcie'); loadAdminProducts(); }
  });

  // ----- KODY RABATOWE -----
  async function loadDiscounts() {
    const r = await api('/api/admin/discounts');
    const list = (r.data.discounts) || [];
    $('#adminDiscounts').innerHTML = list.length ? `
      <table class="admin-table">
        <thead><tr><th>Kod</th><th>Rabat</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map((d) => `<tr data-code="${esc(d.code)}">
          <td><strong>${esc(d.code)}</strong></td>
          <td>${d.type === 'percent' ? d.value + '%' : money(d.value)}</td>
          <td><span class="discount-badge ${d.active ? 'on' : 'off'}">${d.active ? 'aktywny' : 'wyłączony'}</span></td>
          <td><div class="prod-actions"><button class="toggle" type="button">${d.active ? 'Wyłącz' : 'Włącz'}</button><button class="del" type="button">Usuń</button></div></td>
        </tr>`).join('')}</tbody>
      </table>` : '<p class="muted">Brak kodów.</p>';
  }
  $('#discountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target; const err = $('#discountErr'); err.hidden = true;
    const { ok, data } = await api('/api/admin/discounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: f.code.value, type: f.type.value, value: f.value.value })
    });
    if (ok) { toast('Dodano kod'); f.reset(); loadDiscounts(); }
    else { err.textContent = data.error || 'Błąd'; err.hidden = false; }
  });
  $('#adminDiscounts').addEventListener('click', async (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const code = tr.dataset.code;
    if (e.target.classList.contains('toggle')) {
      const { ok } = await api('/api/admin/discounts/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      if (ok) loadDiscounts();
    }
    if (e.target.classList.contains('del')) {
      if (!confirm(`Usunąć kod ${code}?`)) return;
      const { ok } = await api('/api/admin/discounts/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      if (ok) { toast('Usunięto kod'); loadDiscounts(); }
    }
  });

  // ----- USTAWIENIA -----
  async function loadSettings() {
    const r = await api('/api/admin/settings');
    const s = (r.data.settings) || {};
    const f = $('#settingsForm');
    ['free_shipping_threshold', 'shipping_cost', 'announce_text', 'contact_email', 'contact_phone'].forEach((k) => {
      if (f[k] != null && s[k] != null) f[k].value = s[k];
    });
  }
  $('#settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target; const err = $('#settingsErr'); err.hidden = true;
    const payload = {
      free_shipping_threshold: f.free_shipping_threshold.value, shipping_cost: f.shipping_cost.value,
      announce_text: f.announce_text.value, contact_email: f.contact_email.value, contact_phone: f.contact_phone.value
    };
    const { ok, data } = await api('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (ok) toast('Zapisano ustawienia');
    else { err.textContent = data.error || 'Błąd'; err.hidden = false; }
  });

  // ----- MODERACJA OPINII -----
  async function loadAdminReviews() {
    const r = await api('/api/admin/reviews');
    const list = (r.data.reviews) || [];
    $('#adminReviews').innerHTML = list.length ? list.map((rv) => `
      <div class="review" data-pid="${esc(rv.productId)}" data-uid="${rv.userId}">
        <div class="review-top"><strong>${esc(rv.name)}</strong>
          <span class="stars" style="color:#f5a623">${'★'.repeat(rv.rating)}${'☆'.repeat(5 - rv.rating)}</span>
          <span class="muted" style="margin-left:auto;font-size:.8rem">${esc(rv.productName)} · ${new Date(rv.createdAt).toLocaleDateString('pl-PL')}</span></div>
        ${rv.comment ? `<p>${esc(rv.comment)}</p>` : ''}
        <button class="btn btn-ghost rev-del" type="button" style="padding:5px 12px;margin-top:8px">Usuń opinię</button>
      </div>`).join('') : '<p class="muted">Brak opinii.</p>';
  }
  $('#adminReviews').addEventListener('click', async (e) => {
    if (!e.target.classList.contains('rev-del')) return;
    const card = e.target.closest('[data-pid]');
    if (!confirm('Usunąć tę opinię?')) return;
    const { ok, data } = await api('/api/admin/reviews/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: card.dataset.pid, userId: parseInt(card.dataset.uid, 10) })
    });
    toast(ok ? 'Usunięto opinię' : (data.error || 'Błąd'));
    if (ok) loadAdminReviews();
  });

  // ----- Start -----
  renderOrders();
  renderCustomers();
  renderMessages();
  loadDiscounts();
  loadSettings();
  loadAdminReviews();
  await loadAdminProducts(); // ustawia products i wywoluje renderDash()
}

/* ====== Start ====== */
const page = document.body.dataset.page;
if (page === 'auth') initAuth();
else if (page === 'konto') initKonto();
else if (page === 'admin') initAdmin();
