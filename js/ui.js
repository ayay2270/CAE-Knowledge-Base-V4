/* User interface shell: header, category sidebar, all-articles page, category pages, search results.
   The article page itself (reading view, figures, lightbox) lives in figures.js. */
const C = { view: 'all', cat: null, root: null, drop: -1, hq: '' };

function appMarkup() {
  return `<div class="app c-app" id="app">
  <header class="k-top">
    <button class="k-brand" data-act="cHome" aria-label="CAE Knowledge Base — 所有文章"><img class="k-logo" src="assets/brand/lenovo-logo.png" alt="Lenovo"><span>CAE Knowledge Base</span></button>
    <div class="c-search" id="searchWrap">
      <i class="ti ti-search" aria-hidden="true"></i><input id="q" placeholder="搜尋錯誤碼、現象、關鍵字… 例如：free edges、ERROR 1953、negative volume" autocomplete="off" role="combobox" aria-label="搜尋知識" aria-expanded="false" aria-controls="cDrop"><span class="kbd">${KBH.kbd}</span>
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
    if (e.key === 'Enter') { e.preventDefault(); const it = items[Math.max(0, C.drop)]; if (it) it.click(); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('#searchWrap')) cDropClose(); });
  $('#detail').addEventListener('scroll', cSpy, { passive: true });
  /* landing-page search + sort (delegated: these elements are re-created on every render) */
  document.addEventListener('input', e => {
    if (e.target.id !== 'qHero') return;
    clearTimeout(C.ht); C.ht = setTimeout(() => { C.hq = e.target.value; kAllList(); }, 120);
  });
  document.addEventListener('keydown', e => { if (e.target.id === 'qHero' && e.key === 'Escape') { e.target.value = ''; C.hq = ''; kAllList(); } });
  document.addEventListener('change', e => { if (e.target.id === 'kSort') { S.sort = e.target.value; kRefreshList(); } });
}
function onSearch() { C.drop = -1; cDrop(); }
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
  const p = catInfo(e.category), tags = (e.tags || []).slice(0, 4).map(t => `<span class="k-tag">${esc(t)}</span>`).join('');
  return `<button class="k-row g-${p.group}" data-act="cOpen" data-id="${e.id}">
    <span class="k-ico">${KBH.icon(e.category)}</span>
    <span class="k-rb">${noCat && !e._prototype ? '' : `<span class="k-rc">${noCat ? '' : esc(p.label)}${e._prototype ? '<b class="k-proto">本機原型</b>' : ''}</span>`}<span class="k-rt">${hl ? KBH.hl(e.title) : esc(e.title)}</span><span class="k-rs">${hl ? KBH.hl(KBH.snippet(e, 130)) : esc(kPlainSnippet(e, 130))}</span></span>
    <span class="k-rm"><span class="k-tags">${tags}</span><time datetime="${esc(e.updated_at)}">${fmtDate(e.updated_at)}</time></span>
    <i class="ti ti-chevron-right k-chev" aria-hidden="true"></i></button>`;
}
const kSortSel = () => `<label class="k-sort">排序：<select id="kSort" aria-label="排序"><option value="new" ${S.sort !== 'title' ? 'selected' : ''}>最新更新</option><option value="title" ${S.sort === 'title' ? 'selected' : ''}>標題</option></select></label>`;

/* ---------- 所有文章 (landing) ---------- */
function cAll(el) {
  el.innerHTML = `<div class="k-page"><section class="k-hero"><h1>CAE Knowledge Base</h1><p>快速找到曾經解決過的 CAE 問題</p>
      <label class="k-hsearch"><i class="ti ti-search" aria-hidden="true"></i><input id="qHero" type="search" placeholder="搜尋錯誤碼、現象、關鍵字… 例如：free edges、ERROR 1953、negative volume" autocomplete="off" aria-label="搜尋所有文章" value="${esc(C.hq)}"></label></section>
    <div id="kList"></div></div>`;
  kAllList();
}
function kAllList() {
  const box = $('#kList'); if (!box) return;
  const q = C.hq.trim();
  if (q) {
    const arr = kSearch(q);
    box.innerHTML = `<div class="k-lh"><h2>搜尋結果</h2><small>「${esc(q)}」共 ${arr.length} 筆</small></div>` +
      (arr.length ? arr.map(e => { const s = S.q; S.q = q; const h = kRow(e, true); S.q = s; return h; }).join('') : `<p class="k-none">找不到符合的文章。試著只輸入錯誤代碼或一個關鍵字。</p>`);
    return;
  }
  const groups = KBH.leaves().map(({ c }) => ({ c, items: kSorted(S.entries.filter(e => e.category === c.key)) }));
  if (cOrphans().length) groups.push({ c: C_OTHER, items: kSorted(cOrphans()) });
  box.innerHTML = `<div class="k-lh"><h2>所有文章</h2><small>共 ${S.entries.length} 篇知識</small>${kSortSel()}</div>` +
    groups.filter(g => g.items.length).map(g => `<section class="k-group" aria-label="${esc(g.c.label)}"><h3 class="k-gh">${KBH.icon(g.c.key)}${esc(g.c.label)}<em>${g.items.length}</em></h3>${g.items.map(e => kRow(e, false, true)).join('')}</section>`).join('');
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
  const f = S.filter; S.filter = 'all'; const arr = visible(); S.filter = f;
  el.innerHTML = `<div class="k-page">${cCrumb([{ t: '所有文章', act: 'cHome' }, { t: '搜尋結果' }])}
    <div class="k-lh"><h2>搜尋「${esc(S.q.trim())}」</h2><small>${arr.length} 筆結果</small></div>
    ${arr.length ? arr.map(e => kRow(e, true)).join('') : `<p class="k-none">找不到符合的文章。試著只輸入錯誤代碼或一個關鍵字。</p>`}</div>`;
}
function cCrumb(items) { return `<nav class="c-crumb" aria-label="位置">${items.map((x, i) => i < items.length - 1 ? `<button data-act="${x.act}" data-k="${esc(x.k || '')}">${esc(x.t)}</button><i class="ti ti-chevron-right"></i>` : `<span>${esc(x.t)}</span>`).join('')}</nav>`; }

/* ---------- article open / render dispatch ---------- */
function cOpen(id) {
  const e = S.entries.find(x => x.id === id); if (!e) return;
  S.sel = id; S.gi = 0; C.view = 'article'; C.root = cRootOf(e);
  history.replaceState(null, '', '#' + id);
  cDropClose();
  renderSide(); renderDetail(true);
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
  if (resetScroll) el.scrollTop = 0;
  cSpy();
}

function cSpy() {
  const main = $('#detail'); const links = $$('.c-toc a[data-act="cJump"]'); if (!links.length) return;
  let cur = links[0].dataset.t;
  for (const a of links) { const s = document.getElementById(a.dataset.t); if (s && s.getBoundingClientRect().top - main.getBoundingClientRect().top < 120) cur = a.dataset.t; }
  links.forEach(a => a.classList.toggle('on', a.dataset.t === cur));
}

/* First view: an article or category named in the URL hash, otherwise 所有文章. */
function afterLoad() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('cat/') && (cCatNode(h.slice(4)))) { C.view = 'category'; C.cat = h.slice(4); }
  else if (h && S.entries.some(e => e.id === h)) return cOpen(h);
  renderSide(); renderDetail(true);
}

function cGo(view, cat) {
  C.view = view; C.cat = cat || null; S.sel = null; cDropClose();
  history.replaceState(null, '', view === 'category' ? '#cat/' + cat : location.pathname + location.search);
  renderSide(); renderDetail(true);
}
Object.assign(actions, {
  cHome: () => cGo('all'),
  cCat: b => cGo('category', b.dataset.k),
  cOpen: b => cOpen(b.dataset.id),
  cJump: b => { document.getElementById(b.dataset.t)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  cSearchPage: () => { C.view = 'search'; S.sel = null; cDropClose(); renderSide(); renderDetail(true); },
  dtag: b => { $('#q').value = b.dataset.t; S.q = b.dataset.t; C.view = 'search'; S.sel = null; renderSide(); renderDetail(true); }
});
