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
└── Backend/              # (to come) API / server — a sibling workspace
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

These will be extended to cover the Backend workspace once it exists.

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
