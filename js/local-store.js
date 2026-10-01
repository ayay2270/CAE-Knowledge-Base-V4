/* PROTOTYPE ONLY — browser-local storage for the "新增知識" form.

   Entries created in the Add Knowledge flow are kept in this browser's LocalStorage and merged into the
   article list at start-up. Nothing is sent to GitHub, a database or any server.
   When a real backend is connected, remove this file and make the form call the data provider instead.
*/
const LocalStore = {
  KEY: 'cae-kb-v4-prototype-entries',
  list() {
    try { const v = JSON.parse(localStorage.getItem(this.KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  },
  /* Throws if the browser refuses to store the data (for example quota exceeded). */
  add(entry) {
    const all = this.list(); all.unshift(entry);
    localStorage.setItem(this.KEY, JSON.stringify(all));
  },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ } },
  count() { return this.list().length; }
};
