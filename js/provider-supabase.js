/* Supabase data provider.

   READ  (anonymous): `software_categories` and `entries` through the PostgREST API; stored images through short-lived
         signed URLs from the private `kb-images` bucket. No SDK is needed.
   WRITE (signed-in user only): insert one row into `entries`, upload an image into the user's OWN folder of
         `kb-images`, and edit or delete one of the user's OWN entries (and its images).

   Safety rules enforced here:
   - Only the browser-safe PUBLISHABLE key (sb_publishable_…) is accepted. A secret key, a service_role key or
     a database password must never be placed in this repository.
   - Every request goes through guardedFetch(), which only lets through the allow-list in RULES below, to the
     configured project. Anything else (PATCH, DELETE, other tables, other paths) throws before it leaves the browser.
   - Reads always run as the anonymous role (apikey header only). The signed-in access token is attached only to the
     write requests and to sign-out. Row Level Security in the database is the real gate; this is a second lock.
   - The V2 production and V3 development projects are blocked, so V4 cannot be pointed at them by accident.

   The login session (access / refresh token) is kept in localStorage under `cae-kb-v4-auth`.

   Image items inside `entries.images` may carry:  path (storage object path in kb-images) or src (a static URL),
   caption, title, section, step, order, key, mock.
*/
function createSupabaseProvider(cfg) {
  const BLOCKED_PROJECT_REFS = ['irspvzxkxxlnibmtmpox', 'uvxxnixkstxaqxhyfmcm'];   // V2 production, V3 development
  const BUCKET = 'kb-images', SIGN_SECONDS = 3600, PAGE = 500, AUTH_KEY = 'cae-kb-v4-auth';
  const ENTRY_COLUMNS = 'id,category,title,tags,symptom,root_cause,solution,failed_attempts,notes,reference_source,images,views,created_at,updated_at';
  const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(String(cfg.url || '').trim());
  const origin = m ? `https://${m[1]}.supabase.co` : null;
  const key = String(cfg.publishableKey || '').trim();
  const problem = !origin ? 'js/config.js：supabase.url 必須是 https://<project-ref>.supabase.co'
    : BLOCKED_PROJECT_REFS.includes(m[1]) ? 'js/config.js：這個專案（V2 正式／V3 開發）不允許給 V4 使用'
    : !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) ? 'js/config.js：supabase.publishableKey 必須是 sb_publishable_ 開頭的 publishable key（不可使用 secret / service_role key）'
    : null;

  /* ---------- the allow-list: the ONLY requests this provider can make ---------- */
  const RULES = [
    { method: 'GET', path: /^\/rest\/v1\/entries$/, query: new RegExp(`^select=id&user_id=eq\\.${UUID}$`), auth: 'user' },   // ids of my own entries
    { method: 'GET', path: /^\/rest\/v1\/(entries|software_categories)$/ },
    { method: 'POST', path: new RegExp(`^/storage/v1/object/sign/${BUCKET}$`) },
    { method: 'POST', path: /^\/auth\/v1\/token$/, query: /^grant_type=(password|refresh_token)$/, auth: 'none' },
    { method: 'POST', path: /^\/auth\/v1\/logout$/, auth: 'user' },
    { method: 'POST', path: /^\/rest\/v1\/entries$/, auth: 'user' },
    { method: 'PATCH', path: /^\/rest\/v1\/entries$/, query: new RegExp(`^id=eq\\.${UUID}$`), auth: 'user' },
    { method: 'DELETE', path: /^\/rest\/v1\/entries$/, query: new RegExp(`^id=eq\\.${UUID}$`), auth: 'user' },
    { method: 'DELETE', path: new RegExp(`^/storage/v1/object/${BUCKET}/${UUID}/${UUID}\\.(jpg|png)$`), auth: 'user' },
    { method: 'POST', path: new RegExp(`^/storage/v1/object/${BUCKET}/${UUID}/${UUID}\\.(jpg|png)$`), auth: 'user' }
  ];

  /* ---------- session ---------- */
  const listeners = new Set();
  let mine = new Set();   // ids of the entries the signed-in user created (the only ones that can be deleted)
  let session = (() => { try { const s = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); return s && s.access_token && s.refresh_token && s.user ? s : null; } catch (e) { return null; } })();
  function setSession(s) {
    session = s;
    if (!s) mine = new Set();
    try { s ? localStorage.setItem(AUTH_KEY, JSON.stringify(s)) : localStorage.removeItem(AUTH_KEY); } catch (e) { /* storage unavailable */ }
    listeners.forEach(f => { try { f(session); } catch (e) { /* ignore */ } });
  }
  const toSession = d => ({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), user: { id: d.user.id, email: d.user.email } });
  const authError = (status, body) => {
    const msg = body && body.error_code === 'email_provider_disabled' ? 'Supabase 尚未啟用 Email 登入（Authentication → Sign In / Providers → Email → Enable Email provider）' : status === 400 || status === 401 ? '帳號或密碼不正確' : status === 422 ? '登入資料格式不正確' : status === 429 ? '嘗試次數過多，請稍後再試' : `登入失敗（HTTP ${status}）`;
    const err = new Error(msg); err.status = status; err.detail = body && (body.error_code || body.msg); return err;
  };

  /* The only way this provider talks to the network. */
  async function guardedFetch(url, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    let u; try { u = new URL(url); } catch (e) { throw new Error('blocked request: bad url'); }
    const rule = u.origin === origin && RULES.find(r => r.method === method && r.path.test(u.pathname) && (!r.query || r.query.test(u.search.slice(1))));
    if (!rule) throw new Error(`blocked request: ${method} ${u.pathname}`);
    const headers = { apikey: key, ...(init.headers || {}) };
    if (rule.auth === 'user') {
      if (!session) throw new Error('not signed in');
      if (session.expires_at - Date.now() / 1000 < 60) await refresh();
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    return fetch(url, { ...init, method, headers });
  }

  async function refresh() {
    const res = await guardedFetch(`${origin}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
    if (!res.ok) { setSession(null); throw Object.assign(new Error('登入已過期，請重新登入'), { status: 401 }); }
    setSession(toSession(await res.json()));
  }

  async function rows(table, query) {
    const out = [];
    for (let offset = 0; ; offset += PAGE) {
      const res = await guardedFetch(`${origin}/rest/v1/${table}?${query}&limit=${PAGE}&offset=${offset}`);
      if (!res.ok) throw new Error(`${table}: HTTP ${res.status}${res.status === 401 || res.status === 403 ? '（請檢查 publishable key 與 RLS 讀取權限）' : ''}`);
      const part = await res.json();
      out.push(...part);
      if (part.length < PAGE) return out;
    }
  }

  /* Text pasted from Windows can carry \r\n line endings; the article renderer (steps, lists) expects \n. */
  const lf = s => typeof s === 'string' ? s.replace(/\r\n?/g, '\n') : s;
  const normalizeEntry = e => ({
    ...e, title: lf(e.title), symptom: lf(e.symptom), root_cause: lf(e.root_cause), solution: lf(e.solution), notes: lf(e.notes), reference_source: lf(e.reference_source),
    tags: e.tags || [], failed_attempts: (e.failed_attempts || []).map(lf), images: Array.isArray(e.images) ? e.images : [], views: e.views || 0
  });

  const urlCache = new Map();   // storage path -> { url, exp }
  const isInline = p => /^(data:|blob:|https?:)/.test(p);
  const signUrl = origin && `${origin}/storage/v1/object/sign/${BUCKET}`;

  return {
    id: 'supabase',
    label: 'Supabase',
    projectRef: m ? m[1] : null,
    canWrite: !problem,
    canDelete: id => !!session && mine.has(id),
    async refreshMine() {
      if (!session) { mine = new Set(); return mine; }
      const res = await guardedFetch(`${origin}/rest/v1/entries?select=id&user_id=eq.${session.user.id}`);
      mine = res.ok ? new Set((await res.json()).map(r => r.id)) : new Set();
      return mine;
    },
    async load() {
      if (problem) throw new Error(problem);
      const [categories, entries] = await Promise.all([
        rows('software_categories', 'select=key,label,parent_key,is_active,sort_order,description&order=sort_order.asc,key.asc'),
        rows('entries', `select=${ENTRY_COLUMNS}&order=updated_at.desc`)
      ]);
      return { categories: categories.map(c => ({ ...c, label: lf(c.label), description: lf(c.description || '') })), entries: entries.map(normalizeEntry) };
    },
    /* Signs storage paths that are not cached yet. Inline (data:/http) images need nothing. */
    async prepareImages(paths) {
      if (problem) return;
      const now = Date.now();
      const need = [...new Set(paths)].filter(p => p && !isInline(p) && !(urlCache.get(p)?.exp > now + 120000));
      for (let i = 0; i < need.length; i += 100) {
        const chunk = need.slice(i, i + 100);
        try {
          const res = await guardedFetch(signUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: SIGN_SECONDS, paths: chunk }) });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          for (const d of await res.json()) if (d.signedURL) urlCache.set(d.path, { url: `${origin}/storage/v1${d.signedURL}`, exp: now + SIGN_SECONDS * 1000 });
        } catch (err) { console.warn('could not sign image URLs:', err.message); }
      }
    },
    imageUrl(path) { return isInline(path || '') ? path : (urlCache.get(path)?.url || ''); },

    /* ---------- login ---------- */
    auth: {
      session: () => session,
      onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      async signIn(email, password) {
        if (problem) throw new Error(problem);
        const res = await guardedFetch(`${origin}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: String(email).trim(), password }) });
        let body = null; try { body = await res.json(); } catch (e) { /* no body */ }
        if (!res.ok || !body || !body.access_token) throw authError(res.status, body);
        setSession(toSession(body));
        return session;
      },
      async signOut() {
        const had = session;
        try { if (had) await guardedFetch(`${origin}/auth/v1/logout`, { method: 'POST' }); } catch (e) { /* the local session is dropped either way */ }
        setSession(null);
      }
    },

    /* ---------- the two write operations ---------- */
    /* Uploads one image (JPEG or PNG blob) into the signed-in user's own folder; returns its storage path. */
    async uploadImage(blob) {
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : null;
      if (!ext) throw new Error('只支援 JPEG / PNG 圖片');
      if (!session) throw Object.assign(new Error('請先登入'), { status: 401 });
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
      const res = await guardedFetch(`${origin}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { 'Content-Type': blob.type, 'x-upsert': 'false' }, body: blob });
      if (!res.ok) throw Object.assign(new Error(`圖片上傳失敗（HTTP ${res.status}）`), { status: res.status });
      return path;
    },
    /* Inserts one knowledge entry (the author is set by the database from the login). Returns the saved row. */
    async createEntry(entry) {
      if (!session) throw Object.assign(new Error('請先登入'), { status: 401 });
      const body = {
        title: entry.title, category: entry.category, tags: entry.tags || [], symptom: entry.symptom || '', root_cause: entry.root_cause || '', solution: entry.solution || '',
        failed_attempts: entry.failed_attempts || [], notes: entry.notes || '', reference_source: entry.reference_source || '', images: entry.images || []
      };
      const res = await guardedFetch(`${origin}/rest/v1/entries`, { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
      if (!res.ok) throw Object.assign(new Error(res.status === 401 || res.status === 403 ? '沒有儲存權限，請確認已登入' : `儲存失敗（HTTP ${res.status}）`), { status: res.status });
      const saved = await res.json();
      const row = normalizeEntry(Array.isArray(saved) ? saved[0] : saved);
      mine.add(row.id);
      return row;
    },
    /* Updates the content of one of the user's own entries (never the author). `removedPaths` are images the user took
       out; they are deleted from storage after the row was saved. Returns { entry, imagesFailed }. */
    async updateEntry(id, entry, removedPaths = []) {
      if (!session) throw Object.assign(new Error('請先登入'), { status: 401 });
      const body = {
        title: entry.title, category: entry.category, tags: entry.tags || [], symptom: entry.symptom || '', root_cause: entry.root_cause || '', solution: entry.solution || '',
        failed_attempts: entry.failed_attempts || [], notes: entry.notes || '', reference_source: entry.reference_source || '', images: entry.images || []
      };
      const res = await guardedFetch(`${origin}/rest/v1/entries?id=eq.${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
      if (!res.ok) throw Object.assign(new Error(res.status === 401 || res.status === 403 ? '沒有修改權限，請確認已登入' : `儲存失敗（HTTP ${res.status}）`), { status: res.status });
      const saved = await res.json();
      if (!saved.length) throw Object.assign(new Error('只能修改自己新增的知識'), { status: 403 });
      let imagesFailed = 0;
      for (const p of removedPaths) {
        if (!p || !p.startsWith(session.user.id + '/')) continue;
        try { const r = await guardedFetch(`${origin}/storage/v1/object/${BUCKET}/${p}`, { method: 'DELETE' }); if (!r.ok) imagesFailed++; } catch (e) { imagesFailed++; }
      }
      return { entry: normalizeEntry(saved[0]), imagesFailed };
    },
    /* Deletes one of the user's own entries, then its images. Resolves { imagesFailed }. */
    async deleteEntry(entry) {
      if (!session) throw Object.assign(new Error('請先登入'), { status: 401 });
      const res = await guardedFetch(`${origin}/rest/v1/entries?id=eq.${entry.id}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
      if (!res.ok) throw Object.assign(new Error(res.status === 401 || res.status === 403 ? '沒有刪除權限，請確認已登入' : `刪除失敗（HTTP ${res.status}）`), { status: res.status });
      if (!(await res.json()).length) throw Object.assign(new Error('只能刪除自己新增的知識'), { status: 403 });
      mine.delete(entry.id);
      let imagesFailed = 0;
      for (const im of entry.images || []) {
        if (!im.path || !im.path.startsWith(session.user.id + '/')) continue;
        try { const r = await guardedFetch(`${origin}/storage/v1/object/${BUCKET}/${im.path}`, { method: 'DELETE' }); if (!r.ok) imagesFailed++; } catch (e) { imagesFailed++; }
      }
      return { imagesFailed };
    }
  };
}
