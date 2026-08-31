# Maple Furnishers

Monorepo for the Maple Furnishers website.

## Structure

```
MapleFurnishersNew/
├── package.json          # npm-workspaces root + shared scripts + dependency list
├── package-lock.json     # single lockfile for the whole repo
├── tsconfig.base.json    # shared TypeScript compiler options
├── .gitignore            # shared ignore rules for every workspace
├── .editorconfig         # shared editor settings
├── .prettierrc           # shared formatting rules
├── Frontend/             # Next.js + TypeScript + Tailwind customer site
│   ├── package.json      #   workspace manifest — Frontend's own deps & scripts
│   ├── tsconfig.json     #   extends ../tsconfig.base.json + Next/DOM settings
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── .env.example
│   ├── public/           #   hero film + poster frames
│   └── src/
│       ├── app/          #   App Router pages, layout, global styles
│       ├── components/hero/  #   HeroIntro — cinematic scroll-locked intro
│       └── fonts/        #   Catilde (hero title font)
├── Backend/              # API / server workspace
├── AdminDashboard/       # Next.js admin app (port 3001)
└── Catalogue/            # Vite + React catalogue viewer (see "Catalogue" below)
    ├── package.json      #   workspace manifest — React Router + Vite
    ├── src/App.tsx       #   routes: / (collections), /catalogue-1, /catalogue-2
    └── public/catalogues/ #  the collection PDFs served by the viewer
```

### Why some config lives at the root and some in `Frontend/`

Everything **shared** across workspaces sits at the root, so the Frontend and a
future Backend use one copy: dependency install (`package.json` + lockfile),
ignore rules, base TypeScript options, editor and formatting settings.

Two files necessarily remain inside `Frontend/` — they are **not** duplicates
of the root files, they do a different job:

- **`Frontend/package.json`** is the workspace's own manifest (its Next/React/
  Tailwind dependencies and dev/build scripts). The root `package.json` only
  *manages* the workspaces; each workspace still declares what it needs.
- **`Frontend/tsconfig.json`** `extends` the root `tsconfig.base.json` and adds
  only the Next.js/DOM-specific bits. Next.js requires a tsconfig in the app
  folder.

When the Backend lands it follows the same pattern: its own `package.json` and a
`tsconfig.json` that extends the shared base.

## Getting started

Install once from the root (npm workspaces hoists dependencies to a single
root `node_modules`):

```bash
npm install
```

Run the frontend dev server:

```bash
npm run dev                    # from the root — proxies to the Frontend workspace
# or, from inside Frontend/
npm run dev --workspace Frontend
```

Open http://localhost:3000 (or the port your launch config uses).

## Root scripts

| Script | Runs |
| --- | --- |
| `npm run dev` | Frontend dev server |
| `npm run build` | Frontend production build |
| `npm run start` | Frontend production server |
| `npm run lint` | Frontend lint (ESLint, next/core-web-vitals) |
| `npm run dev:catalogue` | Catalogue dev server (Vite, http://localhost:5173) |
| `npm run build:catalogue` | Catalogue production build (`tsc -b && vite build`) |
| `npm run preview:catalogue` | Serve the Catalogue production build locally |
| `npm run lint:catalogue` | Catalogue lint |

`dev:api` / `build:api` / `start:api` and `dev:admin` / `build:admin` /
`start:admin` do the same for the Backend and AdminDashboard workspaces.

## Catalogue

`Catalogue/` is the collection-catalogue viewer served at
[maple-furnishers.vercel.app/catalogue](https://maple-furnishers.vercel.app/catalogue)
— a small Vite + React Router SPA: a landing page listing the collections,
plus `/catalogue-1` (Chair Collection) and `/catalogue-2` (Nimbus Collection)
PDF viewers. The PDFs themselves live in `Catalogue/public/catalogues/`.

Deployment is **separate from the Frontend**: the catalogue deploys as its own
Vercel project (`catalogue-eta-three.vercel.app`, also pushed to
`maple-studios-co-in/catalogue`), and the Frontend proxies it under
`/catalogue` via the rewrites in `Frontend/next.config.ts`, so visitors never
leave maple-furnishers.vercel.app. The SPA picks its router basename at
runtime (`/catalogue` when proxied, `/` on its own domain), so both entries
work.

To add a new collection: drop the PDF into `Catalogue/public/catalogues/` and
add an entry to `CATALOGUES` in `Catalogue/src/App.tsx`.

## Frontend — hero intro behaviour

`Frontend/src/components/hero/HeroIntro.tsx` plays the first 7.8s of the
blueprint-to-reality film full-screen on **every page load**, with page scroll
locked. At 7.2s the Catilde title fades in and takes over from the film's
baked-in text; at 7.8s the film freezes on the finished room. Scrolling
unlocks **only once the title's reveal animation has fully landed**. The intro
is skipped (final still + title shown immediately) for:

- users with `prefers-reduced-motion: reduce`,
- any autoplay/playback failure.

> **Font licence:** The Catilde font in `Frontend/src/fonts/` is the free demo
> version — **personal use only**. Buy the commercial licence (Creative Market,
> Fortunes Co) before production launch.

## Environment

Copy `Frontend/.env.example` to `Frontend/.env.local` and adjust values. Never
commit `.env*` files (the root `.gitignore` already excludes them).
