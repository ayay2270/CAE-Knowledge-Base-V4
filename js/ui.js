/* User interface shell: header, category sidebar, all-articles page, category pages, search results.
   The article page itself (reading view, figures, lightbox) lives in figures.js. */
const C = { view: 'all', cat: null, root: null, drop: -1, hq: '', searchCat: 'all' };

function appMarkup() {
  return `<div class="app c-app" id="app">
  <header class="k-top">
    <button class="k-brand" data-act="cHome" aria-label="CAE Knowledge Base — 所有文章"><img class="k-logo" src="assets/brand/lenovo-logo.png" alt="Lenovo"><span>CAE Knowledge Base</span></button>
    <div class="c-search" id="searchWrap">
      <i class="ti ti-search" aria-hidden="true"></i><input id="q" placeholder="搜尋問題、錯誤碼或關鍵字…" autocomplete="off" role="combobox" aria-label="搜尋知識" aria-expanded="false" aria-controls="cDrop" aria-autocomplete="list"><span class="kbd">${KBH.kbd}</span>
      <div class="c-drop hidden" id="cDrop" role="listbox"></div>
    </div>
    <span class="spacer"></span>
    <span id="acct" class="k-acct"></span>
    <button class="k-add" data-act="kAdd"><i class="ti ti-plus" aria-hidden="true"></i><span>新增知識</span></button>
  </header>
  <div class="k-layout" id="layout">
    <aside class="k-side" id="side" aria-label="知識分類"></aside>
    <main class="k-main" id="detail"></main>
  </div>
</div>`;
}

function wireUi() {
  const q = $('#q');
  q.addEventListener('focus', () => { if (S.q.trim()) cDrop(); });
  q.addEventListener('keydown', e => {
    const items = $$('#cDrop .c-dopt');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!items.length) return; e.preventDefault(); C.drop = (C.drop + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((x, i) => x.classList.toggle('kb', i === C.drop)); }
    if (e.key === 'Enter') { e.preventDefault(); S.q = q.value; C.searchCat = 'all'; const it = C.drop >= 0 ? items[C.drop] : null; if (it) it.click(); else actions.cSearchPage(); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('#searchWrap')) cDropClose(); });
  $('#detail').addEventListener('scroll', cSpy, { passive: true });
  /* landing-page search + sort (delegated: these elements are re-created on every render) */
  document.addEventListener('input', e => {
    if (e.target.id !== 'qHero') return;
    clearTimeout(C.ht); C.ht = setTimeout(() => { C.hq = e.target.value; C.searchCat = 'all'; kAllList(); cRemember(); }, 120);
  });
  document.addEventListener('keydown', e => { if (e.target.id === 'qHero' && e.key === 'Enter') { clearTimeout(C.ht); C.hq = e.target.value; S.q = C.hq; $('#q').value = S.q; C.searchCat = 'all'; actions.cSearchPage(); } if (e.target.id === 'qHero' && e.key === 'Escape') { e.target.value = ''; C.hq = ''; kAllList(); } });
  document.addEventListener('change', e => { if (e.target.id === 'kSort') { S.sort = e.target.value; kRefreshList(); cRemember(); } });
}
function onSearch() { C.drop = -1; C.searchCat = 'all'; if (C.view === 'search') { cDropClose(); renderDetail(); cRemember(); } else cDrop(); }
function cDropClose() { $('#cDrop')?.classList.add('hidden'); $('#q')?.setAttribute('aria-expanded', 'false'); }
function cDrop() {
  const el = $('#cDrop'); if (!el) return;
  if (!S.q.trim()) return cDropClose();
  const f = S.filter; S.filter = 'all'; const arr = visible(); S.filter = f;
  el.innerHTML = arr.length ? arr.slice(0, 7).map(e => `<button class="c-dopt" data-act="cOpen" data-id="${e.id}">
      <span class="c-dpath">${KBH.icon(e.category)}${esc(catInfo(e.category).path)}</span>
      <span class="c-dt">${KBH.hl(e.title)}</span><span class="c-ds">${KBH.hl(KBH.snippet(e, 90))}</span></button>`).join('') +
      `<button class="c-dall" data-act="cSearchPage">查看全部 ${arr.length} 筆結果 <i class="ti ti-arrow-right"></i></button>`
    : `<div class="c-dnone">找不到「${esc(S.q.trim())}」。試試只輸入錯誤代碼或關鍵字。</div>`;
  el.classList.remove('hidden'); $('#q').setAttribute('aria-expanded', 'true');
}

/* ---------- category helpers ---------- */
function cRootOf(e) { const r = rootKey(e.category); return KBH.tree().some(t => t.c.key === r) ? r : '__other'; }
function cEntries(keys) { const f = S.filter, t = S.tag, q = S.q; S.filter = 'all'; S.tag = null; S.q = ''; const a = visible().filter(e => keys.includes(e.category)); S.filter = f; S.tag = t; S.q = q; return a.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-Hant')); }
const C_OTHER = { key: '__other', label: '其他／已隱藏分類', description: '分類已被移除或隱藏的文章' };
function cOrphans() { return S.entries.filter(e => cRootOf(e) === '__other'); }
function cManuals() { const t = KBH.tree(); return cOrphans().length ? [...t, { c: C_OTHER, kids: [] }] : t; }
function cChapters(rootK) {
  if (rootK === '__other') return [{ c: C_OTHER, items: cOrphans(), flat: true }];
  const node = KBH.tree().find(t => t.c.key === rootK);
  if (!node) return [];
  if (node.kids.length) return node.kids.map(k => ({ c: k, items: cEntries([k.key]) }));
  return [{ c: node.c, items: cEntries([node.c.key]), flat: true }];
}
function cCount(k) { return k === '__other' ? cOrphans().length : KBH.count(k); }
function cCatNode(k) { return k === '__other' ? C_OTHER : catByKey(k); }
/* Entries that belong to a category (a root includes all of its children). */
function cCatEntries(k) {
  if (k === '__other') return cOrphans();
  const kids = childrenOf(k, true);
  const keys = kids.length ? descendantKeys(k) : [k];
  return S.entries.filter(e => keys.includes(e.category));
}
const kSorted = arr => [...arr].sort(S.sort === 'title' ? (a, b) => (a.title || '').localeCompare(b.title || '', 'zh-Hant') : (a, b) => new Date(b.updated_at) - new Date(a.updated_at));
/* snippet that ignores the header search query (used in browse lists) */
function kPlainSnippet(e, n) { const q = S.q; S.q = ''; const r = KBH.snippet(e, n); S.q = q; return r; }
/* run a search with a query other than the header's */
function kSearch(text) { const q = S.q, f = S.filter, t = S.tag; S.q = text; S.filter = 'all'; S.tag = null; const r = visible(); S.q = q; S.filter = f; S.tag = t; return r; }

/* ---------- sidebar: 知識分類 ---------- */
function renderSide() {
  const el = $('#side'); if (!el) return;
  const cur = S.entries.find(e => e.id === S.sel);
  const active = C.view === 'article' ? cur?.category : C.view === 'category' ? C.cat : (C.view === 'all' || C.view === 'search') ? 'all' : null;
  const on = k => active === k ? ' on' : '';
  el.innerHTML = `<div class="k-side-h">知識分類</div>
    <button class="k-n k-all${on('all')}" data-act="cHome"${active === 'all' ? ' aria-current="page"' : ''}><i class="ti ti-list-details" aria-hidden="true"></i><span>所有文章</span><em>${S.entries.length}</em></button>` +
    cManuals().map(({ c, kids }) => `<button class="k-n k-root${on(c.key)}" data-act="cCat" data-k="${esc(c.key)}"${active === c.key ? ' aria-current="page"' : ''}>${KBH.icon(c.key)}<span>${esc(c.label)}</span><em>${cCount(c.key)}</em></button>` +
      kids.map(k => `<button class="k-n k-kid${on(k.key)}" data-act="cCat" data-k="${esc(k.key)}"${active === k.key ? ' aria-current="page"' : ''}><span>${esc(k.label)}</span><em>${KBH.count(k.key)}</em></button>`).join('')).join('');
}
function renderList() { renderSide(); }

/* ---------- article rows ---------- */
/* noCat: inside a group the heading already names the category */
function kRow(e, hl, noCat) {
  const p = catInfo(e.category);
  return `<button class="k-row g-${p.group}" data-act="cOpen" data-id="${esc(e.id)}">
    <span class="k-ico">${KBH.icon(e.category)}</span>
    <span class="k-rb"><span class="k-rc">${esc(p.label)}${e._prototype ? '<b class="k-proto">本機原型</b>' : ''}</span><span class="k-rt">${hl ? KBH.hl(e.title) : esc(e.title)}</span><span class="k-rs">${hl ? KBH.hl(KBH.snippet(e, 170)) : esc(kPlainSnippet(e, 170))}</span></span>
    <span class="k-rm"><time datetime="${esc(e.updated_at)}">${fmtDate(e.updated_at)}</time></span>
    <i class="ti ti-chevron-right k-chev" aria-hidden="true"></i></button>`;
}
const kSortSel = () => `<label class="k-sort">排序：<select id="kSort" aria-label="排序"><option value="new" ${S.sort !== 'title' ? 'selected' : ''}>最新更新</option><option value="title" ${S.sort === 'title' ? 'selected' : ''}>標題</option></select></label>`;

/* ---------- 所有文章 (landing) ---------- */
function cAll(el) {
  el.innerHTML = `<div class="k-page"><section class="k-hero"><h1>CAE Knowledge Base</h1><p>記錄・分享・累積 CAE 工程經驗</p>
      <label class="k-hsearch"><i class="ti ti-search" aria-hidden="true"></i><input id="qHero" type="search" placeholder="搜尋問題、錯誤碼或關鍵字…" autocomplete="off" aria-label="搜尋所有文章" value="${esc(C.hq)}"><button data-act="kHeroSearch" aria-label="搜尋"><i class="ti ti-arrow-right" aria-hidden="true"></i></button></label><div class="k-examples">例如：${["penetration", "warped element", "ERROR 1953", "negative volume"].map(t => `<button data-act="kExample" data-q="${t}">${t}</button>`).join("<span>・</span>")}</div></section>
    <div id="kList"></div></div>`;
  kAllList();
}
function kResultList(arr, query) {
  const selected = C.searchCat || 'all';
  const groups = KBH.leaves().map(({c}) => ({c, count: arr.filter(e => e.category === c.key).length})).filter(g => g.count);
  const items = selected === 'all' ? arr : arr.filter(e => e.category === selected);
  const old = S.q; S.q = query;
  const html = `<div class="k-search-tabs" role="group" aria-label="依軟體查看搜尋結果"><button class="${selected === 'all' ? 'on' : ''}" data-act="kSearchCat" data-k="all" aria-pressed="${selected === 'all'}">全部 (${arr.length})</button>${groups.map(({c,count}) => `<button class="${selected === c.key ? 'on' : ''}" data-act="kSearchCat" data-k="${esc(c.key)}" aria-pressed="${selected === c.key}">${esc(c.label)} (${count})</button>`).join('')}</div><div class="k-results" aria-live="polite">${items.length ? items.map(e => kRow(e,true)).join('') : '<p class="k-none">找不到符合的文章。試著只輸入錯誤代碼或一個關鍵字。</p>'}</div>`;
  S.q = old; return html;
}
function kAllList() {
  const box = $('#kList'); if (!box) return;
  const q = C.hq.trim();
  if (q) { const arr = kSearch(q); box.innerHTML = `<div class="k-lh"><h2>搜尋結果</h2><small>「${esc(q)}」・${arr.length} 篇</small></div>` + kResultList(arr,q); }
  else box.innerHTML = `<div class="k-lh"><h2>所有文章</h2><small>${S.entries.length} 篇知識</small>${kSortSel()}</div>` + kSorted(S.entries).map(e => kRow(e)).join('');
  hydrate(box);
}
function kRefreshList() { if (C.view === 'all') kAllList(); else if (C.view === 'category') kCatList(); }

/* ---------- category page ---------- */
function cCategory(el) {
  const k = C.cat, node = cCatNode(k);
  if (!node) { C.view = 'all'; return cAll(el); }
  const kids = k === '__other' ? [] : childrenOf(k, true), parent = node.parent_key ? catByKey(node.parent_key) : null;
  const crumb = [{ t: '所有文章', act: 'cHome' }, ...(parent ? [{ t: parent.label, act: 'cCat', k: parent.key }] : []), { t: node.label }];
  el.innerHTML = `<div class="k-page">${cCrumb(crumb)}
    <header class="k-ch"><span class="k-ico xl g-${visualGroup(k)}">${KBH.icon(k)}</span><div><h1>${esc(node.label)}</h1>${node.description ? `<p>${esc(node.description)}</p>` : ''}</div></header>
    ${kids.length ? `<div class="k-cards">${kids.map(c => `<button class="k-card g-${visualGroup(c.key)}" data-act="cCat" data-k="${esc(c.key)}"><span class="k-ico lg">${KBH.icon(c.key)}</span><span class="k-cb"><b>${esc(c.label)}</b><small>${KBH.count(c.key)} 篇文章</small>${c.description ? `<span class="k-cd">${esc(c.description)}</span>` : ''}</span><span class="k-go" aria-hidden="true"><i class="ti ti-arrow-right"></i></span></button>`).join('')}</div>` : ''}
    <div id="kList"></div></div>`;
  kCatList();
}
function kCatList() {
  const box = $('#kList'); if (!box) return;
  const items = kSorted(cCatEntries(C.cat));
  box.innerHTML = `<div class="k-lh"><h2>文章列表</h2><small>共 ${items.length} 篇文章</small>${kSortSel()}</div>` +
    (items.length ? items.map(e => kRow(e)).join('') : `<p class="k-none">這個分類還沒有文章。</p>`);
}

/* ---------- search results page ---------- */
function cSearchPage(el) {
  const arr = kSearch(S.q);
  el.innerHTML = `<div class="k-page">${cCrumb([{t:'所有文章',act:'cHome'},{t:'搜尋結果'}])}<div class="k-lh"><h1 class="k-search-title">搜尋「${esc(S.q.trim())}」</h1><small>${arr.length} 篇結果</small></div>${kResultList(arr,S.q)}</div>`;
}
function cCrumb(items) { return `<nav class="c-crumb" aria-label="位置">${items.map((x, i) => i < items.length - 1 ? `<button data-act="${x.act}" data-k="${esc(x.k || '')}">${esc(x.t)}</button><i class="ti ti-chevron-right"></i>` : `<span>${esc(x.t)}</span>`).join('')}</nav>`; }

/* History snapshots belong to entries, not renders. Restoration never pushes. */
function cSnapshot() {
  return { kbNav: 1, view: C.view, cat: C.cat, id: S.sel, q: S.q, hq: C.hq,
    searchCat: C.searchCat, sort: S.sort, filter: S.filter, tag: S.tag,
    scroll: $('#detail')?.scrollTop || 0 };
}
function cRouteUrl(state) {
  const base = location.pathname + location.search;
  if (state.view === 'article') return base + '#' + encodeURIComponent(state.id);
  if (state.view === 'category') return base + '#cat/' + encodeURIComponent(state.cat);
  if (state.view === 'search') return base + '#search/' + encodeURIComponent(state.q || '');
  return base;
}
function cRemember() {
  if (!C.historyReady || !['all', 'category', 'article', 'search'].includes(C.view)) return;
  const state = cSnapshot();
  history.replaceState(state, '', cRouteUrl(state));
}
function cFromUrl() {
  let hash; try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = ''; }
  if (hash.startsWith('cat/') && cCatNode(hash.slice(4))) return { view: 'category', cat: hash.slice(4) };
  if (hash.startsWith('search/')) return { view: 'search', q: hash.slice(7) };
  if (S.entries.some(e => e.id === hash)) return { view: 'article', id: hash };
  return { view: 'all' };
}
function cRestore(state) {
  clearTimeout(C.ht);
  const route = state?.kbNav === 1 ? state : cFromUrl();
  C.view = ['all', 'category', 'article', 'search'].includes(route.view) ? route.view : 'all';
  C.cat = route.cat || null;
  S.sel = route.id || null;
  if (C.view === 'category' && !cCatNode(C.cat)) C.view = 'all';
  const entry = S.entries.find(e => e.id === S.sel);
  if (C.view === 'article' && !entry) C.view = 'all';
  C.root = entry ? cRootOf(entry) : null;
  S.gi = 0; S.q = route.q || ''; C.hq = route.hq || '';
  C.searchCat = route.searchCat || 'all'; S.sort = route.sort || 'new';
  S.filter = route.filter || 'all'; S.tag = route.tag || null;
  $('#q').value = S.q; cDropClose();
  renderSide(); renderDetail(true);
  $('#detail').scrollTop = route.scroll || 0; cSpy();
}
function cNavigate(route) {
  clearTimeout(C.ht);
  const previous = cSnapshot();
  cRemember();
  const next = { ...previous, ...route, kbNav: 1, scroll: 0 };
  const same = previous.view === next.view && previous.cat === next.cat && previous.id === next.id &&
    (next.view !== 'search' || (previous.q === next.q && previous.searchCat === next.searchCat));
  if (same) history.replaceState(next, '', cRouteUrl(next));
  else history.pushState(next, '', cRouteUrl(next));
  cRestore(next);
}
window.addEventListener('popstate', event => {
  if (C.historyReady) cRestore(event.state);
});

/* ---------- article open / render dispatch ---------- */
function cOpen(id) {
  const e = S.entries.find(x => x.id === id); if (!e) return;
  cNavigate({ view: 'article', id, cat: null });
}
function renderDetail(resetScroll) {
  const el = $('#detail'); if (!el) return;
  $('#app').classList.toggle('is-add', C.view === 'add');
  if (C.view === 'add') { akRender(el); return; }
  if (!S.entries.length) { el.innerHTML = `<div class="c-page-wrap">${emptyHtml('ti-notebook', '還沒有任何文章', '')}</div>`; return; }
  if (C.view === 'article') {
    const e = S.entries.find(x => x.id === S.sel);
    if (!e) { C.view = 'all'; return renderDetail(resetScroll); }
    cArticle(el, e);
  } else if (C.view === 'category') cCategory(el);
  else if (C.view === 'search') cSearchPage(el);
  else cAll(el);
  hydrate(el);
  if (resetScroll) { C.spyTarget = null; el.scrollTop = 0; }
  cSpy();
}

function cSpy() {
  const main = $('#detail'); const links = $$('.c-toc a[data-act="cJump"]'); if (!links.length) return;
  let cur = links[0].dataset.t;
  for (const a of links) { const s = document.getElementById(a.dataset.t); if (s && s.getBoundingClientRect().top - main.getBoundingClientRect().top < 120) cur = a.dataset.t; }
  if (C.spyTarget && Math.abs(main.scrollTop - C.spyTarget.top) < 2) cur = C.spyTarget.id;
  links.forEach(a => a.classList.toggle('on', a.dataset.t === cur));
}

/* First view: an article or category named in the URL hash, otherwise 所有文章. */
function afterLoad() {
  cRestore(history.state);
  C.historyReady = true;
  cRemember();
}

function cGo(view, cat) {
  cNavigate({ view, cat: cat || null, id: null, searchCat: 'all', ...(view === 'all' ? { hq: '', q: '' } : {}) });
}
Object.assign(actions, {
  cHome: () => cGo('all'),
  cCat: b => cGo('category', b.dataset.k),
  cOpen: b => cOpen(b.dataset.id),
  cJump: b => {
    const section = document.getElementById(b.dataset.t), main = $('#detail');
    if (!section) return;
    const top = Math.max(0, Math.min(main.scrollHeight - main.clientHeight, main.scrollTop + section.getBoundingClientRect().top - main.getBoundingClientRect().top - 24));
    C.spyTarget = { id: b.dataset.t, top };
    main.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    cSpy();
  },
  kSearchCat: b => { C.searchCat = b.dataset.k; if (C.view === 'all') kAllList(); else renderDetail(); cRemember(); },
  kHeroSearch: () => { clearTimeout(C.ht); C.hq = $('#qHero').value; S.q = C.hq; $('#q').value = S.q; C.searchCat = 'all'; actions.cSearchPage(); },
  kExample: b => cNavigate({ view: 'search', id: null, cat: null, q: b.dataset.q, searchCat: 'all' }),
  cSearchPage: () => cNavigate({ view: 'search', id: null, cat: null, q: $('#q').value, searchCat: 'all' }),
  dtag: b => cNavigate({ view: 'search', id: null, cat: null, q: b.dataset.t, searchCat: 'all' })
});
