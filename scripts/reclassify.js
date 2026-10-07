/**
 * Ask Claude to sort the posts that are waiting under Needs a look.
 *
 *   vercel env pull .env.local
 *   npm run reclassify            # waiting Slack posts
 *   npm run reclassify -- --dry   # show what it would do, change nothing
 *
 * Posts it's sure about are filed (or left out, if they aren't ads); the rest
 * stay waiting with Claude's guess and reason attached.
 */
import fs from "node:fs";

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is missing — add it on Vercel, then `vercel env pull .env.local`.");

const { classify, applyClassification } = await import("../lib/classify.js");
const { listCreatives, saveCreative } = await import("../lib/store.js");
const dry = process.argv.includes("--dry");

const waiting = (await listCreatives()).filter((c) => c.status === "review" && c.source === "Slack");
console.log(`${waiting.length} post(s) waiting${dry ? " (dry run)" : ""}`);
for (const rec of waiting) {
  const before = rec.status;
  applyClassification(rec, await classify({ text: rec.text, img: rec.img, link: rec.link }));
  const label = rec.status === "filed" ? `FILED  ${rec.industry} · ${rec.theme}` : rec.status === "skipped" ? "LEFT OUT (not an ad)" : `WAITING ${rec.industry || "?"} · ${rec.theme || "?"}`;
  console.log(`  ${label.padEnd(36)} ${String(rec.text).slice(0, 50)}\n      ${rec.claude?.reason || ""}`);
  if (!dry && (rec.status !== before || rec.claude)) await saveCreative(rec);
}
