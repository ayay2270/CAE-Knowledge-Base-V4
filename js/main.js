/* Start-up: draw the shell, load data through KBData, draw the first view. */
async function boot() {
  $('#root').innerHTML = appMarkup();
  KBH.wireSearch();
  wireUi();
  $('#list').innerHTML = `<div class="loading"><div class="spin"></div>載入中…</div>`;
  try {
    const db = await KBData.load();
    CATS = db.categories.map(c => ({ ...c }));
    S.entries = db.entries;
    APP.defaultEntryId = db.defaultEntryId;
  } catch (err) {
    $('#list').innerHTML = '';
    $('#detail').innerHTML = `<div class="c-page-wrap">${emptyHtml('ti-database-off', '資料載入失敗', esc(err.message || String(err)) + '<br>請透過本機網頁伺服器開啟（見 README），不要直接用檔案方式開啟。')}</div>`;
    return;
  }
  renderSide();
  renderList();
  afterLoad();
}

boot();
