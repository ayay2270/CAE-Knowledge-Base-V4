/* Data provider — the only place that knows where the knowledge base comes from.

   The UI talks to `KBData` only, through this contract:
     KBData.load()                 -> Promise<{ categories, entries }>
     KBData.prepareImages(paths)   -> Promise<void>   resolve / prefetch URLs for stored images
     KBData.imageUrl(path)         -> string          URL usable in <img src>

   Two implementations exist:
     provider-supabase.js   read-only Supabase connection (used when js/config.js holds a project URL + publishable key)
     provider-local.js      local static JSON (default when nothing is configured)

   Add ?source=local to the page URL to force the local data even when Supabase is configured.
*/
const KBData = (() => {
  const cfg = (window.KB_CONFIG && window.KB_CONFIG.supabase) || {};
  const forceLocal = new URLSearchParams(location.search).get('source') === 'local';
  const useSupabase = !forceLocal && !!(cfg.url || cfg.publishableKey);
  const provider = useSupabase ? createSupabaseProvider(cfg) : LocalProvider;
  document.documentElement.dataset.source = provider.id;
  return provider;
})();
