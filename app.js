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
const SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'projects', label: 'Projects' },
  { id: 'ideas', label: 'Ideas', icon: '💡' }, // icon only on narrow phones
];

// ---------- State ----------
const state = {
  session: null,
  screen: null,
  profiles: {},
  lists: [],
  items: [],
  currentListId: store('currentListId'),
  // Shopping categories you add yourselves (shared). One-time ones live only on the item.
  catsReady: false,
  customCats: [],
  onceCat: null,     // one-time category picked in the add form (this session only)
  showCats: false,   // "Categories" panel open
  channel: null,
  view: null,        // which section's markup is currently in #view
  route: null,       // last rendered hash route
  // Projects section
  projectsReady: false,
  projectsError: '',
  rooms: [],
  ptypes: [],
  projects: [],
  ptasks: [],
  plinks: [],
  pcosts: [],
  pnotes: [],
  pfiles: [],
  editTask: null,
  editLink: null,
  // Home (front page)
  homeReady: false,
  homeError: '',
  household: null,   // { photo_path, photo_by, photo_at }
  photoBusy: false,
  // Ideas (suggestion box)
  ideasReady: false,
  ideasError: '',
  ideas: [],
  editIdea: null,
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
    if (document.visibilityState !== 'visible') return;
    checkForUpdate();
    if (state.screen === 'main') refresh();
  });
  checkForUpdate();
  route();
}

// Home-screen apps (iPhone/Android) keep old files cached. Compare the version
// in the live index.html with the one we're running; if newer, load it fresh.
async function checkForUpdate() {
  try {
    const running = document.querySelector('meta[name="app-version"]')?.content;
    const res = await fetch('./index.html?check=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const live = (await res.text()).match(/name="app-version" content="([^"]+)"/)?.[1];
    if (!live || live === running) return;
    if (sessionStorage.getItem('updatedTo') === live) return; // avoid reload loops
    sessionStorage.setItem('updatedTo', live);
    location.replace('./?v=' + encodeURIComponent(live) + location.hash);
  } catch { /* offline – ignore */ }
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
  await Promise.all([loadShopCats(), loadProjects(), loadHome(), loadIdeas()]);
  return true;
}

async function loadShopCats() {
  const { data, error } = await sb.from('shopping_categories').select('*').order('position').order('created_at');
  if (error) {
    console.warn('Custom categories not available:', error);
    state.catsReady = false;
    state.customCats = [];
    return;
  }
  state.catsReady = true;
  state.customCats = data;
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
  if (await loadAll()) renderView();
}

function subscribe() {
  if (state.channel) return;
  // One listener for every shared table (only tables added to the realtime publication send events)
  state.channel = sb.channel('household')
    .on('postgres_changes', { event: '*', schema: 'public' }, scheduleRefresh)
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
  state.view = null;
  const me = state.profiles[uid()];
  app.innerHTML = `
    <header class="top">
      <a class="brand" href="#home" aria-label="Home">${ICON}</a>
      <nav class="sections" id="nav">
        ${SECTIONS.map((s) => `<button data-section="${s.id}" aria-label="${esc(s.label)}">${s.icon ? `<span class="ico">${s.icon}</span><span class="lbl">${esc(s.label)}</span>` : esc(s.label)}</button>`).join('')}
      </nav>
      <div class="me"><span class="nm">${esc(me?.display_name)} ·</span> <button class="link" id="signout">Sign out</button></div>
    </header>
    <main class="wrap" id="view"></main>`;

  $('signout').onclick = () => sb.auth.signOut();
  $('nav').onclick = (e) => {
    const id = e.target.closest('[data-section]')?.dataset.section;
    if (id) location.hash = id;
  };
  renderView();
}

// Hash routes: #home, #shopping, #projects, #projects/<id>, #projects/settings, #ideas
// Opening the app without a hash lands on the front page.
function parseRoute() {
  const [sec, sub] = location.hash.replace(/^#\/?/, '').split('/');
  const section = SECTIONS.some((s) => s.id === sec) ? sec : 'home';
  return { section, sub: sub || null, key: `${section}/${sub || ''}` };
}

window.addEventListener('hashchange', () => { if (state.screen === 'main') renderView(); });

function renderView() {
  const r = parseRoute();
  store('section', r.section);
  for (const b of document.querySelectorAll('#nav [data-section]')) {
    b.classList.toggle('active', b.dataset.section === r.section);
  }
  const changed = r.key !== state.route;
  state.route = r.key;
  if (r.section === 'home') {
    renderHome();
  } else if (r.section === 'shopping') {
    if (state.view !== 'shopping') buildShopping();
    renderShopping();
  } else if (r.section === 'ideas') {
    if (changed) state.editIdea = null;
    renderIdeas(!changed);
  } else {
    if (changed) { state.editTask = null; state.editLink = null; }
    renderProjects(r.sub, !changed);
  }
  if (changed) window.scrollTo(0, 0);
}

// ---------- Shopping section ----------
function buildShopping() {
  state.view = 'shopping';
  const view = $('view');
  view.onclick = view.onchange = view.onsubmit = null;
  view.innerHTML = `
      <div class="chips" id="chips"></div>
      <div id="listhead"></div>
      <form id="add" class="add" autocomplete="off">
        <input name="name" placeholder="Add an item…" required maxlength="80" aria-label="Item">
        <input name="qty" placeholder="Qty" maxlength="20" aria-label="Quantity">
        <select name="cat" aria-label="Category"></select>
        <button class="btn primary" type="submit">Add</button>
      </form>
      <div id="items"></div>`;
  setupAddForm();
  $('chips').onclick = onChipClick;
  $('listhead').onclick = onListHeadClick;
  $('items').onclick = onItemsClick;
  $('items').onchange = onItemsChange;
}

function renderShopping() {
  renderChips();
  renderListHead();
  fillAddCats();
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
      <button class="link ${state.showCats ? 'on' : ''}" data-act="cats" aria-expanded="${state.showCats}">Categories</button>
      <button class="link" data-act="rename">Rename</button>
      <button class="link" data-act="delete">Delete</button>
    </div>${state.showCats ? catPanelHTML() : ''}` : '';
}

function catPanelHTML() {
  if (!state.catsReady) {
    return `<div class="catpanel"><p>To save your own categories, run <code>supabase/05_shopping_categories.sql</code> in Supabase (SQL Editor → Run). One-time categories already work – pick <b>✎ One-time category…</b> in the category menu.</p></div>`;
  }
  return `
    <div class="catpanel">
      <p>Your own categories – shared, and available on every list. Removing one doesn't change items that already use it.</p>
      <div class="catchips">
        ${state.customCats.map((c) => `<span class="catchip">${esc(c.name)}<button data-act="cat-del" data-id="${c.id}" aria-label="Remove category ${esc(c.name)}">×</button></span>`).join('')}
        <button class="chip newlist" data-act="cat-add">+ New category</button>
      </div>
    </div>`;
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
  const cats = Object.keys(groups).sort((a, b) => catRank(a) - catRank(b) || a.localeCompare(b));

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
      ${itemMenu(i)}
      <button class="del" data-act="del" aria-label="Remove ${esc(i.name)}">×</button>
    </li>`;
}

// ---------- Categories ----------
// Order: built-ins → your saved ones → one-time ones → Other
function allCats() {
  const saved = state.customCats.map((c) => c.name).filter((n) => !CATEGORIES.includes(n));
  return [...CATEGORIES.filter((c) => c !== 'Other'), ...saved, 'Other'];
}

function catRank(c) {
  if (c === 'Other') return 9999;
  const b = CATEGORIES.indexOf(c);
  if (b !== -1) return b;
  const s = state.customCats.findIndex((x) => x.name === c);
  return s !== -1 ? 100 + s : 5000;
}

// Reuse an existing category if the name only differs in upper/lower case
function matchCat(name) {
  const n = name.trim().toLowerCase();
  return allCats().find((c) => c.toLowerCase() === n) || null;
}

function shopCatOptions(once) {
  const cats = allCats();
  const extra = once && !cats.includes(once) ? `<option value="${esc(once)}">${esc(once)} (one-time)</option>` : '';
  return extra + cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('') +
    `<option value="__new">＋ New category…</option><option value="__once">✎ One-time category…</option>`;
}

// (Re)build the add form's category menu, keeping the current choice
function fillAddCats(want) {
  const sel = $('add')?.elements.cat;
  if (!sel) return;
  const cur = want ?? (sel.value && !sel.value.startsWith('__') ? sel.value : store('lastCategory') || 'Other');
  const sig = JSON.stringify([allCats(), state.onceCat]);
  if (sel.dataset.sig !== sig) { sel.innerHTML = shopCatOptions(state.onceCat); sel.dataset.sig = sig; }
  sel.value = allCats().includes(cur) || cur === state.onceCat ? cur : 'Other';
}

async function addShopCategory() {
  if (!state.catsReady) {
    toast('Run supabase/05_shopping_categories.sql in Supabase first – or use a one-time category.');
    return null;
  }
  const name = await ask('New category', '', 'Add');
  if (!name) return null;
  const existing = matchCat(name);
  if (existing) return existing;
  const position = Math.max(-1, ...state.customCats.map((c) => c.position)) + 1;
  const { data, error } = await sb.from('shopping_categories').insert({ name, position, created_by: uid() }).select().single();
  if (error) { toast(error.message); return null; }
  if (!state.customCats.some((x) => x.id === data.id)) state.customCats.push(data);
  toast(`Category "${data.name}" added`);
  return data.name;
}

async function askOnceCat() {
  const name = await ask('One-time category', '', 'Use');
  return name ? matchCat(name) || name : null;
}

// "⋯" menu on each item: move to another list or change category.
// A native <select> sits invisibly on top of the button, so phones show their own picker.
function itemMenu(i) {
  const others = state.lists.filter((l) => l.id !== i.list_id);
  const cats = allCats();
  if (!cats.includes(i.category)) cats.unshift(i.category);
  return `
      <label class="more" title="Move or change category">⋯
        <select data-act="item-menu" aria-label="Move or change category for ${esc(i.name)}">
          <option value="" selected disabled>${esc(i.name)}</option>
          ${others.length ? `<optgroup label="Move to list">${others.map((l) => `<option value="list:${l.id}">${l.emoji ? esc(l.emoji) + ' ' : ''}${esc(l.name)}</option>`).join('')}</optgroup>` : ''}
          <optgroup label="Change category">
            ${cats.map((c) => `<option value="cat:${esc(c)}">${c === i.category ? '✓ ' : ''}${esc(c)}</option>`).join('')}
            <option value="cat-new">＋ New category…</option>
            <option value="cat-once">✎ One-time category…</option>
          </optgroup>
        </select>
      </label>`;
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
  let prevCat = null;
  fillAddCats();
  prevCat = select.value;

  select.onchange = async () => {
    const v = select.value;
    if (v === '__new' || v === '__once') {
      const name = v === '__new' ? await addShopCategory() : await askOnceCat();
      if (name && !allCats().includes(name)) state.onceCat = name;
      fillAddCats(name || prevCat);
    }
    prevCat = select.value;
    manualCategory = true;
  };
  nameInput.oninput = () => {
    if (manualCategory) return;
    const g = guessCategory(nameInput.value.trim());
    if (g) { select.value = g; prevCat = g; }
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
    if (select.value !== state.onceCat) store('lastCategory', select.value);
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
  const actEl = e.target.closest('[data-act]');
  const act = actEl?.dataset.act;
  const l = currentList();
  if (!l) return;
  if (act === 'cats') {
    state.showCats = !state.showCats;
    renderListHead();
  }
  if (act === 'cat-add') {
    if (await addShopCategory()) renderShopping();
  }
  if (act === 'cat-del') {
    const c = state.customCats.find((x) => x.id === actEl.dataset.id);
    if (!c) return;
    const used = state.items.filter((i) => i.category === c.name).length;
    const note = used ? `\n\n${used} item${used === 1 ? '' : 's'} still use it – they keep the category.` : '';
    if (!confirm(`Remove the category "${c.name}"?${note}`)) return;
    state.customCats = state.customCats.filter((x) => x.id !== c.id);
    renderShopping();
    const { error } = await sb.from('shopping_categories').delete().eq('id', c.id);
    if (error) { toast(error.message); refresh(); }
  }
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

async function onItemsChange(e) {
  const sel = e.target.closest('select[data-act="item-menu"]');
  if (!sel) return;
  const v = sel.value;
  sel.value = '';
  const it = state.items.find((x) => x.id === sel.closest('.item')?.dataset.id);
  if (!it || !v) return;

  if (v.startsWith('list:')) {
    const to = state.lists.find((l) => l.id === v.slice(5));
    if (!to) return;
    it.list_id = to.id;
    renderShopping();
    toast(`Moved "${it.name}" to ${to.emoji ? to.emoji + ' ' : ''}${to.name}`);
    const { error } = await sb.from('items').update({ list_id: to.id }).eq('id', it.id);
    if (error) { toast(error.message); refresh(); }
    return;
  }

  let cat = null;
  if (v.startsWith('cat:')) cat = v.slice(4);
  else if (v === 'cat-new') cat = await addShopCategory();
  else if (v === 'cat-once') cat = await askOnceCat();
  if (!cat || cat === it.category) { renderShopping(); return; }
  it.category = cat;
  renderShopping();
  const { error } = await sb.from('items').update({ category: cat }).eq('id', it.id);
  if (error) { toast(error.message); refresh(); }
}

async function clearChecked() {
  const l = currentList();
  if (!l) return;
  state.items = state.items.filter((x) => !(x.list_id === l.id && x.checked));
  renderShopping();
  const { error } = await sb.from('items').delete().eq('list_id', l.id).eq('checked', true);
  if (error) { toast(error.message); refresh(); }
}

// ============================================================
// ---------- Projects section ----------
// ============================================================
const BUCKET = 'project-files';

const STATUSES = [
  { id: 'idea', label: 'Idea' },
  { id: 'researching', label: 'Researching' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'done', label: 'Done' },
];
const PRIORITIES = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];
const GROUPS = [
  { id: 'room', label: 'Room' },
  { id: 'status', label: 'Status' },
  { id: 'type', label: 'Type' },
  { id: 'priority', label: 'Priority' },
];
// Sort order inside a group: most "alive" first
const STATUS_RANK = { in_progress: 0, researching: 1, idea: 2, on_hold: 3, done: 4 };
const PRIO_RANK = { high: 0, medium: 1, low: 2 };
const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;
const prioLabel = (id) => PRIORITIES.find((s) => s.id === id)?.label || id;

// Supabase table → state key
const TABLES = {
  rooms: 'rooms', project_types: 'ptypes', projects: 'projects', project_tasks: 'ptasks',
  project_links: 'plinks', project_costs: 'pcosts', project_notes: 'pnotes', project_files: 'pfiles',
};

const pv = {
  group: store('pGroup') || 'room',
  status: store('pStatus') || 'active',
  room: '',
  type: '',
  prio: '',
};

// ---------- Data ----------
async function loadProjects() {
  const q = (t, ...order) => order.reduce((x, o) => x.order(o), sb.from(t).select('*'));
  const res = await Promise.all([
    q('rooms', 'position', 'created_at'),
    q('project_types', 'position', 'created_at'),
    q('projects', 'created_at'),
    q('project_tasks', 'created_at'),
    q('project_links', 'created_at'),
    q('project_costs', 'created_at'),
    sb.from('project_notes').select('*').order('created_at', { ascending: false }),
    q('project_files', 'created_at'),
  ]);
  const err = res.find((r) => r.error)?.error;
  if (err) {
    console.warn('Projects not available:', err);
    state.projectsReady = false;
    state.projectsError = err.message;
    return;
  }
  state.projectsReady = true;
  [state.rooms, state.ptypes, state.projects, state.ptasks, state.plinks, state.pcosts, state.pnotes, state.pfiles] =
    res.map((r) => r.data);
}

async function dbInsert(table, row) {
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) { toast(error.message); return null; }
  const arr = state[TABLES[table]];
  if (!arr.some((x) => x.id === data.id)) {
    if (table === 'project_notes') arr.unshift(data); else arr.push(data);
  }
  renderView();
  return data;
}

async function dbUpdate(table, id, patch) {
  const obj = state[TABLES[table]].find((x) => x.id === id);
  if (obj) Object.assign(obj, patch);
  renderView();
  const { error } = await sb.from(table).update(patch).eq('id', id);
  if (error) { toast(error.message); refresh(); return false; }
  return true;
}

async function dbDelete(table, id) {
  const key = TABLES[table];
  state[key] = state[key].filter((x) => x.id !== id);
  renderView();
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) { toast(error.message); refresh(); return false; }
  return true;
}

// ---------- Small helpers ----------
const byId = (arr, id) => arr.find((x) => x.id === id);
const nextPos = (arr) => Math.max(-1, ...arr.map((x) => x.position ?? 0)) + 1;
const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD, local time
const nok = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 });
const kr = (n) => (n === null || n === undefined || n === '' ? '' : nok.format(Number(n)));

function parseAmount(v) {
  const t = String(v ?? '').replace(/\s|kr|nok/gi, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00');
  const opts = { day: 'numeric', month: 'short' };
  if (dt.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return dt.toLocaleDateString('en-GB', opts);
}

function fmtWhen(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function personName(id) {
  if (!id) return '';
  return state.profiles[id]?.display_name || 'someone';
}

function label(x) {
  return x ? `${x.emoji ? esc(x.emoji) + ' ' : ''}${esc(x.name)}` : '';
}

// "🛏️ Bedroom" → { emoji: '🛏️', name: 'Bedroom' }
function splitEmoji(text) {
  const m = text.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u);
  return m && m[2] ? { emoji: m[1], name: m[2].trim() } : { emoji: null, name: text.trim() };
}

function normalizeUrl(u) {
  const t = u.trim();
  if (!t) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : 'https://' + t;
}

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function safeHref(u) {
  return /^https?:\/\//i.test(u) ? esc(u) : '#';
}

// Escape, keep line breaks, and turn URLs into links
function richText(s) {
  return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function peopleOptions(selected, emptyLabel) {
  const people = Object.values(state.profiles).sort((a, b) => a.display_name.localeCompare(b.display_name));
  return `<option value="">${esc(emptyLabel)}</option>` + people.map((p) =>
    `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.display_name)}${p.id === uid() ? ' (you)' : ''}</option>`).join('');
}

function catOptions(arr, selected, emptyLabel, newLabel) {
  return `<option value="">${esc(emptyLabel)}</option>` +
    arr.map((x) => `<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${label(x)}</option>`).join('') +
    (newLabel ? `<option value="__new">${esc(newLabel)}</option>` : '');
}

function enumOptions(list, selected) {
  return list.map((x) => `<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${esc(x.label)}</option>`).join('');
}

function projectStats(p) {
  const tasks = state.ptasks.filter((t) => t.project_id === p.id);
  const open = tasks.filter((t) => !t.done).sort(taskOrder);
  const spent = state.pcosts.filter((c) => c.project_id === p.id).reduce((s, c) => s + Number(c.amount), 0);
  return {
    tasks, open, next: open[0],
    done: tasks.length - open.length,
    links: state.plinks.filter((l) => l.project_id === p.id).length,
    files: state.pfiles.filter((f) => f.project_id === p.id).length,
    spent,
  };
}

// Open tasks: those with a due date first (earliest first), then in the order they were added
function taskOrder(a, b) {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date) || a.created_at.localeCompare(b.created_at);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.created_at.localeCompare(b.created_at);
}

function progressBar(done, total, over = false) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return `<div class="bar ${over ? 'over' : ''}"><span style="width:${pct}%"></span></div>`;
}

// Re-render without losing what someone is typing (realtime updates re-render the page)
function keepWhileRendering(container, render) {
  const vals = {};
  const open = {};
  const active = document.activeElement;
  const inside = active && container.contains(active);
  const focusKey = inside ? (active.dataset.keep || active.dataset.field) : null;
  const focusVal = inside ? active.value : null;
  let sel = null;
  try { if (inside) sel = [active.selectionStart, active.selectionEnd]; } catch { /* not a text field */ }
  container.querySelectorAll('[data-keep]').forEach((el) => { if (el.value) vals[el.dataset.keep] = el.value; });
  container.querySelectorAll('details[data-key]').forEach((d) => { open[d.dataset.key] = d.open; });

  render();

  container.querySelectorAll('[data-keep]').forEach((el) => {
    if (vals[el.dataset.keep] !== undefined) el.value = vals[el.dataset.keep];
  });
  container.querySelectorAll('details[data-key]').forEach((d) => {
    if (open[d.dataset.key] !== undefined) d.open = open[d.dataset.key];
  });
  if (focusKey) {
    const el = container.querySelector(`[data-keep="${focusKey}"], [data-field="${focusKey}"]`);
    if (el) {
      if (el.dataset.field && focusVal !== null && el.type !== 'file') el.value = focusVal;
      el.focus();
      try { if (sel && sel[0] !== null) el.setSelectionRange(sel[0], sel[1]); } catch { /* ignore */ }
    }
  }
}

// ---------- Rendering ----------
function renderProjects(sub, keep) {
  const view = $('view');
  if (state.view !== 'projects') {
    state.view = 'projects';
    view.onclick = onProjectsClick;
    view.onchange = onProjectsChange;
    view.onsubmit = onProjectsSubmit;
    keep = false;
  }
  const draw = () => {
    if (!state.projectsReady) view.innerHTML = setupHTML();
    else if (sub === 'settings') view.innerHTML = settingsHTML();
    else if (sub) view.innerHTML = detailHTML(sub);
    else view.innerHTML = listHTML();
  };
  if (keep) keepWhileRendering(view, draw); else draw();
  if (sub && sub !== 'settings') fillSigned();
}

function setupHTML() {
  return `
    <div class="panel setup">
      <h1>Projects</h1>
      <p>The projects section needs its database tables first.</p>
      <ol>
        <li>Open Supabase → <b>SQL Editor</b>.</li>
        <li>Paste the contents of <code>supabase/02_projects.sql</code> and press <b>Run</b>.</li>
        <li>Come back here and reload the page.</li>
      </ol>
      <p class="muted small">Details: ${esc(state.projectsError)}</p>
    </div>`;
}

// ----- List view -----
function filteredProjects() {
  return state.projects.filter((p) => {
    if (pv.status === 'active' && p.status === 'done') return false;
    if (pv.status !== 'active' && pv.status !== 'all' && p.status !== pv.status) return false;
    if (pv.room && (pv.room === 'none' ? p.room_id : p.room_id !== pv.room)) return false;
    if (pv.type && (pv.type === 'none' ? p.type_id : p.type_id !== pv.type)) return false;
    if (pv.prio && p.priority !== pv.prio) return false;
    return true;
  });
}

function groupProjects(list) {
  const sortFn = (a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority]
    || STATUS_RANK[a.status] - STATUS_RANK[b.status]
    || a.title.localeCompare(b.title);
  let groups;
  if (pv.group === 'status') {
    groups = STATUSES.map((s) => ({ key: s.id, title: s.label, items: list.filter((p) => p.status === s.id) }));
  } else if (pv.group === 'priority') {
    groups = PRIORITIES.map((s) => ({ key: s.id, title: `${s.label} priority`, items: list.filter((p) => p.priority === s.id) }));
  } else {
    const [arr, field, none] = pv.group === 'type'
      ? [state.ptypes, 'type_id', 'No type'] : [state.rooms, 'room_id', 'No room'];
    groups = arr.map((x) => ({ key: x.id, title: label(x), raw: true, items: list.filter((p) => p[field] === x.id) }));
    groups.push({ key: 'none', title: none, items: list.filter((p) => !arr.some((x) => x.id === p[field])) });
  }
  return groups.filter((g) => g.items.length).map((g) => ({ ...g, items: g.items.sort(sortFn) }));
}

function listHTML() {
  const list = filteredProjects();
  const groups = groupProjects(list);
  const active = state.projects.filter((p) => p.status !== 'done');
  const inProg = active.filter((p) => p.status === 'in_progress').length;
  const filtered = pv.room || pv.type || pv.prio || pv.status !== 'active';

  return `
    <div class="listhead">
      <h1>Projects</h1>
      <button class="btn primary sm" data-act="new-project">+ New project</button>
    </div>
    <p class="muted summary">${active.length} active${inProg ? ` · ${inProg} in progress` : ''} ·
      <button class="link inline" data-act="go-settings">Rooms &amp; types</button></p>

    <div class="seg" role="group" aria-label="Group by">
      <span>Group by</span>
      ${GROUPS.map((g) => `<button class="${pv.group === g.id ? 'active' : ''}" data-act="group" data-v="${g.id}">${g.label}</button>`).join('')}
    </div>

    <div class="filters">
      <select data-filter="room" aria-label="Filter by room">
        ${catOptions(state.rooms, pv.room, 'All rooms')}<option value="none" ${pv.room === 'none' ? 'selected' : ''}>No room</option>
      </select>
      <select data-filter="type" aria-label="Filter by type">
        ${catOptions(state.ptypes, pv.type, 'All types')}<option value="none" ${pv.type === 'none' ? 'selected' : ''}>No type</option>
      </select>
      <select data-filter="status" aria-label="Filter by status">
        <option value="active" ${pv.status === 'active' ? 'selected' : ''}>Active (not done)</option>
        <option value="all" ${pv.status === 'all' ? 'selected' : ''}>All statuses</option>
        ${enumOptions(STATUSES, pv.status)}
      </select>
      <select data-filter="prio" aria-label="Filter by priority">
        <option value="">All priorities</option>${enumOptions(PRIORITIES, pv.prio)}
      </select>
    </div>
    ${filtered ? `<button class="link clear" data-act="clear-filters">Clear filters</button>` : ''}

    ${groups.map((g) => `
      <section class="group">
        <h3>${g.raw ? g.title : esc(g.title)} <span>· ${g.items.length}</span></h3>
        <div class="pcards">${g.items.map(cardHTML).join('')}</div>
      </section>`).join('')}

    ${!list.length ? `<div class="empty">${state.projects.length
      ? 'No projects match these filters.'
      : 'No projects yet.<br><br><button class="btn primary" data-act="new-project">Create the first one</button>'}</div>` : ''}`;
}

function cardHTML(p) {
  const st = projectStats(p);
  const room = byId(state.rooms, p.room_id);
  const type = byId(state.ptypes, p.type_id);
  const meta = [
    pv.group !== 'room' && room ? label(room) : '',
    pv.group !== 'type' && type ? label(type) : '',
    p.owner ? esc(personName(p.owner)) : '',
    p.due_date ? `<span class="${p.due_date < today() && p.status !== 'done' ? 'overdue' : ''}">Target ${fmtDate(p.due_date)}</span>` : '',
  ].filter(Boolean).join(' · ');
  const bits = [
    st.tasks.length ? `${st.done}/${st.tasks.length} tasks` : '',
    st.links ? `🔗 ${st.links}` : '',
    st.files ? `📎 ${st.files}` : '',
    p.budget || st.spent ? `${kr(st.spent)}${p.budget ? ` of ${kr(p.budget)}` : ' spent'}` : '',
  ].filter(Boolean);

  return `
    <a class="pcard ${p.status === 'done' ? 'is-done' : ''}" href="#projects/${p.id}">
      <div class="ptop">
        <span class="prio p-${p.priority}" title="${prioLabel(p.priority)} priority"></span>
        <h4>${esc(p.title)}</h4>
        ${pv.group !== 'status' ? `<span class="status st-${p.status}">${statusLabel(p.status)}</span>` : ''}
      </div>
      ${meta ? `<div class="pmeta">${meta}</div>` : ''}
      ${st.next ? `<div class="pnext"><b>Next:</b> ${esc(st.next.text)}${st.next.due_date ? ` · ${fmtDate(st.next.due_date)}` : ''}</div>` : ''}
      ${st.tasks.length ? progressBar(st.done, st.tasks.length) : ''}
      ${bits.length ? `<div class="pfoot">${bits.join(' · ')}</div>` : ''}
    </a>`;
}

// ----- Detail view -----
function detailHTML(id) {
  const p = byId(state.projects, id);
  if (!p) {
    return `<a class="back" href="#projects">← Projects</a>
      <div class="empty">This project doesn't exist any more.</div>`;
  }
  const st = projectStats(p);
  return `
    <a class="back" href="#projects">← Projects</a>
    <div class="listhead dhead">
      <span class="prio p-${p.priority}"></span>
      <h1 class="wrap-title">${esc(p.title)}</h1>
      <button class="link" data-act="rename-project">Rename</button>
    </div>

    <section class="panel">
      <div class="fields">
        <label>Status<select data-field="status">${enumOptions(STATUSES, p.status)}</select></label>
        <label>Priority<select data-field="priority">${enumOptions(PRIORITIES, p.priority)}</select></label>
        <label>Room<select data-field="room_id">${catOptions(state.rooms, p.room_id, '—', '+ New room…')}</select></label>
        <label>Type<select data-field="type_id">${catOptions(state.ptypes, p.type_id, '—', '+ New type…')}</select></label>
        <label>Responsible<select data-field="owner">${peopleOptions(p.owner, '—')}</select></label>
        <label>Target date<input type="date" data-field="due_date" value="${esc(p.due_date || '')}"></label>
      </div>
      <label class="full">Description
        <textarea data-field="description" rows="3" placeholder="What's the goal? Measurements, wishes, constraints…">${esc(p.description || '')}</textarea>
      </label>
      ${st.tasks.length ? `<div class="progress-line">${progressBar(st.done, st.tasks.length)}<span>${st.done} of ${st.tasks.length} tasks done</span></div>` : ''}
    </section>

    ${tasksPanel(p, st)}
    ${linksPanel(p)}
    ${budgetPanel(p, st)}
    ${filesPanel(p)}
    ${notesPanel(p)}

    <div class="danger-zone">
      <button class="link danger" data-act="delete-project">Delete project</button>
    </div>`;
}

function tasksPanel(p, st) {
  const done = st.tasks.filter((t) => t.done).sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)));
  return `
    <section class="panel">
      <h2>Tasks &amp; next steps</h2>
      <form class="addrow" data-form="task" autocomplete="off">
        <input name="text" data-keep="task-text" placeholder="Add a task or next step…" maxlength="200" required aria-label="Task">
        <select name="assignee" data-keep="task-who" aria-label="Who">${peopleOptions(null, 'Anyone')}</select>
        <input name="due" type="date" data-keep="task-due" aria-label="Due date">
        <button class="btn primary" type="submit">Add</button>
      </form>
      ${st.open.length ? `<ul class="items tasks">${st.open.map((t, i) => taskRow(t, i === 0)).join('')}</ul>`
        : `<p class="muted small pad">${done.length ? 'All tasks done! 🎉' : 'No tasks yet.'}</p>`}
      ${done.length ? `
        <details data-key="done-${p.id}">
          <summary>Done · ${done.length}</summary>
          <ul class="items tasks">${done.map((t) => taskRow(t, false)).join('')}</ul>
        </details>` : ''}
    </section>`;
}

function taskRow(t, isNext) {
  if (state.editTask === t.id) {
    return `
      <li class="item editing" data-id="${t.id}">
        <form class="inline-edit" data-form="task-edit" data-id="${t.id}">
          <input name="text" data-keep="et-text-${t.id}" value="${esc(t.text)}" maxlength="200" required aria-label="Task">
          <select name="assignee" data-keep="et-who-${t.id}" aria-label="Who">${peopleOptions(t.assignee, 'Anyone')}</select>
          <input name="due" type="date" data-keep="et-due-${t.id}" value="${esc(t.due_date || '')}" aria-label="Due date">
          <div class="row-actions">
            <button type="button" class="link danger" data-act="task-del">Delete</button>
            <span></span>
            <button type="button" class="btn sm" data-act="task-cancel">Cancel</button>
            <button class="btn primary sm" type="submit">Save</button>
          </div>
        </form>
      </li>`;
  }
  const overdue = !t.done && t.due_date && t.due_date < today();
  const meta = t.done
    ? `Done by ${esc(who(t.done_by))}${t.done_at ? ` · ${fmtDate(t.done_at.slice(0, 10))}` : ''}`
    : [t.assignee ? esc(personName(t.assignee)) : '',
       t.due_date ? `<span class="${overdue ? 'overdue' : ''}">${overdue ? 'Overdue · ' : 'Due '}${fmtDate(t.due_date)}</span>` : '']
      .filter(Boolean).join(' · ');
  return `
    <li class="item ${t.done ? 'checked' : ''}" data-id="${t.id}">
      <button class="check" data-act="task-toggle" aria-label="${t.done ? 'Mark as not done' : 'Mark as done'}">${TICK}</button>
      <div class="body" data-act="task-edit" title="Edit">
        <div class="name">${isNext ? '<span class="tag">Next</span>' : ''}${esc(t.text)}</div>
        ${meta ? `<div class="meta">${meta}</div>` : ''}
      </div>
    </li>`;
}

function linksPanel(p) {
  const links = state.plinks.filter((l) => l.project_id === p.id)
    .sort((a, b) => (b.favorite - a.favorite) || a.created_at.localeCompare(b.created_at));
  return `
    <section class="panel">
      <h2>Solutions &amp; links</h2>
      <form class="linkform" data-form="link" autocomplete="off">
        <input name="url" data-keep="link-url" placeholder="Paste a link…" inputmode="url" required aria-label="Link">
        <input name="title" data-keep="link-title" placeholder="Name (optional)" maxlength="120" aria-label="Name">
        <input name="price" data-keep="link-price" placeholder="Price kr" inputmode="decimal" aria-label="Price">
        <input name="note" data-keep="link-note" placeholder="Note – pros, cons, size… (optional)" maxlength="300" aria-label="Note">
        <button class="btn primary" type="submit">Add</button>
      </form>
      ${links.length ? `<ul class="links">${links.map(linkRow).join('')}</ul>`
        : '<p class="muted small pad">Paste links to products, inspiration or suppliers you find.</p>'}
    </section>`;
}

function linkRow(l) {
  if (state.editLink === l.id) {
    return `
      <li class="link-card editing" data-id="${l.id}">
        <form class="inline-edit" data-form="link-edit" data-id="${l.id}">
          <input name="title" data-keep="el-title-${l.id}" value="${esc(l.title || '')}" placeholder="Name" maxlength="120" aria-label="Name">
          <input name="url" data-keep="el-url-${l.id}" value="${esc(l.url)}" required aria-label="Link">
          <input name="price" data-keep="el-price-${l.id}" value="${l.price ?? ''}" placeholder="Price kr" inputmode="decimal" aria-label="Price">
          <input name="note" data-keep="el-note-${l.id}" value="${esc(l.note || '')}" placeholder="Note" maxlength="300" aria-label="Note">
          <div class="row-actions">
            <button type="button" class="link danger" data-act="link-del">Delete</button>
            <span></span>
            <button type="button" class="btn sm" data-act="link-cancel">Cancel</button>
            <button class="btn primary sm" type="submit">Save</button>
          </div>
        </form>
      </li>`;
  }
  const host = hostOf(l.url);
  return `
    <li class="link-card ${l.favorite ? 'fav' : ''}" data-id="${l.id}">
      <img class="favicon" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64" alt="" loading="lazy">
      <div class="body">
        <a href="${safeHref(l.url)}" target="_blank" rel="noopener" class="ltitle">${esc(l.title || host || l.url)}</a>
        <div class="meta">${esc(host)}${l.price !== null ? ` · <b>${kr(l.price)}</b>` : ''} · added by ${esc(who(l.created_by))}</div>
        ${l.note ? `<div class="lnote">${richText(l.note)}</div>` : ''}
      </div>
      <div class="lactions">
        <button class="icon ${l.favorite ? 'on' : ''}" data-act="link-fav" title="${l.favorite ? 'Remove from shortlist' : 'Shortlist'}" aria-label="Shortlist">★</button>
        <button class="icon" data-act="link-edit" title="Edit" aria-label="Edit">✎</button>
      </div>
    </li>`;
}

function budgetPanel(p, st) {
  const costs = state.pcosts.filter((c) => c.project_id === p.id);
  const prices = state.plinks.filter((l) => l.project_id === p.id && l.price !== null).map((l) => Number(l.price));
  const budget = p.budget !== null ? Number(p.budget) : null;
  const over = budget !== null && st.spent > budget;
  return `
    <section class="panel">
      <h2>Budget &amp; costs</h2>
      <div class="budget-top">
        <label>Budget
          <input data-field="budget" inputmode="decimal" placeholder="e.g. 30 000" value="${budget !== null ? budget : ''}">
        </label>
        <div class="budget-sum">
          <div><span class="muted">Spent</span><b>${kr(st.spent)}</b></div>
          ${budget !== null ? `<div><span class="muted">${over ? 'Over by' : 'Left'}</span><b class="${over ? 'overdue' : ''}">${kr(Math.abs(budget - st.spent))}</b></div>` : ''}
        </div>
      </div>
      ${budget ? progressBar(st.spent, budget, over) : ''}
      ${prices.length ? `<p class="muted small">Prices on saved solutions: ${prices.length > 1
        ? `${kr(Math.min(...prices))} – ${kr(Math.max(...prices))}` : kr(prices[0])}</p>` : ''}
      ${costs.length ? `<ul class="costs">${costs.map((c) => `
        <li data-id="${c.id}">
          <div class="body"><div>${esc(c.description)}</div>
            <div class="meta">${esc(who(c.created_by))} · ${fmtDate(c.created_at.slice(0, 10))}</div></div>
          <b>${kr(c.amount)}</b>
          <button class="del" data-act="cost-del" aria-label="Remove cost">×</button>
        </li>`).join('')}</ul>` : ''}
      <form class="addrow cost" data-form="cost" autocomplete="off">
        <input name="description" data-keep="cost-desc" placeholder="What did we pay for?" maxlength="120" required aria-label="Cost description">
        <input name="amount" data-keep="cost-amount" placeholder="Amount kr" inputmode="decimal" required aria-label="Amount">
        <button class="btn" type="submit">Add cost</button>
      </form>
    </section>`;
}

function filesPanel(p) {
  const files = state.pfiles.filter((f) => f.project_id === p.id);
  const images = files.filter((f) => f.mime?.startsWith('image/'));
  const docs = files.filter((f) => !f.mime?.startsWith('image/'));
  const url = (path) => esc(signedCache.get(path)?.url || '');
  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Photos &amp; files</h2>
        <label class="btn sm upload">+ Add<input type="file" multiple hidden data-act="upload"
          accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.dwg,.txt"></label>
      </div>
      ${images.length ? `<div class="thumbs">${images.map((f) => `
        <div class="thumb" data-id="${f.id}">
          <a data-path="${esc(f.path)}" href="${url(f.path) || '#'}" target="_blank" rel="noopener" title="${esc(f.name)}">
            <img data-path="${esc(f.path)}" ${url(f.path) ? `src="${url(f.path)}"` : ''} alt="${esc(f.name)}" loading="lazy">
          </a>
          <button class="x" data-act="file-del" aria-label="Delete ${esc(f.name)}">×</button>
        </div>`).join('')}</div>` : ''}
      ${docs.length ? `<ul class="files">${docs.map((f) => `
        <li data-id="${f.id}">
          <span class="ficon">${/pdf/i.test(f.mime || f.name) ? 'PDF' : 'FILE'}</span>
          <div class="body">
            <a data-path="${esc(f.path)}" href="${url(f.path) || '#'}" target="_blank" rel="noopener">${esc(f.name)}</a>
            <div class="meta">${esc(who(f.created_by))} · ${fmtDate(f.created_at.slice(0, 10))}${f.size ? ` · ${(f.size / 1048576).toFixed(1)} MB` : ''}</div>
          </div>
          <button class="del" data-act="file-del" aria-label="Delete ${esc(f.name)}">×</button>
        </li>`).join('')}</ul>` : ''}
      ${!files.length ? '<p class="muted small pad">Drawings, quotes, inspiration photos, receipts…</p>' : ''}
    </section>`;
}

function notesPanel(p) {
  const notes = state.pnotes.filter((n) => n.project_id === p.id);
  return `
    <section class="panel">
      <h2>Notes &amp; log</h2>
      <form class="noteform" data-form="note">
        <textarea name="body" data-keep="note-body" rows="2" placeholder="E.g. Called the wardrobe maker – revised drawing coming Friday" required></textarea>
        <button class="btn primary" type="submit">Add note</button>
      </form>
      ${notes.length ? `<ul class="notes">${notes.map((n) => `
        <li data-id="${n.id}">
          <div class="meta">${esc(who(n.created_by))} · ${fmtWhen(n.created_at)}
            <button class="link small" data-act="note-del">Delete</button></div>
          <div class="nbody">${richText(n.body)}</div>
        </li>`).join('')}</ul>` : ''}
    </section>`;
}

// ----- Rooms & types settings -----
function settingsHTML() {
  const block = (title, kind, arr) => `
    <section class="panel">
      <h2>${title}</h2>
      <ul class="items">${arr.map((x) => {
        const n = state.projects.filter((p) => p[kind === 'room' ? 'room_id' : 'type_id'] === x.id).length;
        return `
        <li class="item" data-id="${x.id}" data-kind="${kind}">
          <div class="body"><div class="name">${label(x)}</div><div class="meta">${n} project${n === 1 ? '' : 's'}</div></div>
          <button class="link" data-act="cat-up" aria-label="Move up">↑</button>
          <button class="link" data-act="cat-rename">Rename</button>
          <button class="del" data-act="cat-del" aria-label="Delete">×</button>
        </li>`;
      }).join('')}</ul>
      <button class="link addcat" data-act="cat-add" data-kind="${kind}">+ Add ${kind}</button>
    </section>`;
  return `
    <a class="back" href="#projects">← Projects</a>
    <div class="listhead"><h1>Rooms &amp; types</h1></div>
    <p class="muted small">Tip: start a name with an emoji to give it an icon, e.g. “🛏️ Bedroom”.</p>
    ${block('Rooms', 'room', state.rooms)}
    ${block('Project types', 'type', state.ptypes)}`;
}

// ---------- Signed URLs for private files ----------
const signedCache = new Map();
async function fillSigned() {
  const els = [...$('view').querySelectorAll('[data-path]')];
  if (!els.length) return;
  const now = Date.now();
  const need = [...new Set(els.map((e) => e.dataset.path))].filter((p) => !(signedCache.get(p)?.exp > now + 60000));
  if (need.length) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(need, 3600);
    if (error) return console.warn(error);
    for (const d of data) if (d.signedUrl) signedCache.set(d.path, { url: d.signedUrl, exp: now + 3600 * 1000 });
  }
  for (const el of $('view').querySelectorAll('[data-path]')) {
    const s = signedCache.get(el.dataset.path);
    if (!s) continue;
    if (el.tagName === 'IMG') { if (el.src !== s.url) el.src = s.url; } else el.href = s.url;
  }
}

// Phone photos are big – shrink large JPEGs before upload to save storage
async function shrinkImage(file) {
  if (file.type !== 'image/jpeg' || file.size < 1.5 * 1048576 || !window.createImageBitmap) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch { return file; }
}

async function uploadFiles(projectId, files) {
  if (!files.length) return;
  toast(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}…`);
  let ok = 0;
  for (const f of files) {
    const blob = await shrinkImage(f);
    const safe = f.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80) || 'file';
    const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const type = blob.type || f.type || 'application/octet-stream';
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: type });
    if (error) { toast(`${f.name}: ${error.message}`); continue; }
    const row = await dbInsert('project_files', { project_id: projectId, path, name: f.name, mime: type, size: blob.size, created_by: uid() });
    if (row) ok++;
  }
  if (ok) toast(`Uploaded ${ok} file${ok > 1 ? 's' : ''}`);
}

// ---------- Actions ----------
const currentProject = () => {
  const { section, sub } = parseRoute();
  return section === 'projects' && sub ? byId(state.projects, sub) : null;
};

async function newProject() {
  const title = await ask('New project', '', 'Create');
  if (!title) return;
  const p = await dbInsert('projects', {
    title,
    status: 'idea',
    priority: 'medium',
    room_id: pv.room && pv.room !== 'none' ? pv.room : null,
    type_id: pv.type && pv.type !== 'none' ? pv.type : null,
    created_by: uid(),
  });
  if (p) location.hash = `projects/${p.id}`;
}

async function addCategory(kind) {
  const [table, arr] = kind === 'room' ? ['rooms', state.rooms] : ['project_types', state.ptypes];
  const text = await ask(kind === 'room' ? 'New room' : 'New project type', '', 'Add');
  if (!text) return null;
  return dbInsert(table, { ...splitEmoji(text), position: nextPos(arr) });
}

async function onProjectsClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'upload') return; // the file input handles itself
  const p = currentProject();
  const rowId = el.closest('[data-id]')?.dataset.id;

  switch (act) {
    case 'new-project': return newProject();
    case 'go-settings': location.hash = 'projects/settings'; return;
    case 'group':
      pv.group = el.dataset.v; store('pGroup', pv.group); return renderView();
    case 'clear-filters':
      Object.assign(pv, { room: '', type: '', prio: '', status: 'active' }); store('pStatus', 'active'); return renderView();

    case 'rename-project': {
      const title = await ask('Rename project', p.title);
      if (title && title !== p.title) dbUpdate('projects', p.id, { title });
      return;
    }
    case 'delete-project': {
      if (!confirm(`Delete "${p.title}" with all its tasks, links, notes and files?`)) return;
      const paths = state.pfiles.filter((f) => f.project_id === p.id).map((f) => f.path);
      if (paths.length) await sb.storage.from(BUCKET).remove(paths);
      location.hash = 'projects';
      return dbDelete('projects', p.id);
    }

    // Tasks
    case 'task-toggle': {
      const t = byId(state.ptasks, rowId);
      if (!t) return;
      const done = !t.done;
      return dbUpdate('project_tasks', t.id, { done, done_by: done ? uid() : null, done_at: done ? new Date().toISOString() : null });
    }
    case 'task-edit': state.editTask = rowId; state.editLink = null; renderView();
      $('view').querySelector(`[data-keep="et-text-${rowId}"]`)?.focus(); return;
    case 'task-cancel': state.editTask = null; return renderView();
    case 'task-del': state.editTask = null; return dbDelete('project_tasks', rowId);

    // Links
    case 'link-fav': {
      const l = byId(state.plinks, rowId);
      return l && dbUpdate('project_links', l.id, { favorite: !l.favorite });
    }
    case 'link-edit': state.editLink = rowId; state.editTask = null; return renderView();
    case 'link-cancel': state.editLink = null; return renderView();
    case 'link-del': state.editLink = null; return dbDelete('project_links', rowId);

    // Costs, notes, files
    case 'cost-del': return dbDelete('project_costs', rowId);
    case 'note-del':
      if (confirm('Delete this note?')) dbDelete('project_notes', rowId);
      return;
    case 'file-del': {
      const f = byId(state.pfiles, rowId);
      if (!f || !confirm(`Delete "${f.name}"?`)) return;
      const { error } = await sb.storage.from(BUCKET).remove([f.path]);
      if (error) return toast(error.message);
      return dbDelete('project_files', f.id);
    }

    // Rooms & types
    case 'cat-add': return addCategory(el.dataset.kind);
    case 'cat-rename':
    case 'cat-del':
    case 'cat-up': {
      const kind = el.closest('[data-kind]').dataset.kind;
      const [table, key, field] = kind === 'room' ? ['rooms', 'rooms', 'room_id'] : ['project_types', 'ptypes', 'type_id'];
      const x = byId(state[key], rowId);
      if (!x) return;
      if (act === 'cat-rename') {
        const text = await ask(`Rename ${kind}`, `${x.emoji ? x.emoji + ' ' : ''}${x.name}`);
        if (text) dbUpdate(table, x.id, splitEmoji(text));
      } else if (act === 'cat-del') {
        const n = state.projects.filter((pr) => pr[field] === x.id).length;
        if (!confirm(`Delete "${x.name}"?${n ? ` ${n} project${n > 1 ? 's' : ''} will have no ${kind}.` : ''}`)) return;
        state.projects.forEach((pr) => { if (pr[field] === x.id) pr[field] = null; });
        dbDelete(table, x.id);
      } else {
        // Move up: renumber the whole list so positions are unique
        const arr = [...state[key]];
        const i = arr.indexOf(x);
        if (i <= 0) return;
        [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        arr.forEach((item, idx) => { item.position = idx; });
        state[key] = arr;
        renderView();
        const results = await Promise.all(arr.map((item) => sb.from(table).update({ position: item.position }).eq('id', item.id)));
        const err = results.find((r) => r.error)?.error;
        if (err) { toast(err.message); refresh(); }
      }
    }
  }
}

async function onProjectsChange(e) {
  const el = e.target;

  if (el.dataset.filter) {
    pv[el.dataset.filter] = el.value;
    if (el.dataset.filter === 'status') store('pStatus', el.value);
    return renderView();
  }

  if (el.type === 'file' && el.dataset.act === 'upload') {
    const p = currentProject();
    const files = [...el.files];
    el.value = '';
    if (p) uploadFiles(p.id, files);
    return;
  }

  const field = el.dataset.field;
  const p = currentProject();
  if (!field || !p) return;
  let value = el.value;

  if ((field === 'room_id' || field === 'type_id') && value === '__new') {
    const created = await addCategory(field === 'room_id' ? 'room' : 'type');
    if (!created) return renderView();
    value = created.id;
  }
  if (field === 'budget') {
    value = parseAmount(value);
    if (Number.isNaN(value)) { toast('Budget must be a number'); return renderView(); }
  }
  if (field === 'description') value = value.trim() || null;
  if (value === '') value = null;
  if (p[field] === value) return;
  dbUpdate('projects', p.id, { [field]: value });
}

async function onProjectsSubmit(e) {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const p = currentProject();
  if (!p) return;
  const f = Object.fromEntries(new FormData(form));
  const clear = () => form.querySelectorAll('[data-keep]').forEach((x) => { x.value = ''; });

  switch (form.dataset.form) {
    case 'task': {
      const text = f.text.trim();
      if (!text) return;
      clear();
      await dbInsert('project_tasks', { project_id: p.id, text, assignee: f.assignee || null, due_date: f.due || null, created_by: uid() });
      $('view').querySelector('[data-keep="task-text"]')?.focus();
      return;
    }
    case 'task-edit': {
      const text = f.text.trim();
      if (!text) return;
      state.editTask = null;
      return dbUpdate('project_tasks', form.dataset.id, { text, assignee: f.assignee || null, due_date: f.due || null });
    }
    case 'link':
    case 'link-edit': {
      const url = normalizeUrl(f.url);
      const price = parseAmount(f.price);
      if (!hostOf(url)) return toast("That doesn't look like a link");
      if (Number.isNaN(price)) return toast('Price must be a number');
      const row = { url, title: f.title.trim() || null, price, note: f.note.trim() || null };
      if (form.dataset.form === 'link') {
        clear();
        return dbInsert('project_links', { ...row, project_id: p.id, created_by: uid() });
      }
      state.editLink = null;
      return dbUpdate('project_links', form.dataset.id, row);
    }
    case 'cost': {
      const amount = parseAmount(f.amount);
      if (amount === null || Number.isNaN(amount)) return toast('Amount must be a number');
      clear();
      return dbInsert('project_costs', { project_id: p.id, description: f.description.trim(), amount, created_by: uid() });
    }
    case 'note': {
      const body = f.body.trim();
      if (!body) return;
      clear();
      return dbInsert('project_notes', { project_id: p.id, body, created_by: uid() });
    }
  }
}


// ============================================================
// ---------- Home (front page) ----------
// ============================================================
const PHOTO_BUCKET = 'home-photos';
const CAMERA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;

async function loadHome() {
  const { data, error } = await sb.from('household').select('*').eq('id', 1).maybeSingle();
  if (error) {
    console.warn('Home photo not available:', error);
    state.homeReady = false;
    state.homeError = error.message;
    return;
  }
  state.homeReady = true;
  state.household = data || null;
}

function renderHome() {
  const view = $('view');
  if (state.view !== 'home') {
    state.view = 'home';
    view.onclick = onHomeClick;
    view.onchange = onHomeChange;
    view.onsubmit = null;
  }
  keepWhileRendering(view, () => { view.innerHTML = homeHTML(); });
  fillPhoto();
}

function plural(n, one, many = one + 's') { return `${n} ${n === 1 ? one : many}`; }

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('sv-SE');
}

function homeHTML() {
  const me = state.profiles[uid()];
  const h = new Date().getHours();
  const hello = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  // Shopping: everything not yet checked off, across all lists
  const openItems = state.items.filter((i) => !i.checked);
  const perList = state.lists
    .map((l) => ({ l, n: openItems.filter((i) => i.list_id === l.id).length }))
    .filter((x) => x.n);

  // Projects: "live" = not done
  const live = state.projects.filter((p) => p.status !== 'done');
  const byStatus = STATUSES.filter((s) => s.id !== 'done')
    .map((s) => ({ s, n: live.filter((p) => p.status === s.id).length }))
    .filter((x) => x.n);

  return `
    <div class="hello">
      <h1>${hello}${me ? `, ${esc(me.display_name)}` : ''}</h1>
      <p class="muted">${esc(dateLine)}</p>
    </div>

    ${photoHTML()}

    <div class="stats">
      <div class="stat" data-act="go-shopping" role="link" tabindex="0">
        <div class="stat-num">${openItems.length}</div>
        <div class="stat-label">${openItems.length === 1 ? 'item' : 'items'} on the shopping list</div>
        ${perList.length ? `<div class="stat-chips">${perList.map(({ l, n }) => `
          <button class="mini" data-act="open-list" data-id="${l.id}">${l.emoji ? esc(l.emoji) + ' ' : ''}${esc(l.name)} <b>${n}</b></button>`).join('')}</div>`
          : '<div class="stat-sub">All bought 🎉</div>'}
        <span class="stat-go">Shopping →</span>
      </div>
      <div class="stat" data-act="go-projects" role="link" tabindex="0">
        <div class="stat-num">${state.projectsReady ? live.length : '–'}</div>
        <div class="stat-label">live ${live.length === 1 ? 'project' : 'projects'}</div>
        ${byStatus.length ? `<div class="stat-chips">${byStatus.map(({ s, n }) =>
          `<span class="status st-${s.id}">${n} ${esc(s.label.toLowerCase())}</span>`).join('')}</div>`
          : `<div class="stat-sub">${state.projectsReady ? 'Nothing on the go' : 'Not set up yet'}</div>`}
        <span class="stat-go">Projects →</span>
      </div>
    </div>

    ${state.projectsReady ? todosHTML(live) : ''}`;
}

function photoHTML() {
  if (!state.homeReady) {
    return `<div class="hero empty-hero">
      <p class="muted small">To add a shared photo here, run <code>supabase/03_home.sql</code> in Supabase → SQL Editor, then reload.</p>
    </div>`;
  }
  const hh = state.household;
  const busy = state.photoBusy ? '<div class="hero-busy">Uploading…</div>' : '';
  const input = `<input type="file" accept="image/*" hidden data-act="photo">`;
  if (!hh?.photo_path) {
    return `<label class="hero empty-hero add-photo">
      ${input}${busy}
      <span class="cam">${CAMERA}</span>
      <b>Add a photo</b>
      <span class="muted small">Pick one from your camera roll – you both see it here</span>
    </label>`;
  }
  const cached = photoCache.path === hh.photo_path ? photoCache.url : '';
  return `<figure class="hero">
      <img data-photo="${esc(hh.photo_path)}" ${cached ? `src="${esc(cached)}"` : ''} alt="Our home">
      ${busy}
      <div class="hero-actions">
        <label class="hero-btn">${input}${CAMERA}<span>Change</span></label>
        <button class="hero-btn" data-act="photo-remove" aria-label="Remove photo">×</button>
      </div>
      ${hh.photo_by ? `<figcaption>Photo by ${esc(personName(hh.photo_by))}${hh.photo_at ? ` · ${fmtDate(hh.photo_at.slice(0, 10))}` : ''}</figcaption>` : ''}
    </figure>`;
}

function todosHTML(live) {
  const liveIds = new Set(live.map((p) => p.id));
  const open = state.ptasks.filter((t) => !t.done && liveIds.has(t.project_id)).sort(taskOrder);
  // You first, then everyone else alphabetically, then Unassigned
  const people = Object.values(state.profiles)
    .sort((a, b) => (b.id === uid()) - (a.id === uid()) || a.display_name.localeCompare(b.display_name));
  const known = new Set(people.map((p) => p.id));
  const cols = [
    ...people.map((p) => ({ key: p.id, name: p.display_name, tasks: open.filter((t) => t.assignee === p.id) })),
    { key: 'none', name: 'Unassigned', tasks: open.filter((t) => !t.assignee || !known.has(t.assignee)), none: true },
  ];
  return `
    <div class="listhead"><h1 class="h2">To-dos</h1></div>
    <div class="todos">${cols.map(todoCard).join('')}</div>`;
}

function todoCard(c) {
  const t0 = today();
  const week = addDays(7);
  const overdue = c.tasks.filter((t) => t.due_date && t.due_date < t0).length;
  const soon = c.tasks.filter((t) => t.due_date && t.due_date >= t0 && t.due_date <= week).length;
  const sub = [
    overdue ? `<span class="overdue">${overdue} overdue</span>` : '',
    soon ? `${soon} due this week` : '',
  ].filter(Boolean).join(' · ');
  const first = c.tasks.slice(0, 3);
  const rest = c.tasks.slice(3);
  return `
    <section class="todo-card">
      <div class="todo-head">
        <span class="avatar ${c.none ? 'none' : ''}">${c.none ? '?' : esc([...c.name][0]?.toUpperCase() || '?')}</span>
        <div class="todo-who"><h3>${esc(c.name)}</h3>${sub ? `<div class="meta">${sub}</div>` : ''}</div>
        <span class="todo-count">${c.tasks.length}</span>
      </div>
      ${c.tasks.length ? `<ul class="todo-list">${first.map(todoRow).join('')}</ul>
        ${rest.length ? `<details data-key="todos-${c.key}">
          <summary>${plural(rest.length, 'more task')}</summary>
          <ul class="todo-list">${rest.map(todoRow).join('')}</ul>
        </details>` : ''}`
        : `<p class="muted small pad">Nothing to do 🎉</p>`}
    </section>`;
}

function todoRow(t) {
  const p = byId(state.projects, t.project_id);
  const overdue = t.due_date && t.due_date < today();
  const meta = [
    p ? esc(p.title) : '',
    t.due_date ? `<span class="${overdue ? 'overdue' : ''}">${overdue ? 'Overdue · ' : 'Due '}${fmtDate(t.due_date)}</span>` : '',
  ].filter(Boolean).join(' · ');
  return `
    <li data-id="${t.id}">
      <button class="check" data-act="task-done" aria-label="Mark “${esc(t.text)}” as done">${TICK}</button>
      <a class="body" href="#projects/${t.project_id}">
        <div class="name">${esc(t.text)}</div>
        ${meta ? `<div class="meta">${meta}</div>` : ''}
      </a>
    </li>`;
}

// ---------- Shared photo ----------
const photoCache = { path: null, url: null, exp: 0 };

async function fillPhoto() {
  const img = $('view').querySelector('img[data-photo]');
  if (!img) return;
  const path = img.dataset.photo;
  if (!(photoCache.path === path && photoCache.exp > Date.now() + 60000)) {
    const { data, error } = await sb.storage.from(PHOTO_BUCKET).createSignedUrl(path, 86400);
    if (error) return console.warn(error);
    Object.assign(photoCache, { path, url: data.signedUrl, exp: Date.now() + 86400 * 1000 });
  }
  const cur = $('view').querySelector('img[data-photo]');
  if (cur && cur.dataset.photo === path && cur.src !== photoCache.url) cur.src = photoCache.url;
}

// Resize to max 2000px and save as JPEG (keeps uploads small and fast)
async function prepPhoto(file) {
  if (!window.createImageBitmap || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob || file;
  } catch { return file; } // e.g. HEIC on a browser that can't read it – upload as is
}

async function setHomePhoto(file) {
  if (!file) return;
  state.photoBusy = true;
  renderView();
  try {
    const blob = await prepPhoto(file);
    const type = blob.type || file.type || 'image/jpeg';
    const ext = type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'img').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `home/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: type });
    if (up.error) throw up.error;
    const old = state.household?.photo_path;
    const row = { id: 1, photo_path: path, photo_by: uid(), photo_at: new Date().toISOString() };
    const { error } = await sb.from('household').upsert(row);
    if (error) { await sb.storage.from(PHOTO_BUCKET).remove([path]); throw error; }
    state.household = { ...(state.household || {}), ...row };
    if (old && old !== path) sb.storage.from(PHOTO_BUCKET).remove([old]);
    toast('Photo updated');
  } catch (err) {
    toast(err.message || 'Upload failed');
  }
  state.photoBusy = false;
  renderView();
}

async function removeHomePhoto() {
  const old = state.household?.photo_path;
  if (!old || !confirm('Remove the photo from the front page?')) return;
  const row = { id: 1, photo_path: null, photo_by: null, photo_at: null };
  const { error } = await sb.from('household').upsert(row);
  if (error) return toast(error.message);
  state.household = { ...(state.household || {}), ...row };
  sb.storage.from(PHOTO_BUCKET).remove([old]);
  renderView();
}

// ---------- Home actions ----------
async function onHomeClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  switch (el.dataset.act) {
    case 'photo': return; // the file input handles itself
    case 'photo-remove': return removeHomePhoto();
    case 'open-list':
      setCurrent(el.dataset.id);
      location.hash = 'shopping';
      return;
    case 'go-shopping':
      location.hash = 'shopping';
      return;
    case 'go-projects':
      // Show the same "live" projects the count refers to
      Object.assign(pv, { room: '', type: '', prio: '', status: 'active' });
      store('pStatus', 'active');
      location.hash = 'projects';
      return;
    case 'task-done': {
      const id = el.closest('[data-id]')?.dataset.id;
      if (!byId(state.ptasks, id)) return;
      await dbUpdate('project_tasks', id, { done: true, done_by: uid(), done_at: new Date().toISOString() });
      toast('Marked as done ✓');
    }
  }
}

function onHomeChange(e) {
  const el = e.target;
  if (el.type === 'file' && el.dataset.act === 'photo') {
    const file = el.files[0];
    el.value = '';
    setHomePhoto(file);
  }
}

// ============================================================
// ---------- Ideas (suggestion box for the app itself) ----------
// ============================================================
const IDEA_STATUSES = [
  { id: 'new', label: 'New' },
  { id: 'planned', label: 'Planned' },
  { id: 'done', label: 'Done' },
  { id: 'declined', label: 'Not now' },
];
const IDEA_FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
  { id: 'declined', label: 'Not now' },
  { id: 'all', label: 'All' },
];
const IDEA_RANK = { planned: 0, new: 1, done: 2, declined: 3 };
const ideaStatusLabel = (id) => IDEA_STATUSES.find((s) => s.id === id)?.label || id;
const iv = { filter: store('ideasFilter') || 'open' };

async function loadIdeas() {
  const { data, error } = await sb.from('suggestions').select('*').order('created_at', { ascending: false });
  if (error) {
    console.warn('Ideas not available:', error);
    state.ideasReady = false;
    state.ideasError = error.message;
    return;
  }
  state.ideasReady = true;
  state.ideas = data;
}

// Reuse the projects helpers for optimistic writes
TABLES.suggestions = 'ideas';

function renderIdeas(keep) {
  const view = $('view');
  if (state.view !== 'ideas') {
    state.view = 'ideas';
    view.onclick = onIdeasClick;
    view.onchange = onIdeasChange;
    view.onsubmit = onIdeasSubmit;
    keep = false;
  }
  const draw = () => { view.innerHTML = state.ideasReady ? ideasHTML() : ideasSetupHTML(); };
  if (keep) keepWhileRendering(view, draw); else draw();
}

function ideasSetupHTML() {
  return `
    <div class="panel setup">
      <h1>Ideas</h1>
      <p>The suggestion box needs its database table first.</p>
      <ol>
        <li>Open Supabase → <b>SQL Editor</b>.</li>
        <li>Paste the contents of <code>supabase/04_suggestions.sql</code> and press <b>Run</b>.</li>
        <li>Come back here and reload the page.</li>
      </ol>
      <p class="muted small">Details: ${esc(state.ideasError)}</p>
    </div>`;
}

function filteredIdeas() {
  const f = iv.filter;
  return state.ideas
    .filter((x) => f === 'all' || (f === 'open' ? (x.status === 'new' || x.status === 'planned') : x.status === f))
    .sort((a, b) => IDEA_RANK[a.status] - IDEA_RANK[b.status]
      || (b.likes?.length || 0) - (a.likes?.length || 0)
      || b.created_at.localeCompare(a.created_at));
}

function ideasHTML() {
  const list = filteredIdeas();
  const count = (fn) => state.ideas.filter(fn).length;
  const counts = {
    open: count((x) => x.status === 'new' || x.status === 'planned'),
    done: count((x) => x.status === 'done'),
    declined: count((x) => x.status === 'declined'),
    all: state.ideas.length,
  };
  const openN = counts.open;
  return `
    <div class="listhead">
      <h1>Ideas</h1>
      ${openN ? `<button class="btn sm" data-act="idea-copy" title="Copy the open ideas as a list">Copy list</button>` : ''}
    </div>
    <p class="muted summary">Suggestions for new features or things to improve in the app.</p>

    <form class="panel ideaform" data-form="idea" autocomplete="off">
      <input name="title" data-keep="idea-title" placeholder="I wish the app could…" maxlength="120" required aria-label="Suggestion">
      <textarea name="details" data-keep="idea-details" rows="2" maxlength="1000" placeholder="Details (optional) – why, how, examples…" aria-label="Details"></textarea>
      <button class="btn primary" type="submit">Add suggestion</button>
    </form>

    <div class="seg" role="group" aria-label="Show">
      ${IDEA_FILTERS.map((f) => `<button class="${iv.filter === f.id ? 'active' : ''}" data-act="idea-filter" data-v="${f.id}">${f.label}${counts[f.id] ? ` · ${counts[f.id]}` : ''}</button>`).join('')}
    </div>

    ${list.length ? `<div class="ideas">${list.map(ideaCard).join('')}</div>`
      : `<div class="empty">${state.ideas.length ? 'Nothing here.' : 'No suggestions yet – add the first one above 💡'}</div>`}`;
}

function ideaCard(x) {
  if (state.editIdea === x.id) {
    return `
      <div class="idea editing" data-id="${x.id}">
        <form class="ideaform" data-form="idea-edit" data-id="${x.id}">
          <input name="title" data-keep="ei-title-${x.id}" value="${esc(x.title)}" maxlength="120" required aria-label="Suggestion">
          <textarea name="details" data-keep="ei-details-${x.id}" rows="3" maxlength="1000" placeholder="Details (optional)" aria-label="Details">${esc(x.details || '')}</textarea>
          <div class="row-actions">
            <button type="button" class="link danger" data-act="idea-del">Delete</button>
            <span></span>
            <button type="button" class="btn sm" data-act="idea-cancel">Cancel</button>
            <button class="btn primary sm" type="submit">Save</button>
          </div>
        </form>
      </div>`;
  }
  const likes = x.likes || [];
  const liked = likes.includes(uid());
  const likers = likes.map((id) => (id === uid() ? 'you' : personName(id))).join(' & ');
  const closed = x.status === 'done' || x.status === 'declined';
  return `
    <div class="idea ${closed ? 'is-closed' : ''}" data-id="${x.id}">
      <div class="idea-top">
        <h4>${esc(x.title)}</h4>
        <select class="idea-status is-${x.status}" data-act="idea-status" aria-label="Status">${enumOptions(IDEA_STATUSES, x.status)}</select>
      </div>
      ${x.details ? `<div class="idea-details">${richText(x.details)}</div>` : ''}
      <div class="idea-foot">
        <button class="like ${liked ? 'on' : ''}" data-act="idea-like" aria-pressed="${liked}" title="${likers ? `Liked by ${esc(likers)}` : 'I want this too'}">👍${likes.length ? ` ${likes.length}` : ''}</button>
        <span class="meta">${esc(personName(x.created_by) || 'someone')} · ${fmtDate(x.created_at.slice(0, 10))}${x.status === 'done' && x.done_at ? ` · done ${fmtDate(x.done_at.slice(0, 10))}` : ''}</span>
        <button class="icon" data-act="idea-edit" title="Edit" aria-label="Edit">✎</button>
      </div>
    </div>`;
}

async function copyIdeas() {
  const open = state.ideas
    .filter((x) => x.status === 'new' || x.status === 'planned')
    .sort((a, b) => IDEA_RANK[a.status] - IDEA_RANK[b.status] || (b.likes?.length || 0) - (a.likes?.length || 0));
  const text = 'Suggestions for the apartment app:\n\n' + open.map((x) =>
    `- ${x.title}${x.status === 'planned' ? ' (planned)' : ''}${x.likes?.length ? ` (👍 ${x.likes.length})` : ''}` +
    `${x.details ? '\n  ' + x.details.replace(/\n/g, '\n  ') : ''}`).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied ${plural(open.length, 'idea')}`);
  } catch {
    toast("Couldn't copy on this device");
  }
}

async function onIdeasClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.closest('[data-id]')?.dataset.id;
  const x = id && byId(state.ideas, id);

  switch (act) {
    case 'idea-filter':
      iv.filter = el.dataset.v; store('ideasFilter', iv.filter); return renderView();
    case 'idea-copy': return copyIdeas();
    case 'idea-like': {
      if (!x) return;
      const likes = x.likes || [];
      const next = likes.includes(uid()) ? likes.filter((u) => u !== uid()) : [...likes, uid()];
      return dbUpdate('suggestions', x.id, { likes: next });
    }
    case 'idea-edit':
      state.editIdea = id; renderView();
      $('view').querySelector(`[data-keep="ei-title-${id}"]`)?.focus();
      return;
    case 'idea-cancel': state.editIdea = null; return renderView();
    case 'idea-del':
      if (!x || !confirm(`Delete the suggestion "${x.title}"?`)) return;
      state.editIdea = null;
      return dbDelete('suggestions', x.id);
  }
}

function onIdeasChange(e) {
  const el = e.target;
  if (el.dataset.act !== 'idea-status') return;
  const x = byId(state.ideas, el.closest('[data-id]')?.dataset.id);
  if (!x || x.status === el.value) return;
  const status = el.value;
  dbUpdate('suggestions', x.id, { status, done_at: status === 'done' ? new Date().toISOString() : null });
  if (status === 'done') toast('Marked as done ✓');
}

async function onIdeasSubmit(e) {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(form));
  const title = f.title.trim();
  if (!title) return;
  const details = f.details.trim() || null;
  if (form.dataset.form === 'idea') {
    form.querySelectorAll('[data-keep]').forEach((el) => { el.value = ''; });
    // Make sure the new idea is visible
    if (iv.filter !== 'open' && iv.filter !== 'all') { iv.filter = 'open'; store('ideasFilter', 'open'); }
    const row = await dbInsert('suggestions', { title, details, created_by: uid() });
    if (row) toast('Thanks! Suggestion added 💡');
    return;
  }
  state.editIdea = null;
  return dbUpdate('suggestions', form.dataset.id, { title, details });
}

// Ctrl/Cmd+Enter in the details box adds the suggestion
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches?.('[data-keep="idea-details"]')) {
    e.target.form.requestSubmit();
  }
});

// Keyboard: Enter on the summary cards
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches?.('.stat[data-act]')) e.target.click();
});

// Ctrl/Cmd+Enter adds a note
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches?.('[data-keep="note-body"]')) {
    e.target.form.requestSubmit();
  }
});

init();
