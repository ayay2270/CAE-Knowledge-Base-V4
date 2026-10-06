/* Figures, article view and lightbox — inline section and solution-step figures.
   Every figure keeps its caption, its section / step tag and a full-size viewer. */

const SEC = { symptom: ['問題現象', 0], root_cause: ['原因分析', 1], solution: ['解決方法', 2], fails: ['試過但無效', 3], note: ['備註', 4], ref: ['參考來源', 5] };

const CI = { figs: [] };
const sectionKey = s => ({failed_attempts:'fails',notes:'note',reference_source:'ref'}[s] || (SEC[s] ? s : 'symptom'));

/* Figures of an entry. Entries with a `figures` list (local data) or images that carry section / step fields
   (Supabase) are placed by that mapping; plain stored images attach to the problem section. */
function cFigs(e) {
  const so = s => (SEC[s] || SEC.symptom)[1], st = s => s === 'v' ? 99 : (+s || 0);
  const list = e.figures
    ? e.figures.map(f => ({ ...f, sec: sectionKey(f.section), pri: f.order ?? 0 }))
    /* stored images: an item may also carry section / step / title / order (key = lead picture of a section) */
    : (e.images || []).map((im, i) => ({ path: im.path, src: im.src, mock: !!im.mock, key: im.key ?? i === 0, sec: sectionKey(im.section), step: im.step ?? 0, pri: im.order ?? i, title: im.title || im.caption || `圖片 ${i + 1}`, caption: im.caption || '' }));
  return list.sort((a, b) => so(a.sec) - so(b.sec) || st(a.step) - st(b.step) || a.pri - b.pri).map((f, i) => ({ ...f, n: i + 1 }));
}

const stepLabel = f => f.sec === 'solution' && f.step ? (f.step === 'v' ? '驗證' : `Step ${f.step}`) : '';
const figWhere = f => (SEC[f.sec] || SEC.symptom)[0] + (stepLabel(f) ? ' · ' + stepLabel(f) : '');
const imgTag = f => f.src ? `<img src="${f.src}" alt="${esc(f.title)}" width="960" height="600" loading="lazy" decoding="async">` : `<img data-path="${esc(f.path)}" alt="${esc(f.title)}">`;
const chips = (list, lab = true) => list.length ? `<div class="c-figrefs"><i class="ti ti-photo" aria-hidden="true"></i>${lab ? '<span>相關圖</span>' : ''}${list.map(f => `<button class="c-chip" data-act="cLb" data-n="${f.n}" title="${esc(f.title)}">圖 ${f.n}</button>`).join('')}</div>` : '';
function parseSteps(text) {
  const items = []; let cur = null; const pre = [];
  for (const ln of String(text || '').split('\n')) {
    const m = ln.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (m) { cur = { number: +m[1], text: m[2] }; items.push(cur); }
    else if (cur && ln.trim()) cur.text += ' ' + ln.trim();
    else if (!cur && ln.trim()) pre.push(ln);
  }
  return items.length >= 1 ? { pre: pre.join('\n'), items } : null;
}
const stepText = t => `<div class="prose"><p>${inline(esc(t))}</p></div>`;


function cInlineFigs(list) {
  if (!list.length) return '';
  return `<div class="c-inline-figs ${list.length === 1 ? 'one' : ''}">${list.map(f => `<figure id="fig-${f.n}" class="c-inline-fig"><button class="c-inline-thumb" data-act="cLb" data-n="${f.n}" aria-label="放大圖 ${f.n}：${esc(f.title || f.caption)}">${imgTag(f)}<span class="c-fig-zoom" aria-hidden="true"><i class="ti ti-arrows-maximize"></i></span></button><figcaption>圖 ${f.n}. ${esc(f.title || f.caption || '')}${f.title && f.caption && f.title !== f.caption ? `<span>${esc(f.caption)}</span>` : ''}</figcaption></figure>`).join('')}</div>`;
}
function cRelated(e) {
  const tags = new Set((e.tags || []).map(t => t.toLowerCase()));
  return S.entries.filter(x => x.id !== e.id).map(x => ({entry:x,score:(x.category === e.category ? 3 : 0) + (x.tags || []).filter(t => tags.has(t.toLowerCase())).length * 2})).filter(x => x.score > 0).sort((a,b) => b.score-a.score || new Date(b.entry.updated_at)-new Date(a.entry.updated_at) || a.entry.id.localeCompare(b.entry.id)).slice(0,4).map(x => x.entry);
}
function cArticle(el, e) {
  const p = KBH.parts(e), figs = CI.figs = cFigs(e);
  const root = catByKey(C.root) || C_OTHER;
  const bySec = s => figs.filter(f => f.sec === s);
  const st = parseSteps(e.solution);
  let sol = `<div class="prose">${p.sections[2].html}</div>` + cInlineFigs(bySec('solution'));
  if (st) {
    const numbered = new Set(st.items.map(it => it.number));
    const loose = bySec('solution').filter(f => !numbered.has(Number(f.step)));
    sol = (st.pre ? `<div class="prose">${md(st.pre)}</div>` : '') + `<ol class="c-steps">${st.items.map(it => `<li id="step-${it.number}"><span class="c-sn" aria-label="Step ${it.number}">${it.number}</span><div class="c-sb">${stepText(it.text)}${cInlineFigs(bySec('solution').filter(f => Number(f.step) === it.number))}</div></li>`).join('')}</ol>` + cInlineFigs(loose);
  }
  const sections = [
    ['symptom','問題現象',`<div class="prose">${p.sections[0].html}</div>`],
    ['root_cause','原因分析',`<div class="prose">${p.sections[1].html}</div>`],
    ['solution','解決方法',sol],
    ['fails','試過但無效',`<div class="prose">${p.failsHtml || '<span class="pending">尚未記錄</span>'}</div>`],
    ['note','備註',`<div class="prose">${p.noteHtml || '<span class="pending">尚未記錄</span>'}</div>`],
    ['ref','參考來源',`<div class="prose c-ref">${p.refHtml || '<span class="pending">尚未記錄</span>'}</div>`]
  ];
  const related = cRelated(e);
  el.innerHTML = `<div class="c-page-wrap"><article class="c-article">
    ${cCrumb([{t:'所有文章',act:'cHome'},{t:root.label,act:'cCat',k:C.root},...(p.c.parent ? [{t:p.c.label,act:'cCat',k:e.category}] : []),{t:e.title}])}
    <div class="c-article-label">${esc(p.c.label)}</div><h1>${esc(e.title)}</h1>
    <div class="c-meta"><span>更新：<time datetime="${esc(e.updated_at)}">${fmtDate(e.updated_at)}</time></span>${e._prototype ? '<span class="k-proto">本機原型</span>' : ''}<span class="c-actions">${p.actions}</span></div>
    ${sections.map(([id,label,body]) => `<section id="sec-${id}"><h2>${label}</h2>${body}${id !== 'solution' ? cInlineFigs(bySec(id)) : ''}</section>`).join('')}
    ${related.length ? `<section id="sec-related" class="c-related"><h2>相關知識</h2>${related.map(r => `<button data-act="cOpen" data-id="${esc(r.id)}"><span>${esc(r.title)}</span><small>${esc(catInfo(r.category).label)}</small><i class="ti ti-arrow-right" aria-hidden="true"></i></button>`).join('')}</section>` : ''}
    </article><aside class="c-toc" aria-label="文章目錄"><div class="c-toc-in"><div class="c-toc-h">On this page</div>${sections.map(([id,label]) => `<a href="#sec-${id}" data-act="cJump" data-t="sec-${id}">${label}</a>`).join('')}${related.length ? '<a href="#sec-related" data-act="cJump" data-t="sec-related">相關知識</a>' : ''}</div></aside></div>`;
}

/* ---------------- lightbox ---------------- */
const LB = { i: 0, full: false, opener: null };
function lbDraw() {
  const lb = $('#cLb'); if (!lb) return;
  const list = CI.figs, f = list[LB.i];
  const url = f.src || KBData.imageUrl(f.path) || '';
  lb.classList.toggle('full', LB.full);
  lb.innerHTML = `<div class="c-lb-top"><span class="c-lb-n">圖 ${f.n} <em>/ ${list.length}</em></span><span class="c-lb-tag">${esc(figWhere(f))}</span><span class="sp"></span>
      <button data-act="cLbFull" aria-pressed="${LB.full}" title="切換原始大小"><i class="ti ${LB.full ? 'ti-arrows-minimize' : 'ti-zoom-in-area'}"></i>${LB.full ? '符合視窗' : '原始大小'}</button>
      <button data-act="cLbClose" id="cLbX" aria-label="關閉（Esc）"><i class="ti ti-x"></i></button></div>
    <div class="c-lb-stage"><button class="c-lb-nav" data-act="cLbStep" data-v="-1" aria-label="上一張" ${list.length < 2 ? 'disabled' : ''}><i class="ti ti-chevron-left"></i></button>
      <div class="c-lb-img"><img src="${url}" alt="${esc(f.title)}"></div>
      <button class="c-lb-nav" data-act="cLbStep" data-v="1" aria-label="下一張" ${list.length < 2 ? 'disabled' : ''}><i class="ti ti-chevron-right"></i></button></div>
    <div class="c-lb-cap"><b>${esc(f.title)}</b>${f.caption ? `<span>${esc(f.caption)}</span>` : ''}</div>
    ${list.length > 1 ? `<div class="c-lb-strip">${list.map((x, k) => `<button class="${k === LB.i ? 'on' : ''}" data-act="cLbGo" data-k="${k}" aria-label="圖 ${x.n}：${esc(x.title)}">${x.src ? `<img src="${x.src}" alt="">` : `<img src="${KBData.imageUrl(x.path) || ''}" alt="">`}<span>${x.n}</span></button>`).join('')}</div>` : ''}`;
  lb.querySelector('.c-lb-strip .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function lbKey(ev) {
  if (ev.key === 'Escape') lbClose();
  else if (ev.key === 'ArrowLeft') lbStep(-1);
  else if (ev.key === 'ArrowRight') lbStep(1);
  else if (ev.key === 'Tab') { const els = $$('#cLb button:not(:disabled)'); if (!els.length) return; const a = document.activeElement, first = els[0], last = els[els.length - 1]; if (ev.shiftKey && a === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && a === last) { ev.preventDefault(); first.focus(); } }
}
function lbStep(d) { const n = CI.figs.length; LB.i = (LB.i + d + n) % n; lbDraw(); $('#cLb .c-lb-nav:not(:disabled), #cLbX')?.focus(); }
function lbOpen(n) {
  const i = CI.figs.findIndex(f => f.n === n); if (i < 0) return;
  LB.i = i; LB.full = false; LB.opener = document.activeElement;
  let lb = $('#cLb'); if (!lb) { lb = document.createElement('div'); lb.id = 'cLb'; lb.className = 'c-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', '圖片預覽'); document.body.appendChild(lb); }
  document.addEventListener('keydown', lbKey);
  document.body.classList.add('c-lb-open');
  lbDraw(); $('#cLbX')?.focus();
}
function lbClose() { $('#cLb')?.remove(); document.removeEventListener('keydown', lbKey); document.body.classList.remove('c-lb-open'); LB.opener?.focus?.(); }


Object.assign(actions, {
  cLb: b => lbOpen(+b.dataset.n),
  cLbClose: lbClose, cLbStep: b => lbStep(+b.dataset.v), cLbGo: b => { LB.i = +b.dataset.k; lbDraw(); },
  cLbFull: () => { LB.full = !LB.full; lbDraw(); $('#cLbX')?.focus(); }
});;
