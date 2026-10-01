/* Core: application state, software-category helpers, text helpers.
   Code is carried over unchanged from the approved Concept C2 except that data now comes
   from the data provider (js/data-provider.js). */

/* Software icons — original assets, unchanged. */
const ICON = { hm: 'assets/icons/hypermesh.png', ls: 'assets/icons/lsdyna.png' };

/* Software / sub-software tree (filled from the data provider). */
let CATS = [];
function catByKey(key) { return CATS.find(c => c.key === key); }
function sortCats(list) { return [...list].sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key)); }
function activeCats() { return sortCats(CATS.filter(c => c.is_active)); }
function shownCats() { return activeCats().filter(c => c.key !== 'hypermesh'); }
function childrenOf(key, activeOnly = true) {
  return sortCats(CATS.filter(c => c.parent_key === key && (!activeOnly || c.is_active)));
}
function isLeaf(c) { return c && !childrenOf(c.key, true).length; }
function descendantKeys(key) {
  const out = [];
  for (const c of childrenOf(key, true)) {
    if (isLeaf(c)) out.push(c.key);
    else out.push(...descendantKeys(c.key));
  }
  return out;
}
function rootKey(key) {
  let c = catByKey(key), guard = 0, seen = new Set();
  while (c && c.parent_key && !seen.has(c.key) && guard++ < 12) { seen.add(c.key); c = catByKey(c.parent_key); }
  return c?.key || key;
}
function visualGroup(key) {
  const root = rootKey(key);
  if (root === 'lsdyna' || key === 'lsdyna') return 'ls';
  if (root === 'hm' || key === 'hm') return 'hm';
  return 'x';
}
function catInfo(category) {
  const c = catByKey(category);
  if (!c) return { group: 'x', path: '已隱藏的分類', label: '已隱藏的分類', parent: null };
  const parent = c.parent_key ? catByKey(c.parent_key) : null;
  let path = c.label;
  if (c.key === 'hypermesh' && parent) path = parent.label;
  else if (parent && parent.is_active) path = `${parent.label} › ${c.label}`;
  return { group: visualGroup(c.key), path, label: c.label, parent: c.parent_key };
}

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));


/* Application state. */
const S = { entries: [], filter: 'all', tag: null, q: '', sort: 'new', sel: null, gi: 0 };


/* ---------- filtering and search ---------- */
function inFilter(e, f = S.filter) {
  if (f === 'all') return true;
  const node = catByKey(f);
  if (node && !isLeaf(node)) return descendantKeys(f).includes(e.category);
  return e.category === f;
}
function terms(q) {
  q = (q || '').toLowerCase().trim();
  if (!q) return [];
  const parts = q.split(/[\s,;:()\[\]{}"'=<>|\/\\*!?。，、：；（）]+/)
    .filter(t => (t.length >= 2 || /[\u4e00-\u9fff]/.test(t)) && !/^[\d.+\-e]+$/.test(t));
  return [...new Set(parts)].slice(0, 40);
}
function hay(e) {
  return [e.title, (e.tags || []).join(' '), e.symptom, e.root_cause, e.solution, (e.failed_attempts || []).join(' '), e.notes, e.reference_source || ''].join('\n').toLowerCase();
}
function visible() {
  let arr = S.entries.filter(e => inFilter(e));
  if (S.tag) arr = arr.filter(e => (e.tags || []).includes(S.tag));
  const ts = terms(S.q);
  if (ts.length) {
    const need = ts.length <= 3 ? ts.length : Math.max(2, Math.ceil(ts.length * 0.25));
    return arr.map(e => {
      const h = hay(e), ti = (e.title || '').toLowerCase();
      let s = 0, hit = 0;
      for (const x of ts) if (h.includes(x)) { hit++; s += ti.includes(x) ? 3 : 1; }
      return { e, s, hit };
    }).filter(o => o.hit >= need).sort((a, b) => b.s - a.s).map(o => o.e);
  }
  const sorters = {
    new: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
    title: (a, b) => (a.title || '').localeCompare(b.title || '', 'zh-Hant')
  };
  return arr.sort(sorters[S.sort] || sorters.new);
}


/* ---------- formatting helpers ---------- */
function fmtDate(d) {
  const x = new Date(d);
  return `${x.getFullYear()}/${String(x.getMonth() + 1).padStart(2, '0')}/${String(x.getDate()).padStart(2, '0')}`;
}
function emptyHtml(icon, title, body, action = '') {
  return `<div class="empty"><i class="ti ${icon}"></i><b>${title}</b>${body}${action}</div>`;
}
function inline(s) {
  return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
function md(src) {
  if (!src || !src.trim()) return '';
  let out = '', list = null, listTag = 'ul', para = [];
  const flushP = () => { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
  const flushL = () => { if (list) { out += `<${listTag}>` + list.map(x => '<li>' + inline(x) + '</li>').join('') + `</${listTag}>`; list = null; } };
  for (const ln of esc(src).split('\n')) {
    const bullet = ln.match(/^\s*[-*•]\s+(.*)$/);
    const num = ln.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const tag = bullet ? 'ul' : 'ol';
      if (list && listTag !== tag) flushL();
      flushP();
      listTag = tag;
      (list = list || []).push((bullet || num)[1]);
    } else if (!ln.trim()) { flushP(); flushL(); }
    else { flushL(); para.push(ln); }
  }
  flushP(); flushL();
  return out;
}

let toastT;
function toast(msg, bad) {
  $('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), bad ? 5000 : 2200);
}

/* Images stored by the data provider (data-path attributes) are resolved through KBData. */
async function hydrate(root) {
  const imgs = $$('img[data-path]', root);
  if (!imgs.length) return;
  await KBData.prepareImages([...new Set(imgs.map(i => i.dataset.path))]);
  imgs.forEach(i => { i.src = KBData.imageUrl(i.dataset.path); });
}

/* ---------- view helpers ---------- */
const KB_LABELS = { symptom: '問題現象', root_cause: '原因分析', solution: '解決方法' };
const KBH = {
  /* Software icons (HyperMesh / LS-DYNA): original files, never recoloured. */
  icon(key) {
    const g = visualGroup(key);
    if (g === 'hm') return `<img class="sw-ico" src="${ICON.hm}" alt="">`;
    if (g === 'ls') return `<img class="sw-ico" src="${ICON.ls}" alt="">`;
    return '<i class="ti ti-box sw-ico-f" aria-hidden="true"></i>';
  },
  count(k) { return S.entries.filter(e => inFilter(e, k)).length; },
  /* Software tree: roots with their children, in sort order. */
  tree() {
    const roots = shownCats().filter(c => !c.parent_key);
    const placed = new Set(), out = [];
    for (const r of roots) {
      placed.add(r.key);
      const kids = childrenOf(r.key, true).filter(k => k.key !== 'hypermesh');
      kids.forEach(k => placed.add(k.key));
      out.push({ c: r, kids });
    }
    for (const c of shownCats()) if (!placed.has(c.key)) out.push({ c, kids: [] });
    return out;
  },
  /* Leaf categories in tree order: [{c, parent}] */
  leaves() {
    const out = [];
    for (const { c, kids } of KBH.tree()) {
      if (kids.length) kids.forEach(k => out.push({ c: k, parent: c }));
      else out.push({ c, parent: null });
    }
    return out;
  },
  plain(s) { return String(s || '').replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^\s*([-*•]|\d+[.)])\s+/gm, '').replace(/\s+/g, ' ').trim(); },
  hl(text) {
    let h = esc(text);
    const ts = terms(S.q).filter(t => t.length >= 2 || /[一-鿿]/.test(t)).sort((a, b) => b.length - a.length);
    if (!ts.length) return h;
    const re = new RegExp('(' + ts.map(t => esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return h.replace(re, '<mark>$1</mark>');
  },
  snippet(e, n = 110) {
    const ts = terms(S.q);
    const fields = [e.symptom, e.root_cause, e.solution, e.notes].map(KBH.plain).filter(Boolean);
    let src = fields[0] || '';
    if (ts.length) {
      const hit = fields.find(f => ts.some(t => f.toLowerCase().includes(t)));
      if (hit) {
        const i = Math.max(0, Math.min(...ts.map(t => { const k = hit.toLowerCase().indexOf(t); return k < 0 ? 1e9 : k; })) - 30);
        src = (i > 0 ? '…' : '') + hit.slice(i);
      }
    }
    return src.length > n ? src.slice(0, n) + '…' : src;
  },
  /* Parts of an entry that the article view renders. */
  parts(e) {
    const c = catInfo(e.category), g = c.group;
    const pending = '<span class="pending">尚未填寫</span>';
    const fails = (e.failed_attempts || []).filter(s => s && s.trim());
    const note = e.notes && e.notes.trim() ? e.notes : '';
    const ref = (e.reference_source || '').trim();
    return {
      c, g, fails, note, ref,
      sections: [
        { id: 'symptom', n: '1', label: KB_LABELS.symptom, color: 'var(--orange)', ink: '#C2410C', html: md(e.symptom) || pending, empty: !md(e.symptom) },
        { id: 'root_cause', n: '2', label: KB_LABELS.root_cause, color: 'var(--blue)', ink: '#1D4ED8', html: md(e.root_cause) || pending, empty: !md(e.root_cause) },
        { id: 'solution', n: '3', label: KB_LABELS.solution, color: 'var(--green)', ink: '#047857', html: md(e.solution) || pending, empty: !md(e.solution) }
      ],
      tags: (e.tags || []).map(t => `<button class="tag" data-act="dtag" data-t="${esc(t)}">#${esc(t)}</button>`).join(''),
      actions: `<button class="btn" data-act="copylink" title="複製連結" aria-label="複製連結"><i class="ti ti-link"></i></button>` + (KBData.canDelete && KBData.canDelete(e.id) ? `<button class="btn" data-act="kEdit" data-id="${esc(e.id)}" title="編輯這篇知識" aria-label="編輯這篇知識"><i class="ti ti-pencil"></i></button><button class="btn danger" data-act="kDelete" data-id="${esc(e.id)}" title="刪除這篇知識" aria-label="刪除這篇知識"><i class="ti ti-trash"></i></button>` : ''),
      failsHtml: fails.length ? `<ul>${fails.map(f => `<li>${inline(esc(f))}</li>`).join('')}</ul>` : '',
      noteHtml: note ? md(note) : '',
      refHtml: ref ? md(ref) : ''
    };
  },
  wireSearch() {
    const q = $('#q');
    if (!q) return;
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { S.q = q.value; onSearch(); }, 120); });
    q.addEventListener('keydown', e => { if (e.key === 'Escape') { q.value = ''; S.q = ''; onSearch(); q.blur(); } });
  },
  kbd: IS_MAC ? '⌘K' : 'Ctrl K',
  kbd: IS_MAC ? '⌘K' : 'Ctrl K',
};

/* ---------- click / keyboard dispatch ---------- */
const actions = {
  copylink: () => { navigator.clipboard?.writeText(location.href).then(() => toast('已複製連結'), () => toast('無法複製，請手動複製網址列', true)); }
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a && actions[a.dataset.act]) { e.preventDefault(); actions[a.dataset.act](a, e); }
});
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && $('#q')) { e.preventDefault(); $('#q').focus(); $('#q').select(); }
});
