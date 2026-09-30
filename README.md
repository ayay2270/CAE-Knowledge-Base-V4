# CAE Knowledge Base V4

A read-only viewer for CAE troubleshooting articles (HyperMesh / OptiStruct / LS-DYNA style problems).
Each article follows **problem → cause → solution**, records approaches that did not work, notes and
references, and carries engineering figures with captions linked to the section or step they illustrate.

The interface is the approved **Concept C2** design ("figures at the end"): software tabs on top, a
chapter tree on the left, the article in the middle with an "On this page" outline on the right, a figure
gallery after the text, and a full-size image viewer.

## Status

- **Read-only.** There is no login and no create / edit / delete.
- **Local static data.** All content comes from `data/knowledge-base.json`; the sample article is
  "STEP 匯入後幾何破面，free edges 無法補面". Its figures are generated illustrations, marked **MOCK · 示意圖**
  inside each image.
- **No database yet.** V4 makes no database, authentication, or storage calls and contains no credentials.
  Connecting Supabase is planned for a later step (see below).
- Not deployed. There is no hosting or build configuration yet.

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

## Architecture

```
index.html            page shell
css/styles.css        styles of the approved C2 design
js/data-provider.js   the only file that knows where data comes from (local JSON today)
js/core.js            state, software-category helpers, text / markdown helpers
js/figures.js         figure model, article page, figure gallery, lightbox
js/ui.js              tabs, chapter tree, home / index / search pages, scroll-spy
js/main.js            start-up
data/                 knowledge-base.json (+ qa-long-article.json for ?long=1)
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

- `categories[]` — `key`, `label`, `parent_key`, `is_active`, `sort_order` (software → sub-software tree)
- `entries[]` — `id`, `category`, `title`, `tags[]`, `symptom`, `root_cause`, `solution`,
  `failed_attempts[]`, `notes`, `reference_source`, `created_at`, `updated_at`, and either
  - `figures[]` — `order`, `section` (`symptom` · `root_cause` · `solution` · `fails` · `note` · `ref`),
    `step` (`0`, a step number, or `"v"` for the verification group), `title`, `caption`, `src`, `mock`,
    `defaultVisible`; or
  - `images[]` — `path` (and optional `caption`) for stored pictures that have no section mapping yet;
    they are shown under the problem section.
- `defaultEntryId` — article opened when the URL has no `#id`.

Solution steps are written as a numbered list (`1.`, `2.`, …); figures with `step: n` attach to step *n*.

## Connecting a database later

Replace the body of `js/data-provider.js` with an implementation of the same three functions
(`load`, `prepareImages`, `imageUrl`) that returns data in the shape above. The UI does not need to change.
Keep credentials out of the repository (use environment-specific configuration that is not committed).

## Software icons

`assets/icons/hypermesh.png` and `assets/icons/lsdyna.png` are the original icons and must not be redrawn or
recoloured.
