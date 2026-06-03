'use strict';

/* Obsluga stron: logowanie/rejestracja, panel klienta, panel admina */

const $ = (s, r = document) => r.querySelector(s);
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
    ${admin ? `<div class="muted" style="font-size:.85rem;margin-bottom:8px">${esc(o.customer.name)} · ${esc(o.customer.email)} · ${esc(o.customer.address)}</div>` : ''}
    <div class="order-items">${items}</div>
    <div class="order-foot">
      <strong>${money(o.total)}</strong>
      ${statusCtrl}
    </div>
  </div>`;
}

/* ====== Panel klienta ====== */
async function initKonto() {
  const me = await api('/api/auth/me');
  if (!me.data.user) { location.href = '/logowanie?next=/konto'; return; }
  const u = me.data.user;
  $('#accountHello').textContent = `Cześć, ${u.name}! 👋`;
  $('#profile').innerHTML = `
    <div class="profile-row"><span>Imię i nazwisko</span><strong>${esc(u.name)}</strong></div>
    <div class="profile-row"><span>E-mail</span><strong>${esc(u.email || '—')}</strong></div>
    <div class="profile-row"><span>Konto od</span><strong>${esc(new Date(u.created_at).toLocaleDateString('pl-PL'))}</strong></div>`;
  $('#logoutBtn').addEventListener('click', doLogout);

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
  }

  // ----- ZAMÓWIENIA -----
  function renderOrders() {
    const q = ($('#orderSearch').value || '').trim().toLowerCase();
    const st = $('#orderStatusFilter').value;
    let list = orders.slice();
    if (st) list = list.filter((o) => o.status === st);
    if (q) list = list.filter((o) => o.id.toLowerCase().includes(q) || o.customer.email.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q));
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

  // ----- KLIENCI -----
  function renderCustomers() {
    const q = ($('#customerSearch').value || '').trim().toLowerCase();
    const stat = {};
    orders.forEach((o) => {
      const key = o.userId || ('e:' + o.customer.email);
      if (!stat[key]) stat[key] = { count: 0, sum: 0 };
      stat[key].count++; if (o.status !== 'anulowane') stat[key].sum += o.total;
    });
    let list = users.filter((u) => u.role === 'customer');
    if (q) list = list.filter((u) => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    $('#adminCustomers').innerHTML = list.length ? `
      <table class="admin-table">
        <thead><tr><th>Imię</th><th>E-mail</th><th>Zamówienia</th><th>Wydane</th><th>Od</th></tr></thead>
        <tbody>${list.map((u) => { const s = stat[u.id] || { count: 0, sum: 0 }; return `<tr>
          <td>${esc(u.name)}</td><td>${esc(u.email || '—')}</td>
          <td>${s.count}</td><td>${money(s.sum)}</td>
          <td>${esc(new Date(u.created_at).toLocaleDateString('pl-PL'))}</td></tr>`; }).join('')}</tbody>
      </table>` : '<p class="muted">Brak klientów.</p>';
  }
  $('#customerSearch').addEventListener('input', renderCustomers);

  // ----- WIADOMOŚCI -----
  function renderMessages() {
    $('#adminMessages').innerHTML = messages.length ? messages.map((m) => `
      <div class="order-card">
        <div class="order-top"><strong>${esc(m.name)}</strong><span class="muted">${esc(new Date(m.createdAt).toLocaleString('pl-PL'))}</span></div>
        <div class="muted" style="font-size:.85rem;margin-bottom:6px"><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></div>
        <div class="order-items">${esc(m.message)}</div>
      </div>`).join('') : '<p class="muted">Brak wiadomości.</p>';
  }

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
  }
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

  // ----- Start -----
  renderOrders();
  renderCustomers();
  renderMessages();
  await loadAdminProducts(); // ustawia products i wywoluje renderDash()
}

/* ====== Start ====== */
const page = document.body.dataset.page;
if (page === 'auth') initAuth();
else if (page === 'konto') initKonto();
else if (page === 'admin') initAdmin();
