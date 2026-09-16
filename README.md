# Creative Library

A unified creative library for Klimt & Design — every ad the agency has saved, in one
filterable board, separate from the on-demand platform and usable by both teams.

This is a **working prototype**: real interaction, real information design, sample data.

## What's in it

| Section | What it does |
| --- | --- |
| **Library** | The board. Filter by ad type (static / video), industry, client and source; search hooks, clients and notes; sort by recency, client or CTR. Click any print for the spec sheet. |
| **Boards** | The buckets from the brief — industry and client — each showing its video/static mix. Opening one drops you into the filtered board. |
| **Needs sorting** | Triage for whatever the bot lifts out of `#creative-inspiration`. Tag the client and industry and it files itself; the original Slack message travels with it as the note. |
| **Competitor watch** | Brand sets swept weekly. An ad still running after seven days is treated as working and saves itself here, with a weeks-live track. |

Saved items and anything you add persist in the browser via `localStorage`.

## Design

A proof sheet on a light table: prints with white mats and registration crop marks, mono
spec strips, condensed poster type (Archivo's variable width axis at 68–80%), one
registration-red accent doing the interactive work and amber reserved for the live-ad
signal. Light and dark are designed as a pair — the dark theme is a darkroom, not an
inversion.

## Sample data

Everything in `creative-library.html` is **illustrative**. Client names, spend, CTR, hook
rates and Slack messages are invented to show the shape of the real thing. None of the
figures are real performance data. Phase 1 replaces `SEED` and `INBOX_SEED` with the
Motion export and the Slack backfill.

## Running it

```bash
npm run build     # regenerate index.html from the source
npm run dev       # build, then serve on localhost
```

`creative-library.html` is the **source**. `index.html` is generated from it by
`build.js`, which adds the document skeleton (charset, viewport, meta, favicon) that the
Artifact host supplies in preview. Edit the source, then rebuild — never edit
`index.html` directly.

## Deploying

Vercel builds from `vercel.json`: `node build.js` regenerates `index.html` from the
source, output directory is the repo root. Clean URLs and security headers are set there
too. The GitHub repo is connected, so a push to `main` deploys.

To deploy from the CLI:

```bash
npx vercel --prod
```

## Not built yet

- Real asset storage and thumbnails (frames are generated from CSS, not the actual ads)
- The Motion and Slack connections themselves — the bot, the export, the sync
- A view for the shortlist; **Save** currently only marks prints
- Auth, and any notion of who is looking
