/**
 * Give every video creative without a thumbnail one, made from the video itself.
 *
 *   vercel env pull .env.local
 *   npm run thumbnails
 */
import fs from "node:fs";
for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { listCreatives, saveCreative } = await import("../lib/store.js");
const { ensurePoster } = await import("../lib/poster.js");

const todo = (await listCreatives()).filter((c) => c.video && !c.img && c.status !== "removed");
console.log(`${todo.length} video(s) without a thumbnail`);
let fixed = 0;
for (const rec of todo) {
  try {
    await ensurePoster(rec);
    await saveCreative(rec);
    fixed++;
    console.log(`  ✓ ${rec.theme || ""} ${rec.w}x${rec.h} ${rec.dur} — ${String(rec.good).slice(0, 40)}`);
  } catch (e) {
    console.warn(`  ✗ ${rec.id}: ${e.message}`);
  }
}
console.log(`Done — ${fixed} thumbnail(s) made.`);
