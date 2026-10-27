import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- Constants ----------
const CATEGORIES = [
  'Fruit & veg', 'Bread & bakery', 'Dairy & eggs', 'Meat & fish', 'Pantry',
  'Frozen', 'Drinks', 'Snacks', 'Household', 'Personal care', 'Other',
];

// Simple keyword guesses (English + Norwegian) so the category picks itself
const GUESS = {
  'Fruit & veg': ['apple', 'banana', 'tomato', 'potato', 'onion', 'garlic', 'lemon', 'lime', 'avocado', 'salad', 'lettuce', 'spinach', 'carrot', 'cucumber', 'pepper', 'berries', 'fruit', 'herbs', 'eple', 'banan', 'tomat', 'potet', 'løk', 'hvitløk', 'sitron', 'salat', 'spinat', 'gulrot', 'agurk', 'paprika', 'bær', 'frukt', 'urter', 'brokkoli', 'broccoli'],
  'Bread & bakery': ['bread', 'bun', 'baguette', 'croissant', 'tortilla', 'brød', 'rundstykke', 'boller', 'lefse', 'knekkebrød'],
  'Dairy & eggs': ['milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'egg', 'eggs', 'melk', 'ost', 'smør', 'fløte', 'rømme', 'skyr', 'kesam', 'cottage'],
  'Meat & fish': ['chicken', 'beef', 'pork', 'mince', 'bacon', 'ham', 'salmon', 'fish', 'shrimp', 'kylling', 'kjøttdeig', 'svin', 'skinke', 'laks', 'fisk', 'reker', 'torsk', 'pølse', 'sausage'],
  'Pantry': ['pasta', 'rice', 'flour', 'sugar', 'oil', 'salt', 'spice', 'sauce', 'beans', 'lentils', 'oats', 'cereal', 'coffee', 'tea', 'honey', 'ris', 'mel', 'sukker', 'olje', 'krydder', 'saus', 'bønner', 'linser', 'havregryn', 'kaffe', 'te', 'honning', 'tacokrydder'],
  'Frozen': ['frozen', 'ice cream', 'frossen', 'frosne', 'is', 'pizza'],
  'Drinks': ['juice', 'soda', 'water', 'beer', 'wine', 'brus', 'vann', 'øl', 'vin', 'cola', 'sparkling'],
  'Snacks': ['chips', 'chocolate', 'candy', 'nuts', 'cookies', 'sjokolade', 'godteri', 'nøtter', 'kjeks', 'popcorn'],
  'Household': ['toilet paper', 'paper towel', 'detergent', 'dish', 'soap', 'trash bag', 'bin bag', 'sponge', 'battery', 'bulb', 'dopapir', 'tørkepapir', 'vaskemiddel', 'oppvask', 'søppelpose', 'svamp', 'batteri', 'lyspære', 'zalo', 'klut'],
  'Personal care': ['shampoo', 'conditioner', 'toothpaste', 'toothbrush', 'deodorant', 'razor', 'lotion', 'tannkrem', 'tannbørste', 'balsam', 'såpe'],
};

const ICON = `<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#2f5d50"/><path d="M256 118 112 238v20h34v136h220V258h34v-20z" fill="#f6f4ef"/><rect x="226" y="300" width="60" height="94" rx="8" fill="#2f5d50"/></svg>`;
const TICK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Sections of the app. Add new ones here as we build them.
const SECTIONS = [{ id: 'shopping', label: 'Shopping' }];

// ---------- State ----------
const state = {
  session: null,
  screen: null,
  profiles: {},
  lists: [],
  items: [],
  currentListId: store('currentListId'),
  channel: null,
};

const app = document.getElementById('app');
const $ = (id) => document.getElementById(id);
const uid = () => state.session?.user?.id;

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { return null; }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function who(userId) {
  if (!userId) return 'someone';
  if (userId === uid()) return 'you';
  return state.profiles[userId]?.display_name || 'someone';
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// Small text-input dialog. Resolves to the text, or null if cancelled.
function ask(title, value = '', okLabel = 'Save') {
  const dlg = $('dlg');
  const input = $('dlg-input');
  $('dlg-title').textContent = title;
  $('dlg-ok').textContent = okLabel;
  input.value = value;
  dlg.returnValue = '';
  dlg.showModal();
  input.focus();
  input.select();
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => {
      const v = input.value.trim();
      resolve(dlg.returnValue === 'ok' && v ? v : null);
    }, { once: true });
  });
}

// ---------- Startup & routing ----------
async function init() {
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  sb.auth.onAuthStateChange((_event, session) => {
    const before = uid();
    state.session = session;
    // Don't call Supabase inside this callback directly (can deadlock) – defer.
    if (session?.user?.id !== before) setTimeout(route, 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.screen === 'main') refresh();
  });
  route();
}

async function route() {
  if (!state.session) {
    unsubscribe();
    return renderLogin();
  }
  state.screen = 'loading';
  app.innerHTML = '<div class="center muted">Loading…</div>';
  const ok = await loadAll();
  if (!ok) {
    app.innerHTML = `<div class="center"><div style="text-align:center">
      <p>Couldn't load your data.</p>
      <button class="btn" id="retry">Try again</button>
      <button class="link" id="out">Sign out</button></div></div>`;
    $('retry').onclick = route;
    $('out').onclick = () => sb.auth.signOut();
    return;
  }
  if (!state.profiles[uid()]) return renderNameSetup();
  renderMain();
  subscribe();
}

// ---------- Data ----------
async function loadAll() {
  const [p, l, i] = await Promise.all([
    sb.from('profiles').select('*'),
    sb.from('lists').select('*').order('position').order('created_at'),
    sb.from('items').select('*').order('created_at'),
  ]);
  const err = p.error || l.error || i.error;
  if (err) {
    console.error(err);
    toast(err.message);
    return false;
  }
  state.profiles = Object.fromEntries(p.data.map((x) => [x.id, x]));
  state.lists = l.data;
  state.items = i.data;
  if (!state.lists.some((x) => x.id === state.currentListId)) {
    setCurrent(state.lists[0]?.id ?? null);
  }
  return true;
}

function setCurrent(id) {
  state.currentListId = id;
  if (id) store('currentListId', id);
}

const currentList = () => state.lists.find((l) => l.id === state.currentListId);

let refreshTimer;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 150);
}

async function refresh() {
  if (state.screen !== 'main') return;
  if (await loadAll()) renderShopping();
}

function subscribe() {
  if (state.channel) return;
  state.channel = sb.channel('household')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleRefresh)
    .subscribe();
}

function unsubscribe() {
  if (state.channel) sb.removeChannel(state.channel);
  state.channel = null;
}

// ---------- Screens ----------
function renderLogin() {
  state.screen = 'login';
  app.innerHTML = `
    <main class="auth"><div class="card">
      <div class="logo">${ICON}</div>
      <h1>Home</h1>
      <p class="muted">Sign in to your shared apartment app.</p>
      <form id="login">
        <label>Email <input type="email" name="email" autocomplete="email" required></label>
        <label>Password <input type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit">Sign in</button>
        <p class="error" id="err"></p>
      </form>
    </div></main>`;
  $('login').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    $('err').textContent = '';
    const { error } = await sb.auth.signInWithPassword({
      email: String(f.get('email')).trim(),
      password: String(f.get('password')),
    });
    btn.disabled = false;
    if (error) $('err').textContent = error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message;
  };
}

function renderNameSetup() {
  state.screen = 'name';
  app.innerHTML = `
    <main class="auth"><div class="card">
      <div class="logo">${ICON}</div>
      <h1>Welcome!</h1>
      <p class="muted">What should we call you? This shows next to things you add.</p>
      <form id="nameform">
        <label>Your name <input name="name" maxlength="30" required autocomplete="given-name"></label>
        <button class="btn primary" type="submit">Continue</button>
        <p class="error" id="err"></p>
      </form>
    </div></main>`;
  $('nameform').onsubmit = async (e) => {
    e.preventDefault();
    const name = String(new FormData(e.target).get('name')).trim();
    if (!name) return;
    const { error } = await sb.from('profiles').upsert({ id: uid(), display_name: name });
    if (error) return ($('err').textContent = error.message);
    route();
  };
}

function renderMain() {
  state.screen = 'main';
  const me = state.profiles[uid()];
  app.innerHTML = `
    <header class="top">
      <div class="brand">${ICON}<span>Home</span></div>
      <nav class="sections">
        ${SECTIONS.map((s, i) => `<button class="${i === 0 ? 'active' : ''}">${esc(s.label)}</button>`).join('')}
      </nav>
      <div class="me">${esc(me?.display_name)} · <button class="link" id="signout">Sign out</button></div>
    </header>
    <main class="wrap">
      <div class="chips" id="chips"></div>
      <div id="listhead"></div>
      <form id="add" class="add" autocomplete="off">
        <input name="name" placeholder="Add an item…" required maxlength="80" aria-label="Item">
        <input name="qty" placeholder="Qty" maxlength="20" aria-label="Quantity">
        <select name="cat" aria-label="Category">
          ${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('')}
        </select>
        <button class="btn primary" type="submit">Add</button>
      </form>
      <div id="items"></div>
    </main>`;

  $('signout').onclick = () => sb.auth.signOut();
  setupAddForm();
  $('chips').onclick = onChipClick;
  $('listhead').onclick = onListHeadClick;
  $('items').onclick = onItemsClick;
  renderShopping();
}

// ---------- Shopping section ----------
function renderShopping() {
  renderChips();
  renderListHead();
  renderItems();
  $('add').style.display = currentList() ? '' : 'none';
}

function renderChips() {
  $('chips').innerHTML = state.lists.map((l) => {
    const open = state.items.filter((i) => i.list_id === l.id && !i.checked).length;
    return `<button class="chip ${l.id === state.currentListId ? 'active' : ''}" data-id="${l.id}">
      ${l.emoji ? `<span>${esc(l.emoji)}</span>` : ''}${esc(l.name)}${open ? ` <span class="n">${open}</span>` : ''}
    </button>`;
  }).join('') + `<button class="chip newlist" data-act="new">+ New list</button>`;
}

function renderListHead() {
  const l = currentList();
  $('listhead').innerHTML = l ? `
    <div class="listhead">
      <h1>${l.emoji ? esc(l.emoji) + ' ' : ''}${esc(l.name)}</h1>
      <button class="link" data-act="rename">Rename</button>
      <button class="link" data-act="delete">Delete</button>
    </div>` : '';
}

function renderItems() {
  const box = $('items');
  const l = currentList();
  if (!l) {
    box.innerHTML = `<div class="empty">No lists yet.<br><br><button class="btn primary" data-act="new">Create a list</button></div>`;
    return;
  }
  const items = state.items.filter((i) => i.list_id === l.id);
  const open = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked)
    .sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));

  const groups = {};
  for (const it of open) (groups[it.category] ||= []).push(it);
  const order = (c) => { const i = CATEGORIES.indexOf(c); return i === -1 ? 999 : i; };
  const cats = Object.keys(groups).sort((a, b) => order(a) - order(b) || a.localeCompare(b));

  let html = cats.map((c) => `
    <section class="group">
      <h3>${esc(c)} <span>· ${groups[c].length}</span></h3>
      <ul class="items">${groups[c].map(row).join('')}</ul>
    </section>`).join('');

  if (!open.length) {
    html += `<div class="empty">${done.length ? 'All done! 🎉' : 'Nothing on this list yet. Add something above.'}</div>`;
  }
  if (done.length) {
    html += `
      <div class="done-head">
        <h3>In the cart · ${done.length}</h3>
        <button class="link" data-act="clear">Clear checked</button>
      </div>
      <ul class="items">${done.map(row).join('')}</ul>`;
  }
  box.innerHTML = html;
}

function row(i) {
  const meta = i.checked ? `Checked by ${who(i.checked_by)}` : `Added by ${who(i.added_by)}`;
  return `
    <li class="item ${i.checked ? 'checked' : ''}" data-id="${i.id}">
      <button class="check" data-act="toggle" aria-label="${i.checked ? 'Uncheck' : 'Check'} ${esc(i.name)}">${TICK}</button>
      <div class="body" data-act="toggle">
        <div class="name">${esc(i.name)}${i.quantity ? `<span class="qty">${esc(i.quantity)}</span>` : ''}</div>
        <div class="meta">${esc(meta)}</div>
      </div>
      <button class="del" data-act="del" aria-label="Remove ${esc(i.name)}">×</button>
    </li>`;
}

function guessCategory(text) {
  const t = text.toLowerCase();
  if (!t) return null;
  // Pick the longest matching keyword, so "ice cream" beats "cream"
  let best = null;
  let bestLen = 0;
  for (const [cat, words] of Object.entries(GUESS)) {
    for (const w of words) {
      const hit = t === w || t.startsWith(w + ' ') || (w.length > 3 && t.includes(w));
      if (hit && w.length > bestLen) { best = cat; bestLen = w.length; }
    }
  }
  return best;
}

function setupAddForm() {
  const form = $('add');
  const nameInput = form.elements.name;
  const select = form.elements.cat;
  let manualCategory = false;
  select.value = store('lastCategory') || 'Other';

  select.onchange = () => { manualCategory = true; };
  nameInput.oninput = () => {
    if (manualCategory) return;
    const g = guessCategory(nameInput.value.trim());
    if (g) select.value = g;
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const l = currentList();
    const name = nameInput.value.trim();
    if (!l || !name) return;
    const row = {
      list_id: l.id,
      name,
      quantity: form.elements.qty.value.trim() || null,
      category: select.value,
      added_by: uid(),
    };
    store('lastCategory', select.value);
    nameInput.value = '';
    form.elements.qty.value = '';
    manualCategory = false;
    nameInput.focus();
    const { data, error } = await sb.from('items').insert(row).select().single();
    if (error) return toast(error.message);
    if (!state.items.some((x) => x.id === data.id)) state.items.push(data);
    renderShopping();
  };
}

async function onChipClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.act === 'new') return newList();
  setCurrent(btn.dataset.id);
  renderShopping();
}

async function newList() {
  const name = await ask('New list', '', 'Create');
  if (!name) return;
  const position = Math.max(-1, ...state.lists.map((l) => l.position)) + 1;
  const { data, error } = await sb.from('lists').insert({ name, position, created_by: uid() }).select().single();
  if (error) return toast(error.message);
  if (!state.lists.some((x) => x.id === data.id)) state.lists.push(data);
  setCurrent(data.id);
  renderShopping();
}

async function onListHeadClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const l = currentList();
  if (!l) return;
  if (act === 'rename') {
    const name = await ask('Rename list', l.name);
    if (!name || name === l.name) return;
    l.name = name;
    renderShopping();
    const { error } = await sb.from('lists').update({ name }).eq('id', l.id);
    if (error) { toast(error.message); refresh(); }
  }
  if (act === 'delete') {
    if (!confirm(`Delete the list "${l.name}" and everything on it?`)) return;
    const { error } = await sb.from('lists').delete().eq('id', l.id);
    if (error) return toast(error.message);
    state.lists = state.lists.filter((x) => x.id !== l.id);
    state.items = state.items.filter((x) => x.list_id !== l.id);
    setCurrent(state.lists[0]?.id ?? null);
    renderShopping();
  }
}

async function onItemsClick(e) {
  const actEl = e.target.closest('[data-act]');
  if (!actEl) return;
  const act = actEl.dataset.act;
  if (act === 'new') return newList();
  if (act === 'clear') return clearChecked();
  const id = e.target.closest('.item')?.dataset.id;
  const it = state.items.find((x) => x.id === id);
  if (!it) return;

  if (act === 'toggle') {
    const checked = !it.checked;
    Object.assign(it, {
      checked,
      checked_by: checked ? uid() : null,
      checked_at: checked ? new Date().toISOString() : null,
    });
    renderShopping();
    const { error } = await sb.from('items')
      .update({ checked, checked_by: it.checked_by, checked_at: it.checked_at }).eq('id', id);
    if (error) { toast(error.message); refresh(); }
  }

  if (act === 'del') {
    state.items = state.items.filter((x) => x.id !== id);
    renderShopping();
    const { error } = await sb.from('items').delete().eq('id', id);
    if (error) { toast(error.message); refresh(); }
  }
}

async function clearChecked() {
  const l = currentList();
  if (!l) return;
  state.items = state.items.filter((x) => !(x.list_id === l.id && x.checked));
  renderShopping();
  const { error } = await sb.from('items').delete().eq('list_id', l.id).eq('checked', true);
  if (error) { toast(error.message); refresh(); }
}

init();
