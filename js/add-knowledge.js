/* 新增知識 — Add Knowledge flow.

   A four-step form that produces an entry in the existing knowledge schema:
   title, category, symptom, root_cause, solution, failed_attempts, notes, reference_source, tags, images.
   Save: with Supabase configured and a signed-in user the entry is inserted into the database (images go to the private
   kb-images bucket). Otherwise it is a PROTOTYPE: LocalStorage only (js/local-store.js), nothing is uploaded. */
const AK = { step: 1, d: null, err: {}, prev: null };
const AK_STEPS = ['基本資訊', '內容填寫', '附圖與其他', '確認儲存'];
const AK_MAX_IMAGES = 8;

function akBlank() { return { root: '', sub: '', title: '', symptom: '', root_cause: '', solution: '', failed: [''], notes: '', ref: '', tags: '', images: [] }; }
/* Where an image goes in the article: a section, or a numbered step of the solution (steps are read from the solution text). */
function akSolutionSteps() { return Math.max(0, ...(AK.d.solution || '').split(/\r?\n/).map(l => +(/^\s*(\d+)[.)、．]/.exec(l) || [])[1] || 0)); }
function akPlaceOptions() {
  const o = [['symptom', '問題現象'], ['root_cause', '原因分析'], ['solution', '解決方法（整體）']];
  for (let i = 1; i <= akSolutionSteps(); i++) o.push(['solution:' + i, '解決方法 · Step ' + i]);
  o.push(['solution:v', '解決方法 · 驗證'], ['note', '備註']);
  return o;
}
function akPlaceOf(im) { const o = akPlaceOptions(); return o.some(x => x[0] === im.place) ? im.place : 'symptom'; }
function akPlaceField(im) { const [section, step] = akPlaceOf(im).split(':'); return { section, step: step === 'v' ? 'v' : step ? +step : 0 }; }
function akPlaceLabel(im) { return akPlaceOptions().find(x => x[0] === akPlaceOf(im))[1]; }
function akRootNode(key) { return KBH.tree().find(t => t.c.key === key); }
function akCategoryKey(d) { const n = akRootNode(d.root); return n && n.kids.length ? d.sub : d.root; }
function akDirty() { const d = AK.d; return !!d && !!(d.title || d.symptom || d.root_cause || d.solution || d.notes || d.ref || d.tags || d.images.length || d.failed.some(Boolean)); }

function akOpen() {
  AK.prev = { view: C.view, cat: C.cat, sel: S.sel };
  if (!AK.d) AK.d = akBlank();
  AK.step = AK.step || 1; AK.err = {};
  C.view = 'add'; S.sel = null;
  history.replaceState(null, '', location.pathname + location.search);
  renderSide(); renderDetail(true);
}
function akClose(toSaved) {
  const p = AK.prev || { view: 'all' };
  AK.d = null; AK.step = 1; AK.err = {};
  if (toSaved) return;
  if (p.view === 'category' && p.cat) { C.view = 'category'; C.cat = p.cat; }
  else if (p.view === 'article' && p.sel && S.entries.some(e => e.id === p.sel)) { return cOpen(p.sel); }
  else C.view = 'all';
  renderSide(); renderDetail(true);
}

/* ---------- validation ---------- */
function akValidate(step) {
  const d = AK.d, err = {}, need = 'required';
  if (step === 1) {
    if (!d.root) err.root = need;
    const n = akRootNode(d.root);
    if (n && n.kids.length && !d.sub) err.sub = need;
    if (!d.title.trim()) err.title = need;
  }
  if (step === 2) { for (const f of ['symptom', 'root_cause', 'solution']) if (!d[f].trim()) err[f] = need; }
  AK.err = err;
  return !Object.keys(err).length;
}

/* ---------- rendering ---------- */
const akFieldErr = f => AK.err[f] ? `<div class="k-err" role="alert">此欄位必填</div>` : '';
const akInv = f => AK.err[f] ? ' aria-invalid="true"' : '';
function akStepBody() {
  const d = AK.d;
  if (AK.step === 1) {
    const roots = KBH.tree(), n = akRootNode(d.root);
    return `<div class="k-f"><label for="ak-root">軟體分類 <b>*</b></label>
        <select id="ak-root" data-f="root"${akInv('root')}><option value="">請選擇軟體</option>${roots.map(({ c }) => `<option value="${esc(c.key)}" ${d.root === c.key ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select>${akFieldErr('root')}</div>
      <div class="k-f"><label for="ak-sub">子分類 ${n && n.kids.length ? '<b>*</b>' : ''}</label>
        <select id="ak-sub" data-f="sub" ${n && n.kids.length ? '' : 'disabled'}${akInv('sub')}>${n && n.kids.length ? `<option value="">請選擇子分類</option>${n.kids.map(k => `<option value="${esc(k.key)}" ${d.sub === k.key ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}` : `<option value="">${d.root ? '（此軟體沒有子分類）' : '請先選擇軟體分類'}</option>`}</select>${akFieldErr('sub')}</div>
      <div class="k-f wide"><label for="ak-title">標題（問題現象） <b>*</b></label>
        <input id="ak-title" data-f="title" value="${esc(d.title)}" placeholder="例如：STEP 匯入後幾何破面，free edges 無法補面" autocomplete="off"${akInv('title')}>${akFieldErr('title')}</div>`;
  }
  if (AK.step === 2) {
    const ta = (f, label, ph, hint) => `<div class="k-f wide"><label for="ak-${f}">${label} <b>*</b></label><textarea id="ak-${f}" data-f="${f}" rows="${f === 'solution' ? 7 : 5}" placeholder="${esc(ph)}"${akInv(f)}>${esc(d[f])}</textarea>${hint ? `<div class="k-hint">${hint}</div>` : ''}${akFieldErr(f)}</div>`;
    return ta('symptom', '問題現象', '描述遇到的問題現象、錯誤訊息、發生情境…', '可用 `反引號` 標示指令或關鍵字、**粗體** 標示重點。') +
      ta('root_cause', '原因分析', '說明造成問題的原因…', '') +
      ta('solution', '解決方法', '1. 第一步…\n2. 第二步…\n3. 第三步…', '每行一個步驟，以「1.」「2.」「3.」編號，文章會顯示成步驟清單。');
  }
  if (AK.step === 3) {
    return `<div class="k-f wide"><label>試過但無效</label>
        ${d.failed.map((f, i) => `<div class="k-failrow"><input data-f="failed" data-i="${i}" value="${esc(f)}" placeholder="例如：重新匯出 IGES —— 破面更多" autocomplete="off" aria-label="試過但無效 ${i + 1}"><button type="button" class="k-x" data-act="akRmFail" data-i="${i}" aria-label="移除這一項"${d.failed.length < 2 && !f ? ' disabled' : ''}><i class="ti ti-x"></i></button></div>`).join('')}
        <button type="button" class="k-link" data-act="akAddFail"><i class="ti ti-plus"></i>再加一項</button></div>
      <div class="k-f wide"><label for="ak-notes">備註</label><textarea id="ak-notes" data-f="notes" rows="3" placeholder="補充說明、使用限制、注意事項…">${esc(d.notes)}</textarea></div>
      <div class="k-f wide"><label for="ak-ref">參考來源</label><input id="ak-ref" data-f="ref" value="${esc(d.ref)}" placeholder="例如：Altair HyperMesh Help — Geometry Cleanup" autocomplete="off"></div>
      <div class="k-f wide"><label for="ak-tags">標籤</label><input id="ak-tags" data-f="tags" value="${esc(d.tags)}" placeholder="以逗號分隔，例如：geometry, cleanup, step" autocomplete="off"></div>
      <div class="k-f wide"><label>圖片附件 <span class="k-opt">（最多 ${AK_MAX_IMAGES} 張，會先縮小；${akLive() ? '儲存時上傳到資料庫' : '只存在本機'}）</span></label>
        <button type="button" class="k-drop" data-act="akPick" id="akDrop"><i class="ti ti-photo-up"></i><b>選擇圖片，或把圖片拖曳到這裡</b><small>PNG / JPG；加入後可替每張圖寫說明，並選擇放在哪個段落或步驟</small></button>
        <input type="file" id="akFile" accept="image/*" multiple hidden>
        ${d.images.length ? `<div class="k-imgs">${d.images.map((im, i) => `<figure class="k-img"><img src="${im.url}" alt="${esc(im.caption || '附圖 ' + (i + 1))}"><button type="button" class="k-x over" data-act="akRmImg" data-i="${i}" aria-label="移除圖 ${i + 1}"><i class="ti ti-x"></i></button><input data-f="imgcap" data-i="${i}" value="${esc(im.caption)}" placeholder="圖 ${i + 1} 說明" aria-label="圖 ${i + 1} 說明"><select data-f="imgplace" data-i="${i}" aria-label="圖 ${i + 1} 放在哪裡">${akPlaceOptions().map(([v, l]) => `<option value="${v}"${v === akPlaceOf(im) ? ' selected' : ''}>${l}</option>`).join('')}</select></figure>`).join('')}</div>` : ''}</div>`;
  }
  /* step 4: preview */
  const key = akCategoryKey(d), info = catInfo(key), fails = d.failed.map(s => s.trim()).filter(Boolean);
  const tags = d.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean);
  return `<div class="k-prev"><p class="k-prev-path">${KBH.icon(key)}${esc(info.path)}</p><h2>${esc(d.title)}</h2>
      ${tags.length ? `<div class="k-tags">${tags.map(t => `<span class="k-tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      <h3>問題現象</h3><div class="prose">${md(d.symptom)}</div><h3>原因分析</h3><div class="prose">${md(d.root_cause)}</div><h3>解決方法</h3><div class="prose">${md(d.solution)}</div>
      ${fails.length ? `<h3>試過但無效</h3><ul>${fails.map(f => `<li>${inline(esc(f))}</li>`).join('')}</ul>` : ''}
      ${d.notes.trim() ? `<h3>備註</h3><div class="prose">${md(d.notes)}</div>` : ''}${d.ref.trim() ? `<h3>參考來源</h3><div class="prose">${md(d.ref)}</div>` : ''}
      ${d.images.length ? `<h3>附圖（${d.images.length}）</h3><div class="k-imgs sm">${d.images.map((im, i) => `<figure class="k-img"><img src="${im.url}" alt=""><figcaption>${esc(im.caption || '圖 ' + (i + 1))}<br>放在：${esc(akPlaceLabel(im))}</figcaption></figure>`).join('')}</div>` : ''}</div>
    <p class="k-hint">${akLive() ? '確認無誤後按「儲存到資料庫」。送出後會寫入 Supabase（目前版本只能新增，不能在介面修改或刪除）。' : '確認無誤後按「儲存到本機」。此為<b>原型</b>：資料只存在這個瀏覽器，不會上傳。'}</p>`;
}
/* Real saving (Supabase, signed in) vs. the local prototype (sample data / no database configured). */
const akLive = () => !!(KBData.canWrite && KBData.auth);
const AK_NOTE_PROTO = '<b>本機原型</b>　儲存的資料只會留在這個瀏覽器（LocalStorage），不會上傳到 GitHub 或資料庫。';
const akNote = () => akLive() ? `<b>儲存到資料庫</b>　登入帳號：${esc(KBData.auth.session()?.user.email || '')}。送出後會寫入 Supabase，圖片會上傳到私有的 kb-images。` : AK_NOTE_PROTO;
function akRender(el) {
  const last = AK.step === 4;
  el.innerHTML = `<div class="k-addpage"><div class="k-add-card">
    <header class="k-add-h"><h1>新增知識</h1><div class="k-proto-note${akLive() ? ' live' : ''}"><i class="ti ${akLive() ? 'ti-cloud-upload' : 'ti-flask'}"></i><span>${akNote()}</span></div></header>
    <div class="k-add-body">
      <ol class="k-steps" aria-label="步驟">${AK_STEPS.map((s, i) => `<li class="${i + 1 === AK.step ? 'on' : i + 1 < AK.step ? 'done' : ''}"><button type="button" data-act="akGo" data-s="${i + 1}" ${i + 1 === AK.step ? 'aria-current="step"' : ''}><span class="k-sn">${i + 1 < AK.step ? '<i class="ti ti-check"></i>' : i + 1}</span>${s}</button></li>`).join('')}</ol>
      <form class="k-form" id="akForm" novalidate><h2 class="k-form-h">${AK_STEPS[AK.step - 1]}</h2><div class="k-fields">${akStepBody()}</div></form>
    </div>
    <footer class="k-add-f">
      ${akLive() ? '' : `<button type="button" class="k-link muted" data-act="akClear"${LocalStore.count() ? '' : ' disabled'}>清除本機原型資料（${LocalStore.count()}）</button>`}<span class="spacer"></span>
      <button type="button" class="k-btn" data-act="akCancel">取消</button>
      ${AK.step > 1 ? `<button type="button" class="k-btn" data-act="akPrev">上一步</button>` : ''}
      <button type="button" class="k-btn pri" data-act="${last ? 'akSave' : 'akNext'}">${last ? (akLive() ? '<i class="ti ti-cloud-upload"></i>儲存到資料庫' : '<i class="ti ti-device-floppy"></i>儲存到本機（原型）') : '下一步'}</button>
    </footer></div></div>`;
  $('#detail').scrollTop = 0;
}
function akRefresh(focusSel) { akRender($('#detail')); if (focusSel) $(focusSel)?.focus(); }

/* ---------- images (resized in the browser, stored as data URLs) ---------- */
function akResize(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('無法讀取圖片')); };
    img.src = url;
  });
}
async function akAddFiles(files) {
  const list = [...files].filter(f => f.type.startsWith('image/'));
  for (const f of list) {
    if (AK.d.images.length >= AK_MAX_IMAGES) { toast(`最多 ${AK_MAX_IMAGES} 張圖片`, true); break; }
    try { AK.d.images.push({ url: await akResize(f), caption: f.name.replace(/\.[^.]+$/, ''), place: 'symptom' }); } catch (e) { toast(`${f.name}：${e.message}`, true); }
  }
  akRefresh();
}

/* ---------- save (PROTOTYPE: LocalStorage only) ---------- */
/* Saves to Supabase: upload the images first, then insert the entry. Nothing is added to the list unless the insert succeeds. */
async function akSaveLive() {
  const d = AK.d, btn = $('#detail [data-act="akSave"]');
  if (!KBData.auth.session()) { toast('登入已失效，請重新登入', true); return authOpen(akSaveLive); }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="k-spin"></span>儲存中…'; }
  try {
    const images = [];
    for (const im of d.images) {
      const blob = await (await fetch(im.url)).blob();
      images.push({ path: await KBData.uploadImage(blob), caption: im.caption.trim(), ...akPlaceField(im) });
    }
    const saved = await KBData.createEntry({
      title: d.title.trim(), category: akCategoryKey(d), tags: d.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean),
      symptom: d.symptom.trim(), root_cause: d.root_cause.trim(), solution: d.solution.trim(),
      failed_attempts: d.failed.map(s => s.trim()).filter(Boolean), notes: d.notes.trim(), reference_source: d.ref.trim(), images
    });
    S.entries.unshift(saved);
    akClose(true);
    toast('已儲存到資料庫');
    cOpen(saved.id);
  } catch (err) {
    if (err.status === 401) { toast('登入已失效，請重新登入後再儲存', true); authOpen(akSaveLive); }
    else toast(err.message || '儲存失敗', true);
    if (btn && C.view === 'add') akRefresh();
  }
}

function akSave() {
  if (akLive()) return akSaveLive();
  const d = AK.d, now = new Date().toISOString();
  const entry = {
    id: 'local-' + Date.now().toString(36), category: akCategoryKey(d), title: d.title.trim(),
    tags: d.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean),
    symptom: d.symptom.trim(), root_cause: d.root_cause.trim(), solution: d.solution.trim(),
    failed_attempts: d.failed.map(s => s.trim()).filter(Boolean), notes: d.notes.trim(), reference_source: d.ref.trim(),
    images: d.images.map(im => ({ path: im.url, caption: im.caption.trim(), ...akPlaceField(im) })),
    created_at: now, updated_at: now, _prototype: true
  };
  try { LocalStore.add(entry); } catch (e) { toast('瀏覽器空間不足，無法儲存（請減少圖片）', true); return; }
  S.entries.unshift(entry);
  akClose(true);
  toast('已儲存到本機原型（只存在這個瀏覽器）');
  cOpen(entry.id);
}

/* ---------- events ---------- */
document.addEventListener('input', e => {
  const t = e.target, f = t.dataset?.f; if (!f || C.view !== 'add' || !AK.d) return;
  if (f === 'failed') AK.d.failed[+t.dataset.i] = t.value;
  else if (f === 'imgcap') AK.d.images[+t.dataset.i].caption = t.value;
  else if (f === 'imgplace') AK.d.images[+t.dataset.i].place = t.value;
  else if (f === 'root' || f === 'sub') return;
  else { AK.d[f] = t.value; if (AK.err[f] && t.value.trim()) { delete AK.err[f]; t.removeAttribute('aria-invalid'); t.parentElement.querySelector('.k-err')?.remove(); } }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (C.view !== 'add' || !AK.d) return;
  if (t.id === 'ak-root') { AK.d.root = t.value; AK.d.sub = ''; delete AK.err.root; delete AK.err.sub; akRefresh(AK.d.root && akRootNode(AK.d.root)?.kids.length ? '#ak-sub' : '#ak-root'); }
  else if (t.id === 'ak-sub') { AK.d.sub = t.value; delete AK.err.sub; t.removeAttribute('aria-invalid'); t.parentElement.querySelector('.k-err')?.remove(); }
  else if (t.id === 'akFile') { akAddFiles(t.files); t.value = ''; }
});
document.addEventListener('dragover', e => { if (e.target.closest?.('#akDrop')) { e.preventDefault(); e.target.closest('#akDrop').classList.add('over'); } });
document.addEventListener('dragleave', e => { e.target.closest?.('#akDrop')?.classList.remove('over'); });
document.addEventListener('drop', e => { if (e.target.closest?.('#akDrop')) { e.preventDefault(); e.target.closest('#akDrop').classList.remove('over'); akAddFiles(e.dataTransfer.files); } });
document.addEventListener('keydown', e => {
  if (C.view === 'add' && e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'file') { e.preventDefault(); actions.akNext(); }
});

Object.assign(actions, {
  kAdd: () => { if (KBData.canWrite && KBData.auth && !KBData.auth.session()) return authOpen(akOpen); akOpen(); },
  akCancel: () => { if (akDirty() && !confirm('放棄目前輸入的內容？')) return; akClose(false); },
  akPrev: () => { AK.step = Math.max(1, AK.step - 1); AK.err = {}; akRefresh(); },
  akNext: () => { if (AK.step === 4) return actions.akSave(); if (!akValidate(AK.step)) { akRefresh(); $('#detail [aria-invalid="true"]')?.focus(); return; } AK.step++; AK.err = {}; akRefresh(); },
  akGo: b => { const s = +b.dataset.s; if (s > AK.step) { for (let i = AK.step; i < s; i++) if (!akValidate(i)) { AK.step = i; akRefresh(); $('#detail [aria-invalid="true"]')?.focus(); return; } } AK.step = s; AK.err = {}; akRefresh(); },
  akAddFail: () => { AK.d.failed.push(''); akRefresh(); $$('#akForm input[data-f="failed"]').at(-1)?.focus(); },
  akRmFail: b => { AK.d.failed.splice(+b.dataset.i, 1); if (!AK.d.failed.length) AK.d.failed = ['']; akRefresh(); },
  akRmImg: b => { AK.d.images.splice(+b.dataset.i, 1); akRefresh(); },
  akPick: () => $('#akFile')?.click(),
  akSave: () => { if (!akValidate(1)) { AK.step = 1; akRefresh(); return; } if (!akValidate(2)) { AK.step = 2; akRefresh(); return; } akSave(); },
  akClear: () => {
    if (akLive()) return;
    const n = LocalStore.count(); if (!n || !confirm(`清除這個瀏覽器中 ${n} 筆本機原型資料？`)) return;
    LocalStore.clear(); S.entries = S.entries.filter(e => !e._prototype); akRefresh(); renderSide(); toast('已清除本機原型資料');
  }
});
