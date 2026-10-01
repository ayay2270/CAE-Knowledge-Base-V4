# CAE Knowledge Base V4

A viewer for CAE troubleshooting articles (HyperMesh / OptiStruct / LS-DYNA style problems).
Each article follows **problem → cause → solution**, records approaches that did not work, notes and
references, and carries engineering figures with captions linked to the section or step they illustrate.

## Interface

- **Header** — Lenovo logo + "CAE Knowledge Base", global search, and a **+ 新增知識** button.
- **知識分類 sidebar** — 所有文章 · HyperWorks (HyperMesh, OptiStruct) · LS-DYNA, with article counts.
- **所有文章** (landing) — a larger search field and the articles grouped by software / category.
- **Category pages** — description, child-category cards (for HyperWorks) and the article list.
- **Article page** — the approved Concept C2 reading view: breadcrumb, sections (現象 · 原因分析 · 解決方法 ·
  試過但無效 · 備註 · 參考來源), "On this page" outline, figure gallery after the text, full-size image viewer,
  previous / next article.

## Status

- **Local static data.** All content comes from `data/knowledge-base.json`; the sample article is
  "STEP 匯入後幾何破面，free edges 無法補面". Its figures are generated illustrations, marked **MOCK · 示意圖**
  inside each image.
- **No database yet.** V4 makes no database, authentication, or storage calls and contains no credentials.
  Connecting Supabase is planned for a later step (see below).
- **新增知識 is a local prototype.** The four-step form (基本資訊 → 內容填寫 → 附圖與其他 → 確認儲存) produces
  an entry in the normal knowledge schema, but "save" only writes to this browser's LocalStorage
  (`js/local-store.js`). Nothing is uploaded; entries are marked **本機原型**.

## Run locally

Requires Node.js 18+ (no packages to install).

```bash
npm start
```

Open <http://localhost:8080> (`PORT=3000 npm start` to use another port). The page must be served over
HTTP because it loads `data/knowledge-base.json` with `fetch`; opening `index.html` as a file will not work.
Any static server works, for example `python -m http.server 8080`.

Web fonts (Google Fonts) and the Tabler icon font (jsDelivr) are loaded from their CDNs.

### QA options

The sample article can be shown in different states through the URL:

| URL | Effect |
| --- | --- |
| `/?figs=0` … `?figs=12` | number of figures on the sample article (0, 1, 3, 8, 12; default 8) |
| `/?long=1` | adds extra text to the sample article to exercise long-article layout |
| `/#<entry id>` | opens a specific article |
| `/#cat/<category key>` | opens a category page (for example `#cat/hm`) |

## Architecture

```
index.html            page shell
css/styles.css        styles
js/data-provider.js   the only file that knows where data comes from (local JSON today)
js/core.js            state, software-category helpers, text / markdown helpers
js/figures.js         figure model, article page, figure gallery, lightbox
js/local-store.js     PROTOTYPE: browser-local storage for 新增知識
js/ui.js              header, category sidebar, landing / category / search pages
js/add-knowledge.js   PROTOTYPE: the 新增知識 form
js/main.js            start-up
data/                 knowledge-base.json (+ qa-long-article.json for ?long=1)
assets/brand/         Lenovo logo + hero background photo
assets/icons/         HyperMesh and LS-DYNA software icons (original files, unchanged)
assets/figures/       the sample article's illustrative (mock) figures, SVG
scripts/serve.mjs     zero-dependency static dev server
```

The UI reads data only through `KBData` in `js/data-provider.js`:

```
UI  →  KBData.load() / prepareImages() / imageUrl()  →  data/knowledge-base.json (for now)
```

### Data shape

`data/knowledge-base.json`:

- `categories[]` — `key`, `label`, `parent_key`, `is_active`, `sort_order`, `description`
  (software → sub-software tree)
- `entries[]` — `id`, `category` (a leaf category key), `title`, `tags[]`, `symptom`, `root_cause`, `solution`,
  `failed_attempts[]`, `notes`, `reference_source`, `created_at`, `updated_at`, and either
  - `figures[]` — `order`, `section` (`symptom` · `root_cause` · `solution` · `fails` · `note` · `ref`),
    `step` (`0`, a step number, or `"v"` for the verification group), `title`, `caption`, `src`, `mock`,
    `defaultVisible`; or
  - `images[]` — `path` (and optional `caption`) for stored pictures that have no section mapping yet;
    they are shown under the problem section.

Solution steps are written as a numbered list (`1.`, `2.`, …); figures with `step: n` attach to step *n*.

## Connecting a database later

Replace the body of `js/data-provider.js` with an implementation of the same three functions
(`load`, `prepareImages`, `imageUrl`) that returns data in the shape above, and make the 新增知識 form call the
provider instead of `LocalStore` (then delete `js/local-store.js`). Keep credentials out of the repository
(use environment-specific configuration that is not committed).

## Software icons

`assets/icons/hypermesh.png` and `assets/icons/lsdyna.png` are the original icons and must not be redrawn or
recoloured.

## Credits

The landing-page hero background (`assets/brand/hero-bg.jpg`) is a cropped, compressed version of
"Forested mountain valley" by Stijn te Strake (Unsplash), published under CC0 1.0 (public domain) and
available on Wikimedia Commons: <https://commons.wikimedia.org/wiki/File:Forested_mountain_valley_(Unsplash).jpg>.
