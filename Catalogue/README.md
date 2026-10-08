# Catalogue

The Maple Furnishers collection-catalogue viewer — a small Vite + React
Router SPA.

## Routes

| Route | What it shows |
| --- | --- |
| `/` | Landing page listing the collections |
| `/chairs-collections`, `/sofa-collections`, `/beds-collections`, `/table-collections` | A family's collection page |
| `/<family>/<slug>` (e.g. `/table-collections/side-tables`) | One collection's PDF viewer |
| `/cafe-collections`, `/restaurants`, `/nimbus-collection`, `/storage`, `/outdoor` | A catalogue PDF opened directly |
| `/tables`, `/tables/<slug>` | Short forms, redirected to `/table-collections…` |
| `/catalogue-1…3/…`, `/cafe`, `/nimbus` | Old links, redirected to the named routes |

The slugs live in `src/catalogues.ts`; the object keys are the URL segments.

On desktop the PDFs render in an in-page iframe. On touch devices the app
links straight to the PDF instead, because iOS WebKit renders only the first
page of an iframed PDF and Android often refuses to render one at all — the
native viewer scrolls, zooms and paginates properly.

## How it's served

The app is reachable from two places:

1. **Its own Vercel project** — `maple-furnishers-catalogue` (production
   alias `catalogue-eta-three.vercel.app`), with an SPA rewrite
   (`vercel.json`).
2. **The main site** — `maple-furnishers.vercel.app/catalogue`, which
   proxies this deployment via the rewrites in `Frontend/next.config.ts`.

`src/main.tsx` picks the router basename at runtime (`/catalogue` when
proxied, `/` on the app's own domain) so both entries work from one build.

## Deploy

This folder is CLI-linked to the `maple-furnishers-catalogue` project
(`.vercel/`, gitignored). To ship catalogue changes:

```bash
npx vercel deploy --prod
```

> **Git caveat:** the Vercel project is still git-connected to the old
> standalone `maple-studios-co-in/catalogue` repo, so a push THERE would
> overwrite a CLI deploy from here. Treat this folder as the source of
> truth; ideally repoint the project in the Vercel dashboard (Settings →
> Git → connect `MapleFurnishersRevamp`, Settings → General → Root
> Directory `Catalogue`) or archive the standalone repo. A second, unused
> Vercel project named `catalogue` also exists — nothing references it.

## Develop

From the monorepo root:

```bash
npm run dev:catalogue        # Vite dev server on http://localhost:5173
npm run build:catalogue      # tsc -b && vite build → Catalogue/dist/
npm run preview:catalogue    # serve the production build locally
npm run lint:catalogue
```

## Adding a collection

1. Drop the PDF into `public/catalogues/`.
2. Add an entry to `CATALOGUES` in `src/App.tsx` (index label, title, route,
   pdf path) and a matching `<Route>` in `App`.
