# CAE Knowledge Base V4

**Live site: https://ayay2270.github.io/CAE-Knowledge-Base-V4/** (GitHub Pages, served from `main`, root folder)

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

- **Two data sources.** By default V4 reads the local sample data (`data/knowledge-base.json`). When `js/config.js` holds a
  Supabase Project URL and **publishable** key, V4 reads categories, entries and images from Supabase instead
  (see "Supabase" below). `?source=local` forces the local data.
- **Reading needs no login.** Visitors only read. Writing needs a signed-in account (see "Phase 2" below). The site never contains a secret key, service_role key or database password.
- **新增知識** — with Supabase configured and a signed-in user it saves to the database (insert only). Without Supabase it stays a local prototype: The four-step form (基本資訊 → 內容填寫 → 附圖與其他 → 確認儲存) produces
  an entry in the normal knowledge schema, but "save" only writes to this browser's LocalStorage
  (`js/local-store.js`). In prototype mode nothing is uploaded; entries are marked **本機原型**.

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
js/config.js          Supabase Project URL + publishable key (empty = local data)
js/data-provider.js   picks the data source; the UI only talks to KBData
js/provider-local.js  local sample data (JSON)
js/provider-supabase.js  Supabase provider (anonymous reads, signed-in insert, strict request allow-list)
js/auth-ui.js         login button + dialog
js/core.js            state, software-category helpers, text / markdown helpers
js/figures.js         figure model, article page, figure gallery, lightbox
js/local-store.js     PROTOTYPE: browser-local storage for 新增知識
js/ui.js              header, category sidebar, landing / category / search pages
js/add-knowledge.js   PROTOTYPE: the 新增知識 form
js/main.js            start-up
data/                 knowledge-base.json (+ qa-long-article.json for ?long=1)
supabase/             schema.sql and seed.sql for a new V4 project
assets/brand/         Lenovo logo + hero background photo
assets/icons/         HyperMesh and LS-DYNA software icons (original files, unchanged)
assets/figures/       the sample article's illustrative (mock) figures, SVG
scripts/serve.mjs     zero-dependency static dev server
```

The UI reads data only through `KBData` in `js/data-provider.js`:

```
UI  →  KBData.load() / prepareImages() / imageUrl()  →  Supabase (if configured)  |  data/knowledge-base.json
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

## Supabase (reading)

1. Create a **new** Supabase project for V4. (The V2 production and V3 development projects are blocked in
   `js/provider-supabase.js` so V4 cannot be pointed at them by accident.)
2. In **SQL Editor** run `supabase/schema.sql`, then `supabase/seed.sql` (sample data). Both are safe to re-run.
   They create the tables, a private `kb-images` bucket and **read-only** public policies — there is no
   insert / update / delete policy yet, so nobody can write through the API.
3. Copy the **Project URL** and the **publishable key** (`sb_publishable_…`, Project Settings → API Keys) into
   `js/config.js`. The publishable key is public by design. **Never** put a secret key, a `service_role` key or the
   database password in this repository — the provider refuses anything that is not a publishable key.
4. Open the site. `document.documentElement.dataset.source` is `supabase` when the connection is used.

`supabase/seed.sql` is generated from the local sample data: `npm run seed:build`.

### How the data maps

- `software_categories` and `entries` have the columns listed under "Data shape".
- `entries.images` is JSON: each item is `{ "path": "<object path in kb-images>" }` (private bucket, shown through
  short-lived signed URLs) or `{ "src": "<static url>" }`, and may add `caption`, `title`, `section`, `step`,
  `order`, `key` so a figure attaches to a section / step exactly like the local sample.

## Phase 2 — login and saving from 新增知識

Anonymous visitors still only read. A signed-in user can **add** entries and upload images. Delete is Phase 3, edit is Phase 4.

1. In **SQL Editor** run `supabase/phase2-auth-write.sql` (safe to re-run). It grants `insert` on `entries` to the
   `authenticated` role only with `user_id = auth.uid()`, and lets a signed-in user upload into **their own folder**
   (`<user id>/…`) of the private `kb-images` bucket.
2. **Authentication → Sign In / Providers → Email**: switch **Allow new users to sign up** OFF (public sign-ups closed).
3. **Authentication → Users → Add user → Create new user**: create your account with email + password and tick
   *Auto Confirm User*. (Passwords are typed only into Supabase, never into this repository.)
4. Open the site, click **登入**, then **新增知識** → fill the form → **儲存到資料庫**.

## Phase 3 — delete your own entries

Run `supabase/phase3-delete-own.sql` in the SQL Editor (safe to re-run). A signed-in user then sees a trash button on
the entries **they created**; it deletes the entry and its images (after a confirmation). The database allows delete only
where `entries.user_id = auth.uid()` and only for files in the user's own `kb-images` folder, so the sample entries
(no author) and other people's entries cannot be deleted from the site. 

## Phase 4 — edit your own entries

Run `supabase/phase4-edit-own.sql` in the SQL Editor (safe to re-run). On an entry you created, a pencil button opens the
same four-step form filled with the entry; you can change the text, tags, category, swap / remove / add images and move
images between sections and steps. The database allows update only where `entries.user_id = auth.uid()` and only for the
content columns (title, category, tags, symptom, root_cause, solution, failed_attempts, notes, reference_source, images),
so the author, id, created_at and views cannot be changed, and sample / other people's entries cannot be edited.

How it is locked down: the browser only ever sends the requests listed in `RULES` in `js/provider-supabase.js`
(anonymous reads, sign-in/refresh/logout, one `POST` to `entries`, one `POST` per image into the user's own folder);
anything else throws before leaving the browser. Row Level Security in the database is the real gate. The login session
is kept in this browser's localStorage (`cae-kb-v4-auth`).

## Software icons

`assets/icons/hypermesh.png` and `assets/icons/lsdyna.png` are the original icons and must not be redrawn or
recoloured.

## Credits

The landing-page hero background (`assets/brand/hero-bg.jpg`) is a cropped, compressed version of
"Forested mountain valley" by Stijn te Strake (Unsplash), published under CC0 1.0 (public domain) and
available on Wikimedia Commons: <https://commons.wikimedia.org/wiki/File:Forested_mountain_valley_(Unsplash).jpg>.
