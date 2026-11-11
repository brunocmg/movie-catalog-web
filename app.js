'use strict';

const $ = (id) => document.getElementById(id);
const cfg = window.CONFIG;
const LS = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } },
};

const state = { view: 'catalog', offset: 0, total: 0, tokens: null, user: null, mode: 'login' };

/* ---------- API ---------- */
const apiUrl = () => (LS.get('apiUrl') || cfg.API_URL).replace(/\/+$/, '');

async function raw(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && state.tokens) headers.Authorization = `Bearer ${state.tokens.accessToken}`;
  let res;
  try {
    res = await fetch(apiUrl() + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Não foi possível conectar à API. Se ela está no plano free do Render, pode levar ~1 min para acordar.');
  }
  return res;
}

let refreshing = null;
async function refreshTokens() {
  if (!state.tokens) return false;
  // refresh tokens são de uso único: evita duas chamadas simultâneas
  refreshing ??= (async () => {
    const res = await raw('/auth/refresh', { method: 'POST', body: { refreshToken: state.tokens.refreshToken } });
    if (!res.ok) { setSession(null); return false; }
    setSession({ ...state.tokens, ...(await res.json()) }, state.user);
    return true;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function api(path, opts = {}) {
  let res = await raw(path, opts);
  if (res.status === 401 && opts.auth && (await refreshTokens())) res = await raw(path, opts);
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const j = await res.json();
      msg = Array.isArray(j.message) ? j.message.join('; ') : j.message || msg;
    } catch { /* corpo vazio */ }
    if (res.status === 429) msg = 'Muitas tentativas. Aguarde um instante.';
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

/* ---------- Sessão ---------- */
function setSession(tokens, user) {
  state.tokens = tokens;
  state.user = tokens ? user : null;
  LS.set('session', tokens ? JSON.stringify({ tokens, user }) : null);
  renderUser();
  if (!tokens && state.view !== 'catalog') setView('catalog');
}

function renderUser() {
  const logged = !!state.tokens;
  $('userName').textContent = logged ? state.user?.name || '' : '';
  $('loginBtn').classList.toggle('hidden', logged);
  $('logoutBtn').classList.toggle('hidden', !logged);
  document.querySelectorAll('.auth-only').forEach((b) => b.classList.toggle('hidden', !logged));
}

async function login(email, password) {
  const r = await api('/auth/login', { method: 'POST', body: { email, password } });
  setSession(r, r.user);
}

/* ---------- Utilidades ---------- */
function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.className = 'toast'), 3500);
}

function el(tag, props = {}, ...children) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children.filter((c) => c != null));
  return e;
}

const posterEl = (title) =>
  title.posterUrl
    ? el('img', { className: 'poster', src: title.posterUrl, alt: title.name, loading: 'lazy' })
    : el('div', { className: 'poster' }, title.type === 'SERIES' ? '📺' : '🎞️');

const ratingText = (r) => (r?.average != null ? `★ ${r.average} (${r.count})` : 'sem notas');

/* ---------- Catálogo ---------- */
function card(title) {
  const c = el('div', { className: 'card', tabIndex: 0 },
    posterEl(title),
    el('div', { className: 'info' },
      el('div', { className: 'name', title: title.name }, title.name),
      el('div', { className: 'meta' }, el('span', {}, `${title.year}${title.type === 'SERIES' ? ' · série' : ''}`), el('span', { className: 'score' }, ratingText(title.rating))),
    ));
  c.onclick = () => openDetail(title.id);
  c.onkeydown = (e) => e.key === 'Enter' && openDetail(title.id);
  return c;
}

async function load() {
  const size = cfg.PAGE_SIZE;
  const p = new URLSearchParams({ limit: size, offset: state.offset });
  let path;
  if (state.view === 'catalog') {
    const [sortBy, order] = $('sort').value.split(':');
    p.set('sortBy', sortBy); p.set('order', order);
    if ($('q').value.trim()) p.set('q', $('q').value.trim());
    if ($('genre').value) p.set('genre', $('genre').value);
    if ($('type').value) p.set('type', $('type').value);
    path = '/titles';
  } else {
    if ($('type').value) p.set('type', $('type').value);
    path = { watchlist: '/me/watchlist', favorites: '/me/favorites', ratings: '/me/ratings' }[state.view];
  }

  $('status').textContent = 'Carregando…';
  $('grid').replaceChildren();
  try {
    const { data, meta } = await api(`${path}?${p}`, { auth: state.view !== 'catalog' });
    state.total = meta.total;
    // as listas pessoais devolvem { title, ... }; o catálogo devolve o título direto
    const titles = data.map((d) => d.title ?? d);
    $('grid').replaceChildren(...titles.map(card));
    $('status').textContent = titles.length ? `${meta.total} resultado(s)` : 'Nada por aqui ainda.';
  } catch (e) {
    $('status').textContent = e.message;
    state.total = 0;
  }
  const page = Math.floor(state.offset / size) + 1;
  const pages = Math.max(1, Math.ceil(state.total / size));
  $('pageInfo').textContent = `Página ${page} de ${pages}`;
  $('prev').disabled = state.offset === 0;
  $('next').disabled = state.offset + size >= state.total;
}

function setView(view) {
  state.view = view;
  state.offset = 0;
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const catalog = view === 'catalog';
  ['q', 'genre', 'sort'].forEach((id) => $(id).classList.toggle('hidden', !catalog));
  load();
}

async function loadGenres() {
  try {
    const genres = await api('/genres');
    $('genre').append(...genres.map((g) => el('option', { value: g.slug ?? g.name, textContent: g.name })));
  } catch { /* o catálogo funciona sem o filtro */ }
}

/* ---------- Detalhe ---------- */
async function openDetail(id) {
  const dlg = $('detail');
  dlg.replaceChildren(el('p', {}, 'Carregando…'));
  dlg.showModal();
  try {
    const logged = !!state.tokens;
    const [t, reviews, cast, myRating, favs, wl] = await Promise.all([
      api(`/titles/${id}`),
      api(`/titles/${id}/reviews?limit=5`).catch(() => ({ data: [] })),
      api(`/titles/${id}/cast`).catch(() => []),
      logged ? api(`/me/ratings/${id}`, { auth: true }).catch(() => null) : null,
      logged ? api('/me/favorites?limit=100', { auth: true }).catch(() => null) : null,
      logged ? api('/me/watchlist?limit=100', { auth: true }).catch(() => null) : null,
    ]);
    let isFav = !!favs?.data.some((f) => f.title.id === id);
    let inWl = !!wl?.data.some((w) => w.title.id === id);

    const favBtn = el('button', {}, '');
    const wlBtn = el('button', {}, '');
    const paint = () => {
      favBtn.textContent = isFav ? '♥ Favorito' : '♡ Favoritar';
      favBtn.classList.toggle('on', isFav);
      wlBtn.textContent = inWl ? '✓ Na lista' : '+ Quero ver';
      wlBtn.classList.toggle('on', inWl);
    };
    paint();
    const toggle = (path, get, set) => async () => {
      try {
        await api(path, { method: get() ? 'DELETE' : 'PUT', auth: true, body: path.includes('watchlist') && !get() ? {} : undefined });
        set(!get()); paint();
      } catch (e) { toast(e.message, true); }
    };
    favBtn.onclick = toggle(`/me/favorites/${id}`, () => isFav, (v) => (isFav = v));
    wlBtn.onclick = toggle(`/me/watchlist/${id}`, () => inWl, (v) => (inWl = v));

    const score = el('select', {}, ...Array.from({ length: 10 }, (_, i) => el('option', { value: i + 1, textContent: i + 1 })));
    score.value = myRating?.score ?? 8;
    const review = el('textarea', { placeholder: 'Review (opcional)', maxLength: 2000, value: myRating?.review ?? '' });
    const rateBtn = el('button', { className: 'primary' }, 'Salvar nota');
    rateBtn.onclick = async () => {
      try {
        await api(`/me/ratings/${id}`, { method: 'PUT', auth: true, body: { score: Number(score.value), review: review.value } });
        toast('Nota salva!');
        openDetail(id);
      } catch (e) { toast(e.message, true); }
    };

    const close = el('button', { className: 'close' }, '✕');
    close.onclick = () => dlg.close();

    dlg.replaceChildren(close, el('div', { className: 'detail' },
      posterEl(t),
      el('div', {},
        el('h2', {}, t.name),
        el('div', { className: 'muted' }, [t.year, t.type === 'SERIES' ? 'Série' : 'Filme', t.runtimeMinutes && `${t.runtimeMinutes} min`, t.director].filter(Boolean).join(' · ')),
        el('div', { className: 'tags' }, ...t.genres.map((g) => el('span', { className: 'tag' }, g))),
        el('div', { className: 'score' }, ratingText(t.rating)),
        el('p', {}, t.synopsis || 'Sem sinopse.'),
        cast.length ? el('div', { className: 'muted' }, 'Elenco: ' + cast.slice(0, 8).map((c) => c.name).join(', ')) : null,
        logged
          ? el('div', { className: 'section' },
              el('div', { className: 'row' }, favBtn, wlBtn),
              el('h3', { style: 'margin-top:16px' }, 'Sua nota'),
              el('div', { className: 'rate' }, score, rateBtn, review))
          : el('p', { className: 'muted section' }, 'Entre para favoritar, avaliar e montar sua lista.'),
        el('div', { className: 'section' },
          el('h3', {}, 'Reviews'),
          ...(reviews.data.length
            ? reviews.data.map((r) => el('div', { className: 'review' }, el('strong', {}, r.user.name), ' ', el('span', { className: 'score' }, `★ ${r.score}`), el('div', {}, r.review)))
            : [el('p', { className: 'muted' }, 'Ainda sem reviews.')])),
      )));
  } catch (e) {
    dlg.replaceChildren(el('p', { className: 'error' }, e.message), el('button', { onclick: () => dlg.close() }, 'Fechar'));
  }
}

/* ---------- Login / cadastro ---------- */
function openAuth(mode = 'login') {
  state.mode = mode;
  const reg = mode === 'register';
  $('authTitle').textContent = reg ? 'Criar conta' : 'Entrar';
  $('authSubmit').textContent = reg ? 'Cadastrar' : 'Entrar';
  $('authSwitch').textContent = reg ? 'Já tenho conta' : 'Criar uma conta';
  $('nameRow').classList.toggle('hidden', !reg);
  $('aName').required = reg;
  $('authError').textContent = '';
  $('authDialog').showModal();
}

async function submitAuth(e) {
  e.preventDefault();
  const btn = $('authSubmit');
  btn.disabled = true;
  $('authError').textContent = '';
  try {
    const email = $('aEmail').value, password = $('aPass').value;
    if (state.mode === 'register') {
      await api('/users', { method: 'POST', body: { name: $('aName').value, email, password } });
    }
    await login(email, password);
    $('authDialog').close();
    toast('Bem-vindo!');
    load();
  } catch (err) {
    $('authError').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Eventos ---------- */
$('nav').onclick = (e) => e.target.dataset.view && setView(e.target.dataset.view);
$('loginBtn').onclick = () => openAuth('login');
$('logoutBtn').onclick = async () => {
  const rt = state.tokens?.refreshToken;
  setSession(null);
  if (rt) raw('/auth/logout', { method: 'POST', body: { refreshToken: rt } }).catch(() => {});
  load();
};
$('authForm').onsubmit = submitAuth;
$('authCancel').onclick = () => $('authDialog').close();
$('authSwitch').onclick = () => openAuth(state.mode === 'login' ? 'register' : 'login');
$('demoBtn').onclick = async () => {
  try {
    await login(cfg.DEMO_USER.email, cfg.DEMO_USER.password);
    $('authDialog').close();
    toast('Logado como conta demo');
    load();
  } catch (e) { $('authError').textContent = e.message; }
};
$('apiBtn').onclick = () => {
  const v = prompt('URL base da API:', apiUrl());
  if (v) { LS.set('apiUrl', v.trim()); location.reload(); }
};

let debounce;
$('q').oninput = () => { clearTimeout(debounce); debounce = setTimeout(() => { state.offset = 0; load(); }, 300); };
['genre', 'sort', 'type'].forEach((id) => ($(id).onchange = () => { state.offset = 0; load(); }));
$('prev').onclick = () => { state.offset = Math.max(0, state.offset - cfg.PAGE_SIZE); load(); window.scrollTo(0, 0); };
$('next').onclick = () => { state.offset += cfg.PAGE_SIZE; load(); window.scrollTo(0, 0); };
[$('detail'), $('authDialog')].forEach((d) => d.addEventListener('click', (e) => e.target === d && d.close()));

/* ---------- Init ---------- */
(function init() {
  $('docsLink').href = apiUrl() + '/docs';
  try {
    const s = JSON.parse(LS.get('session') || 'null');
    if (s?.tokens) { state.tokens = s.tokens; state.user = s.user; }
  } catch { /* sessão corrompida */ }
  renderUser();
  loadGenres();
  load();
})();
