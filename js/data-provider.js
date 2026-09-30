/* Data provider — the only place that knows where the knowledge base comes from.

   Current implementation: LOCAL, READ-ONLY static JSON (data/knowledge-base.json).

   The UI talks to `KBData` only, through this contract:
     KBData.load()                 -> Promise<{ categories, entries, defaultEntryId }>
     KBData.prepareImages(paths)   -> Promise<void>   resolve / prefetch URLs for stored images
     KBData.imageUrl(path)         -> string          URL usable in <img src>

   To connect a database later, replace the body of this file with an implementation of the same
   three functions that returns data in the same shape (see README → "Data shape"). No UI code
   needs to change.

   QA-only URL options (local provider only, used to exercise figure counts and long articles):
     ?figs=0|1|3|8|12   number of figures shown on the sample article
     ?long=1            append extra text (data/qa-long-article.json) to the sample article
*/
const KBData = (() => {
  const DATA_URL = 'data/knowledge-base.json';
  const QA_LONG_URL = 'data/qa-long-article.json';
  const opts = new URLSearchParams(location.search);

  async function getJson(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
  }

  return {
    async load() {
      const db = await getJson(DATA_URL);
      const figs = opts.has('figs') && Number.isFinite(+opts.get('figs')) ? Math.max(0, Math.min(12, +opts.get('figs'))) : null;
      let entries = (db.entries || []).map(e => e.figures
        ? { ...e, figures: e.figures.filter(f => figs === null ? f.defaultVisible !== false : f.order <= figs) }
        : e);
      if (opts.get('long') === '1') {
        const patch = await getJson(QA_LONG_URL);
        entries = entries.map(e => e.id !== patch.entryId ? e
          : { ...e, ...Object.fromEntries(Object.entries(patch.append).map(([k, v]) => [k, (e[k] || '') + v])) });
      }
      return { categories: db.categories || [], entries, defaultEntryId: db.defaultEntryId || null };
    },
    async prepareImages() { /* local files need no preparation */ },
    imageUrl(path) { return path; }
  };
})();
