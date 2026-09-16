# Creative Library

A unified creative library for Klimt & Design — every ad the agency has saved, in one
filterable board, separate from the on-demand platform and usable by both teams.

This is a **working prototype**: real interaction, real information design, sample data.

## What's in it

| Section | What it does |
| --- | --- |
| **All creative** | The board. Filter by ad type (images / video), industry and client, or search. Click anything for the detail view. |
| **Boards** | The buckets from the brief — one per industry, one per client. Open one to see just that board. |
| **From Slack** | Whatever the bot pulled out of `#creative-inspiration`, waiting to be filed. Pick a client and industry, hit Add. |
| **Competitors** | Scanned weekly. Anything a competitor has kept running over a week saves itself here with a "Live N wks" badge. |

Saved items and anything you add persist in the browser via `localStorage`.

## Design

Deliberately plain: a Pinterest-style masonry board, system type, and filters that sit in
one row above it. Nothing competes with the creative itself. Works in light and dark.

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
- A view for the shortlist; **Save** currently only marks creatives
- Auth, and any notion of who is looking
