/* Figures, article view and lightbox — the approved C2 design ("figures at the end").
   Every figure keeps its caption, its section / step tag and a full-size viewer. */

const SEC = { symptom: ['問題現象', 0], root_cause: ['原因分析', 1], solution: ['解決方法', 2], fails: ['試過但無效', 3], note: ['備註', 4], ref: ['參考來源', 5] };

const CI = { figs: [] };

/* Figures of an entry. Entries with a `figures` list carry an explicit section / step mapping;
   entries with only stored `images` (no mapping yet) attach their pictures to the problem section. */
function cFigs(e) {
  if (e.figures) {
    const so = s => SEC[s][1], st = s => s === 'v' ? 99 : s;
    return e.figures.map(f => ({ ...f, sec: f.section, pri: f.order }))
      .sort((a, b) => so(a.sec) - so(b.sec) || st(a.step) - st(b.step) || a.pri - b.pri)
      .map((f, i) => ({ ...f, n: i + 1 }));
  }
  return (e.images || []).map((im, i) => ({ n: i + 1, sec: 'symptom', step: 0, key: i === 0, path: im.path, title: im.caption || `圖片 ${i + 1}`, caption: im.caption || '' }));
}

const stepLabel = f => f.sec === 'solution' && f.step ? (f.step === 'v' ? '驗證' : `Step ${f.step}`) : '';
const figWhere = f => SEC[f.sec][0] + (stepLabel(f) ? ' · ' + stepLabel(f) : '');
const imgTag = f => f.src ? `<img src="${f.src}" alt="${esc(f.title)}" width="960" height="600" loading="lazy" decoding="async">` : `<img data-path="${esc(f.path)}" alt="${esc(f.title)}">`;
const chips = (list, lab = true) => list.length ? `<div class="c-figrefs"><i class="ti ti-photo" aria-hidden="true"></i>${lab ? '<span>相關圖</span>' : ''}${list.map(f => `<button class="c-chip" data-act="cLb" data-n="${f.n}" title="${esc(f.title)}">圖 ${f.n}</button>`).join('')}</div>` : '';
function parseSteps(text) {
  const items = []; let cur = null; const pre = [];
  for (const ln of String(text || '').split('\n')) {
    const m = ln.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (m) { cur = { text: m[2] }; items.push(cur); }
    else if (cur && ln.trim()) cur.text += ' ' + ln.trim();
    else if (!cur && ln.trim()) pre.push(ln);
  }
  return items.length >= 2 ? { pre: pre.join('\n'), items } : null;
}
const stepText = t => `<div class="prose"><p>${inline(esc(t))}</p></div>`;


function cArticle(el, e) {
  const p = KBH.parts(e);
  const figs = CI.figs = cFigs(e);
  const root = catByKey(C.root) || C_OTHER;
  const order = cChapters(C.root).flatMap(ch => ch.items);
  const i = order.findIndex(x => x.id === e.id), prev = order[i - 1], next = order[i + 1];
  const words = [e.symptom, e.root_cause, e.solution, e.notes].join('').length;
  const bySec = s => figs.filter(f => f.sec === s);
  const refsFor = s => chips(bySec(s));
  /* solution */
  const st = parseSteps(e.solution);
  let sol;
  if (st) {
    const vfigs = figs.filter(f => f.sec === 'solution' && f.step === 'v'), loose = figs.filter(f => f.sec === 'solution' && !f.step);
    sol = (st.pre ? `<div class="prose">${md(st.pre)}</div>` : '') + `<ol class="c-steps">${st.items.map((it, k) => {
      const sf = figs.filter(f => f.sec === 'solution' && f.step === k + 1);
      return `<li id="step-${k + 1}"><span class="c-sn" aria-label="Step ${k + 1}">${k + 1}</span><div class="c-sb">${stepText(it.text)}${chips(sf, false)}</div></li>`;
    }).join('')}</ol>` +
      (vfigs.length ? chips(vfigs, true).replace('相關圖', '驗證圖') : '') +
      chips(loose, false);
  } else sol = `<div class="prose">${p.sections[2].html}</div>` + refsFor('solution');
  const sect = (id, h, body) => `<section id="sec-${id}"><h2>${h}</h2>${body}</section>`;
  /* figures are collected in a gallery after the text */
  const endFigs = figs.length ? cEndFigs(figs) : '';
  const toc = [['symptom', '問題現象'], ['root_cause', '原因分析'], ['solution', '解決方法'], ...(p.fails.length ? [['fails', '試過但無效']] : []), ...(p.note ? [['note', '備註']] : []), ...(p.ref ? [['ref', '參考來源']] : []), ...(figs.length ? [['figs', '附圖 Figures']] : [])];
  const related = S.entries.filter(x => x.id !== e.id && (x.tags || []).some(t => (e.tags || []).includes(t))).slice(0, 4);
  el.innerHTML = `<div class="c-page-wrap">
    <article class="c-article">
      ${cCrumb([{ t: '總覽', act: 'cHome' }, { t: root.label || '其他', act: 'cIndex' }, ...(p.c.parent ? [{ t: p.c.label, act: 'cIndex' }] : []), { t: e.title }])}
      <h1>${esc(e.title)}</h1>
      <div class="c-meta"><span>${KBH.icon(e.category)}${esc(p.c.path)}</span><span><i class="ti ti-calendar"></i>${fmtDate(e.updated_at)} 更新</span><span><i class="ti ti-clock"></i>約 ${Math.max(1, Math.round(words / 350))} 分鐘閱讀</span>${figs.length ? `<span><i class="ti ti-photo"></i>${figs.length} 張圖</span>` : ''}
        <span class="c-actions">${p.actions}</span></div>
      ${p.tags ? `<div class="tags">${p.tags}</div>` : ''}
      ${sect('symptom', '問題現象', `<div class="prose">${md(e.symptom) || '<span class="pending">尚未填寫</span>'}</div>` + refsFor('symptom'))}
      ${sect('root_cause', '原因分析', `<div class="prose">${md(e.root_cause) || '<span class="pending">尚未填寫</span>'}</div>` + refsFor('root_cause'))}
      ${sect('solution', '解決方法', `<div class="c-callout ok"><div class="c-co-h"><i class="ti ti-circle-check"></i>建議做法</div>${sol}</div>`)}
      ${p.fails.length ? sect('fails', '試過但無效', `<div class="c-callout bad"><div class="c-co-h"><i class="ti ti-alert-triangle"></i>以下方法無法解決此問題</div>${p.failsHtml}</div>` + refsFor('fails')) : ''}
      ${p.note ? sect('note', '備註', `<div class="c-callout note"><div class="prose">${p.noteHtml}</div></div>` + refsFor('note')) : ''}
      ${p.ref ? sect('ref', '參考來源', `<div class="prose c-ref">${p.refHtml}</div>` + refsFor('ref')) : ''}
      ${endFigs}
      <div class="c-pn">
        ${prev ? `<button data-act="cOpen" data-id="${prev.id}"><small>← 上一篇</small><span>${esc(prev.title)}</span></button>` : '<span></span>'}
        ${next ? `<button class="n" data-act="cOpen" data-id="${next.id}"><small>下一篇 →</small><span>${esc(next.title)}</span></button>` : '<span></span>'}
      </div>
    </article>
    <aside class="c-toc"><div class="c-toc-in">
      <div class="c-toc-h">本頁內容</div>
      ${toc.map(([id, l]) => `<a href="#sec-${id}" data-act="cJump" data-t="sec-${id}">${l}</a>`).join('')}
      ${related.length ? `<div class="c-toc-h" style="margin-top:22px">相關文章</div>${related.map(r => `<a data-act="cOpen" data-id="${r.id}" href="#${r.id}" class="rel">${esc(r.title)}</a>`).join('')}` : ''}
    </div></aside></div>`;
};


function cEndFigs(list) {
  const card = f => `<figure class="c-fcard" id="fig-${f.n}"><button class="c-fthumb" data-act="cLb" data-n="${f.n}" aria-label="放大 圖 ${f.n}：${esc(f.title)}">${imgTag(f)}<span class="c-fnum">圖 ${f.n}</span><span class="c-fig-zoom" aria-hidden="true"><i class="ti ti-arrows-maximize"></i></span></button>
    <figcaption><button class="c-ftag" data-act="cJump" data-t="${f.sec === 'solution' && f.step && f.step !== 'v' ? 'step-' + f.step : 'sec-' + f.sec}" title="跳到對應段落">${esc(figWhere(f))}<i class="ti ti-arrow-up-right" aria-hidden="true"></i></button><span class="t">${esc(f.title)}</span><span class="s">${esc(f.caption)}</span></figcaption></figure>`;
  return `<section id="sec-figs" class="c-endfigs"><h2>附圖 <em>Figures</em><span class="c-fcount">${list.length} 張</span></h2>
    <p class="c-figs-note">點擊縮圖放大；標籤標示所屬段落／步驟，可跳回對應文字。</p>
    <div class="c-fgrid ${list.length === 1 ? 'one' : ''}">${list.map(card).join('')}</div></section>`;
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
