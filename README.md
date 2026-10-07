# Creative Library

The agency's shared creative library: every ad worth remembering, in one Pinterest-style
board, filed by industry, creative theme and client. Separate from the on-demand platform,
usable by both teams.

**Live:** https://creativelibraryprimer.vercel.app

## What's in it

| Section | What it does |
| --- | --- |
| **All creative** | The board. Filter by images / video, industry, creative theme and client, or search. Click anything for the detail view. |
| **Boards** | Three tabs — Industries, Themes, Clients — one board per bucket. |
| **From Slack** | What came in from `#creative-inspiration`: posts that filed themselves, and posts that need someone to pick an industry and theme. |
| **Competitors** | For the weekly competitor scan (not switched on yet). |

Everything is shared: what one person adds, everyone sees. *Save* is a personal shortlist
and stays in your browser. Until the library has its first real creative, the board shows
sample ads with a banner saying so.

## Filing rules

Every creative needs an **industry** and a **creative theme**; the client is optional.
Adding by hand also needs *What's good about this?*

- **Industries:** Beauty, Finance, Fintech, Food & bev, Home, Primer Growth, Wellness
- **Creative themes:** UGC, Vs the alt, Facts + Stats, This or that, Copy only,
  Reviews/Testimonials, BDQs, Search bar, Question box/comment response, Organic

Both lists and the Slack keywords live in **`lib/vocab.js`** — the only place to edit them.
The website, the API and the Slack bot all read from it.

## #creative-inspiration

Post an image (or a link) and **start the message** with an industry and a theme —
`beauty ugc kiss now — love the hook` — or add them as hashtags: `#beauty #ugc`.

- **industry and theme given that way** → filed straight into the library
- **anything else** → held under *From Slack → Needs a look*, with a best guess
  pre-selected from words elsewhere in the message

Only deliberate tags file automatically, because ordinary sentences are full of words
like "home", "data" or "review". The words are matched against `KEYWORDS` in
`lib/vocab.js`.

Filing words at the start of a message are trimmed off, so the rest becomes the note.
Several images in one post become several creatives. Deleting the post in Slack removes
it from the library. Ordinary chat (no image, no link) is ignored.

### Setting up the Slack app (once)

1. https://api.slack.com/apps → **Create New App → From a manifest** → pick the workspace
   → paste `slack-app-manifest.yml` → **Create** → **Install to workspace**.
2. Copy the **Bot User OAuth Token** (*OAuth & Permissions*, starts `xoxb-`) and the
   **Signing Secret** (*Basic Information*), and add them to Vercel:
   ```bash
   vercel env add SLACK_BOT_TOKEN production
   vercel env add SLACK_SIGNING_SECRET production
   vercel --prod
   ```
3. In Slack, in `#creative-inspiration`: `/invite @Creative Library`

### Pulling in what's already in the channel

```bash
vercel env pull .env.local
npm run backfill                 # everything
npm run backfill -- 2026-01-01   # or just since a date
```

Safe to re-run — anything already in the library is skipped.

## How it's built

| Path | |
| --- | --- |
| `src/app.html` | The website (one file, no framework). Edit this, not `public/`. |
| `lib/vocab.js` | Industries, themes, Slack keywords, and the sorting. |
| `lib/store.js` | Storage — creatives and images in Vercel Blob. |
| `lib/slack.js` | Turning a Slack post into creatives. |
| `api/creatives.js` | The library API: list, add, refile, remove. |
| `api/slack.js` | Where Slack sends new posts. |
| `scripts/backfill-slack.js` | Imports the channel's history. |
| `build.js` | Builds `public/index.html` from `src/app.html` + `lib/vocab.js`. |

Pushing to `main` deploys. Storage is Vercel Blob: one JSON file per creative, plus the
images. That's comfortable into the low thousands of creatives; past that, swap
`lib/store.js` for a database — nothing else needs to change.

Local development: `vercel dev` (reads `.env.local`).

## Not built yet

- Motion import
- The weekly competitor scan
- Editing a creative's note after it's added (industry/theme/client can be refiled from Slack)
- Video playback — videos show as their thumbnail
