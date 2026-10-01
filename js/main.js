/* Start-up: draw the shell, load data through KBData, draw the first view. */
async function boot() {
  $('#root').innerHTML = appMarkup();
  KBH.wireSearch();
  wireUi();
  $('#detail').innerHTML = `<div class="loading"><div class="spin"></div>載入中…</div>`;
  try {
    const db = await KBData.load();
    CATS = db.categories.map(c => ({ ...c }));
    /* PROTOTYPE: entries created with 新增知識 live in this browser's LocalStorage (js/local-store.js). */
    S.entries = [...LocalStore.list(), ...db.entries];
  } catch (err) {
    const hint = KBData.id === 'supabase' ? '請檢查 js/config.js 的設定、Supabase 專案狀態與網路連線。' : '請透過本機網頁伺服器開啟（見 README），不要直接用檔案方式開啟。';
    $('#detail').innerHTML = `<div class="c-page-wrap">${emptyHtml('ti-database-off', '資料載入失敗', esc(err.message || String(err)) + '<br>' + hint)}</div>`;
    return;
  }
  renderSide();
  afterLoad();
}

boot();
