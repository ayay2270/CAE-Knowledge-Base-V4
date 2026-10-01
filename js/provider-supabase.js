/* Supabase data provider — READ ONLY.

   Reads `software_categories` and `entries` through the PostgREST API and resolves stored images through
   short-lived signed URLs from the private `kb-images` bucket. No SDK is needed.

   Safety rules enforced here:
   - Only the browser-safe PUBLISHABLE key (sb_publishable_…) is accepted. A secret key, a service_role key or
     a database password must never be placed in this repository.
   - Requests carry the key in the `apikey` header only, so they always run as the anonymous role
     (Row Level Security decides what is visible).
   - Every request goes through guardedFetch(): only GET requests to the configured project, plus the
     (non-mutating) POST that signs storage URLs. There is no insert / update / delete code path.
   - The V2 production and V3 development projects are blocked, so V4 cannot be pointed at them by accident.

   Image items inside `entries.images` may carry:  path (storage object path in kb-images) or src (a static URL),
   caption, title, section, step, order, key, mock.
*/
function createSupabaseProvider(cfg) {
  const BLOCKED_PROJECT_REFS = ['irspvzxkxxlnibmtmpox', 'uvxxnixkstxaqxhyfmcm'];   // V2 production, V3 development
  const BUCKET = 'kb-images', SIGN_SECONDS = 3600, PAGE = 500;
  const ENTRY_COLUMNS = 'id,category,title,tags,symptom,root_cause,solution,failed_attempts,notes,reference_source,images,views,created_at,updated_at';

  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(String(cfg.url || '').trim());
  const origin = m ? `https://${m[1]}.supabase.co` : null;
  const key = String(cfg.publishableKey || '').trim();
  const problem = !origin ? 'js/config.js：supabase.url 必須是 https://<project-ref>.supabase.co'
    : BLOCKED_PROJECT_REFS.includes(m[1]) ? 'js/config.js：這個專案（V2 正式／V3 開發）不允許給 V4 使用'
    : !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) ? 'js/config.js：supabase.publishableKey 必須是 sb_publishable_ 開頭的 publishable key（不可使用 secret / service_role key）'
    : null;

  const signUrl = origin && `${origin}/storage/v1/object/sign/${BUCKET}`;
  const headers = { apikey: key };

  /* The only way this provider talks to the network. */
  async function guardedFetch(url, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    const ok = url.startsWith(origin + '/') && (method === 'GET' || (method === 'POST' && url === signUrl));
    if (!ok) throw new Error(`blocked request: ${method} ${url.slice(0, 80)}`);
    return fetch(url, { ...init, method, headers: { ...headers, ...(init.headers || {}) } });
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

  const urlCache = new Map();   // storage path -> { url, exp }
  const isInline = p => /^(data:|blob:|https?:)/.test(p);

  return {
    id: 'supabase',
    label: 'Supabase',
    projectRef: m ? m[1] : null,
    async load() {
      if (problem) throw new Error(problem);
      const [categories, entries] = await Promise.all([
        rows('software_categories', 'select=key,label,parent_key,is_active,sort_order,description&order=sort_order.asc,key.asc'),
        rows('entries', `select=${ENTRY_COLUMNS}&order=updated_at.desc`)
      ]);
      /* Text pasted from Windows can carry \r\n line endings; the article renderer (steps, lists) expects \n. */
      const lf = s => typeof s === 'string' ? s.replace(/\r\n?/g, '\n') : s;
      return {
        categories: categories.map(c => ({ ...c, label: lf(c.label), description: lf(c.description || '') })),
        entries: entries.map(e => ({
          ...e, title: lf(e.title), symptom: lf(e.symptom), root_cause: lf(e.root_cause), solution: lf(e.solution), notes: lf(e.notes), reference_source: lf(e.reference_source),
          tags: e.tags || [], failed_attempts: (e.failed_attempts || []).map(lf), images: Array.isArray(e.images) ? e.images : [], views: e.views || 0
        }))
      };
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
    imageUrl(path) { return isInline(path || '') ? path : (urlCache.get(path)?.url || ''); }
  };
}
