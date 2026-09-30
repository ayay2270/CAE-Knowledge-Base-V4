/* C2 user interface: software tabs, chapter tree, article pages, search, home / index pages.
   Carried over from the approved Concept C2. */
const C = { root: null, page: 'home', drop: -1, closed: new Set() };


function appMarkup() {
  return `<div class="app c-app" id="app">
  <header class="c-top">
    <button class="c-brand" data-act="cHome">${HEX}<span>CAE Knowledge Base</span><em>Docs</em></button>
    <nav class="c-tabs" id="side" aria-label="軟體手冊"></nav>
    <div class="spacer"></div>
    <div class="c-search" id="searchWrap">
      <i class="ti ti-search"></i><input id="q" placeholder="搜尋文件…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="cDrop"><span class="kbd">${KBH.kbd}</span>
      <div class="c-drop hidden" id="cDrop" role="listbox"></div>
    </div>
  </header>
  <div class="c-layout" id="layout">
    <aside class="c-nav" id="list" aria-label="文件目錄"></aside>
    <main class="c-main" id="detail"></main>
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


/* top tabs = software manuals */
function renderSide() {
  const el = $('#side'); if (!el) return;
  el.innerHTML = `<button class="c-tab ${C.page === 'home' ? 'on' : ''}" data-act="cHome">總覽</button>` +
    cManuals().map(({ c }) => `<button class="c-tab ${C.root === c.key && C.page !== 'home' ? 'on' : ''}" data-act="cRoot" data-k="${esc(c.key)}">${KBH.icon(c.key)}${esc(c.label)}</button>`).join('');
}
function cRootOf(e) { const r = rootKey(e.category); return KBH.tree().some(t => t.c.key === r) ? r : '__other'; }
function cEntries(keys) { const f = S.filter, t = S.tag, q = S.q; S.filter = 'all'; S.tag = null; S.q = ''; const a = visible().filter(e => keys.includes(e.category)); S.filter = f; S.tag = t; S.q = q; return a.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-Hant')); }
const C_OTHER = { key: '__other', label: '其他／已隱藏分類' };
function cOrphans() { return S.entries.filter(e => cRootOf(e) === '__other'); }
function cManuals() { const t = KBH.tree(); return cOrphans().length ? [...t, { c: C_OTHER, kids: [] }] : t; }
function cChapters(rootK) {
  if (rootK === '__other') return [{ c: C_OTHER, items: cOrphans(), flat: true }];
  const node = KBH.tree().find(t => t.c.key === rootK);
  if (!node) return [];
  if (node.kids.length) return node.kids.map(k => ({ c: k, items: cEntries([k.key]) }));
  return [{ c: node.c, items: cEntries([node.c.key]), flat: true }];
}


/* left document tree for the active manual */
function renderList(autoSel) {
  const el = $('#list'); if (!el) return;
  renderSide();
  if (C.page === 'home' || !C.root) {
    el.innerHTML = `<div class="c-nav-h">軟體手冊</div>` + cManuals().map(({ c, kids }) => `<button class="c-nroot" data-act="cRoot" data-k="${esc(c.key)}">${KBH.icon(c.key)}<span>${esc(c.label)}</span><em>${cCount(c.key)}</em></button>
      ${kids.map(k => `<button class="c-nkid" data-act="cRoot" data-k="${esc(c.key)}" data-ch="${esc(k.key)}"><span>${esc(k.label)}</span><em>${KBH.count(k.key)}</em></button>`).join('')}`).join('');
    return;
  }
  const root = catByKey(C.root) || C_OTHER;
  el.innerHTML = `<div class="c-nav-top">${KBH.icon(C.root)}<div><b>${esc(root?.label || '')}</b><span>${cCount(C.root)} 篇文章</span></div></div>
    <button class="c-nlink ${C.page === 'index' ? 'on' : ''}" data-act="cIndex"><i class="ti ti-home-2"></i>手冊首頁</button>` +
    cChapters(C.root).map(ch => {
      const closed = C.closed.has(ch.c.key);
      return `<div class="c-chap">
        ${ch.flat ? `<div class="c-chap-h static">所有文章</div>` : `<button class="c-chap-h" data-act="cChap" data-k="${esc(ch.c.key)}" aria-expanded="${!closed}"><i class="ti ti-chevron-${closed ? 'right' : 'down'}"></i>${esc(ch.c.label)}<em>${ch.items.length}</em></button>`}
        ${closed ? '' : `<div class="c-pages">${ch.items.map(e => `<button class="c-page ${e.id === S.sel && C.page === 'article' ? 'on' : ''}" data-act="cOpen" data-id="${e.id}">${esc(e.title)}</button>`).join('') || '<span class="c-empty">尚無文章</span>'}</div>`}</div>`;
    }).join('');
  el.querySelector('.c-page.on')?.scrollIntoView({ block: 'nearest' });
}

function cOpen(id) {
  const e = S.entries.find(x => x.id === id); if (!e) return;
  S.sel = id; S.gi = 0; C.page = 'article'; C.root = cRootOf(e);
  C.closed.delete(e.category);
  history.replaceState(null, '', '#' + id);
  cDropClose();
  renderList(); renderDetail(true);
}


function cCrumb(items) { return `<nav class="c-crumb" aria-label="位置">${items.map((x, i) => i < items.length - 1 ? `<button data-act="${x.act}" data-k="${esc(x.k || '')}">${esc(x.t)}</button><i class="ti ti-chevron-right"></i>` : `<span>${esc(x.t)}</span>`).join('')}</nav>`; }


function renderDetail(resetScroll) {
  const el = $('#detail'); if (!el) return;
  if (!S.entries.length) { el.innerHTML = `<div class="c-page-wrap">${emptyHtml('ti-notebook', '還沒有任何文章', '')}</div>`; return; }
  if (C.page === 'article') {
    const e = S.entries.find(x => x.id === S.sel);
    if (!e) { C.page = C.root ? 'index' : 'home'; return renderDetail(resetScroll); }
    cArticle(el, e);
  } else if (C.page === 'index') cIndex(el);
  else if (C.page === 'search') cSearchPage(el);
  else cHome(el);
  hydrate(el);
  if (resetScroll) el.scrollTop = 0;
  cSpy();
}


function cCount(k) { return k === '__other' ? cOrphans().length : KBH.count(k); }
function cIndex(el) {
  const root = catByKey(C.root) || C_OTHER;
  const chs = cChapters(C.root);
  el.innerHTML = `<div class="c-page-wrap"><article class="c-article c-index">
    ${cCrumb([{ t: '總覽', act: 'cHome' }, { t: root?.label || '其他' }])}
    <div class="c-ihead">${KBH.icon(C.root)}<div><h1>${esc(root?.label || '其他')} 除錯手冊</h1><p>${cCount(C.root)} 篇文章${chs.length > 1 || !chs[0]?.flat ? `，分為 ${chs.length} 個章節` : ''}。依章節瀏覽，或在右上角搜尋錯誤訊息。</p></div></div>
    ${chs.map(ch => `<section class="c-ichap"><h2>${ch.flat ? '所有文章' : esc(ch.c.label)}<em>${ch.items.length}</em></h2>
      <ol>${ch.items.map(e => `<li><button data-act="cOpen" data-id="${e.id}"><span class="t">${esc(e.title)}</span><span class="s">${esc(KBH.snippet(e, 90))}</span></button></li>`).join('') || '<li class="c-empty">尚無文章</li>'}</ol></section>`).join('')}
  </article><aside class="c-toc"></aside></div>`;
}
function cHome(el) {
  const latest = [...S.entries].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 6);
  el.innerHTML = `<div class="c-page-wrap"><article class="c-article c-home">
    <h1>CAE 除錯知識庫</h1>
    <p class="c-lead">以軟體手冊的方式整理解決過的問題。每篇文章依「現象 → 原因 → 解法」撰寫，並記錄試過但無效的方法。</p>
    <div class="c-manuals">${cManuals().map(({ c, kids }) => `<button class="c-manual" data-act="cRoot" data-k="${esc(c.key)}">
      <span class="c-mi">${KBH.icon(c.key)}</span><b>${esc(c.label)}</b><span>${cCount(c.key)} 篇文章</span>
      ${kids.length ? `<ul>${kids.map(k => `<li>${esc(k.label)}<em>${KBH.count(k.key)}</em></li>`).join('')}</ul>` : '<ul><li>單一章節</li></ul>'}</button>`).join('')}</div>
    <h2>最近更新</h2>
    <ul class="c-changelog">${latest.map(e => `<li><span class="d">${fmtDate(e.updated_at)}</span><button data-act="cOpen" data-id="${e.id}">${esc(e.title)}</button><span class="p">${esc(catInfo(e.category).path)}</span></li>`).join('')}</ul>
  </article><aside class="c-toc"></aside></div>`;
}
function cSearchPage(el) {
  const f = S.filter; S.filter = 'all'; const arr = visible(); S.filter = f;
  el.innerHTML = `<div class="c-page-wrap"><article class="c-article c-index">
    ${cCrumb([{ t: '總覽', act: 'cHome' }, { t: '搜尋結果' }])}
    <h1>搜尋「${esc(S.q.trim())}」</h1><p class="c-lead">${arr.length} 筆結果</p>
    <ol class="c-sres">${arr.map(e => `<li><button data-act="cOpen" data-id="${e.id}"><span class="p">${KBH.icon(e.category)}${esc(catInfo(e.category).path)}</span><span class="t">${KBH.hl(e.title)}</span><span class="s">${KBH.hl(KBH.snippet(e, 160))}</span></button></li>`).join('')}</ol>
  </article><aside class="c-toc"></aside></div>`;
}


function cSpy() {
  const main = $('#detail'); const links = $$('.c-toc a[data-act="cJump"]'); if (!links.length) return;
  let cur = links[0].dataset.t;
  for (const a of links) { const s = document.getElementById(a.dataset.t); if (s && s.getBoundingClientRect().top - main.getBoundingClientRect().top < 120) cur = a.dataset.t; }
  links.forEach(a => a.classList.toggle('on', a.dataset.t === cur));
}


/* First view: the article in the URL hash, otherwise the default sample article, otherwise the home page. */
function afterLoad() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h && S.entries.some(e => e.id === h)) return cOpen(h);
  if (APP.defaultEntryId && S.entries.some(e => e.id === APP.defaultEntryId)) return cOpen(APP.defaultEntryId);
  C.page = 'home'; renderList(); renderDetail(true);
}

Object.assign(actions, {
  cHome: () => { C.page = 'home'; S.sel = null; history.replaceState(null, '', location.pathname + location.search); renderList(); renderDetail(true); },
  cRoot: b => { C.root = b.dataset.k; C.page = 'index'; S.sel = null; if (b.dataset.ch) C.closed.delete(b.dataset.ch); history.replaceState(null, '', location.pathname + location.search); renderList(); renderDetail(true); },
  cIndex: () => { C.page = 'index'; renderList(); renderDetail(true); },
  cOpen: b => cOpen(b.dataset.id),
  cChap: b => { const k = b.dataset.k; C.closed.has(k) ? C.closed.delete(k) : C.closed.add(k); renderList(); },
  cJump: b => { document.getElementById(b.dataset.t)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  cSearchPage: () => { C.page = 'search'; cDropClose(); renderList(); renderDetail(true); },
  dtag: b => { $('#q').value = b.dataset.t; S.q = b.dataset.t; C.page = 'search'; renderList(); renderDetail(true); }
});
;
