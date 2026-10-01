/* Login UI: account button in the header + email/password dialog.
   Only active when the data provider can write (Supabase). In local/sample mode nothing is shown. */
const authOn = () => !!(KBData.canWrite && KBData.auth);
let AUTH_AFTER = null, AUTH_BUSY = false, AUTH_RETURN = null;

function authRenderHeader() {
  const el = $('#acct'); if (!el) return;
  if (!authOn()) { el.innerHTML = ''; return; }
  const s = KBData.auth.session();
  el.innerHTML = s
    ? `<span class="k-who" title="${esc(s.user.email)}"><i class="ti ti-user-check" aria-hidden="true"></i><span>${esc(s.user.email)}</span></span><button type="button" class="k-link" data-act="authOut">登出</button>`
    : `<button type="button" class="k-login" data-act="authOpen"><i class="ti ti-login-2" aria-hidden="true"></i><span>登入</span></button>`;
}

function authOpen(after) {
  if (!authOn()) return;
  AUTH_AFTER = typeof after === 'function' ? after : null;
  AUTH_RETURN = document.activeElement;
  $('#authModal')?.remove();
  const m = document.createElement('div');
  m.id = 'authModal'; m.className = 'k-modal';
  m.innerHTML = `<div class="k-dialog" role="dialog" aria-modal="true" aria-labelledby="authT">
    <h2 id="authT">登入</h2>
    <p class="k-dsub">登入後才能新增知識。瀏覽內容不需要登入。</p>
    <form id="authForm" novalidate>
      <label class="k-lab" for="authEmail">電子郵件</label>
      <input id="authEmail" type="email" autocomplete="username" required>
      <label class="k-lab" for="authPw">密碼</label>
      <input id="authPw" type="password" autocomplete="current-password" required>
      <div class="k-err" id="authErr" role="alert"></div>
      <div class="k-dact"><button type="button" class="k-btn" data-act="authClose">取消</button><button type="submit" class="k-btn pri" id="authGo">登入</button></div>
    </form></div>`;
  ($('#app') || document.body).appendChild(m);
  $('#authEmail').focus();
}
function authClose() {
  $('#authModal')?.remove(); AUTH_AFTER = null;
  if (AUTH_RETURN && document.contains(AUTH_RETURN)) AUTH_RETURN.focus(); AUTH_RETURN = null;
}

document.addEventListener('submit', async e => {
  if (e.target.id !== 'authForm') return;
  e.preventDefault();
  if (AUTH_BUSY) return;
  const em = $('#authEmail').value.trim(), pw = $('#authPw').value, err = $('#authErr'), go = $('#authGo');
  err.textContent = '';
  if (!em || !pw) { err.textContent = '請輸入電子郵件與密碼'; (em ? $('#authPw') : $('#authEmail')).focus(); return; }
  AUTH_BUSY = true; go.disabled = true; go.textContent = '登入中…';
  try {
    await KBData.auth.signIn(em, pw);
    const next = AUTH_AFTER; $('#authModal')?.remove(); AUTH_AFTER = null; AUTH_RETURN = null;
    toast('已登入');
    if (next) next();
  } catch (ex) {
    err.textContent = ex.message || '登入失敗';
    go.disabled = false; go.textContent = '登入'; $('#authPw').value = ''; $('#authPw').focus();
  } finally { AUTH_BUSY = false; }
});

/* Esc closes the dialog; Tab stays inside it. */
document.addEventListener('keydown', e => {
  const m = $('#authModal'); if (!m) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); authClose(); return; }
  if (e.key === 'Tab') {
    const f = [...m.querySelectorAll('input,button:not([disabled])')];
    if (!f.length) return;
    const first = f[0], last = f.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}, true);
document.addEventListener('mousedown', e => { if (e.target.id === 'authModal') authClose(); });

/* Which entries can the signed-in user delete? Re-draw the open article if that changed. */
async function authSyncMine() {
  const open = C.view === 'article' && S.sel, before = open && KBData.canDelete(S.sel);
  try { await KBData.refreshMine(); } catch (e) { /* no delete buttons then */ }
  if (open && C.view === 'article' && S.sel === open && KBData.canDelete(S.sel) !== before) cOpen(S.sel);
}
if (authOn()) {
  KBData.auth.onChange(() => { authRenderHeader(); if (C.view === 'add') akRefresh(); authSyncMine(); });
  if (KBData.auth.session()) authSyncMine();
}

Object.assign(actions, {
  authOpen: () => authOpen(),
  authClose,
  kDelete: async b => {
    const e = S.entries.find(x => x.id === b.dataset.id);
    if (!e || !KBData.canDelete(e.id)) return;
    if (!confirm(`刪除「${e.title}」？

這會永久刪除這篇知識和它的附圖，無法復原。`)) return;
    b.disabled = true;
    try {
      const r = await KBData.deleteEntry(e);
      S.entries = S.entries.filter(x => x.id !== e.id);
      renderSide(); cGo('all');
      toast(r.imagesFailed ? `已刪除知識，但有 ${r.imagesFailed} 張圖片未能刪除` : '已刪除', !!r.imagesFailed);
    } catch (err) {
      b.disabled = false;
      if (err.status === 401) authOpen(); toast(err.message || '刪除失敗', true);
    }
  },
  authOut: async () => {
    if (C.view === 'add' && akDirty() && !confirm('登出會放棄目前輸入的內容，確定？')) return;
    await KBData.auth.signOut();
    if (C.view === 'add') akClose(false);
    toast('已登出');
  }
});
