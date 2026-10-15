/**
 * Load a folder of creatives (images and/or videos) into the library under one theme.
 *
 *   vercel env pull .env.local
 *   npm run import -- "~/Downloads/Nails" --theme "Nails"
 *   npm run import -- ./editing --theme Editing --dry     # list what it would do
 *
 * For each file: uploads it (images resized to 1600px, HEIC converted; videos get a
 * thumbnail and stay playable), files it under the theme, and asks Claude for the
 * industry, client and a "what's good" line. An industry Claude isn't sure of is
 * marked as a guess. Re-running skips files already imported (matched by content).
 * macOS: uses sips and ffmpeg.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { getVocab } = await import("../lib/terms.js");
const { themes: THEMES } = await getVocab();
const { getCreative, saveCreative, putImage, shapeOf } = await import("../lib/store.js");
const { classify } = await import("../lib/classify.js");
const { put } = await import("@vercel/blob");

const args = process.argv.slice(2);
const dir = (args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--theme") || "").replace(/^~/, os.homedir());
const theme = args[args.indexOf("--theme") + 1];
const dry = args.includes("--dry");
if (!dir || !fs.existsSync(dir)) throw new Error(`Folder not found: ${dir || "(none given)"}`);
if (!THEMES.includes(theme)) throw new Error(`--theme must be one of: ${THEMES.join(", ")}`);

const IMG = /\.(jpe?g|png|webp|gif|heic|heif)$/i, VID = /\.(mp4|mov|m4v|webm)$/i;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.name.startsWith(".") ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(dir).filter((f) => IMG.test(f) || VID.test(f)).sort();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "creative-import-"));
const run = (cmd, a) => execFileSync(cmd, a, { stdio: ["ignore", "pipe", "ignore"] }).toString();

/** Resize to ≤1600px and make it a JPEG/PNG the browser and Claude can read. */
function prepImage(file) {
  const heic = /\.(heic|heif)$/i.test(file);
  const out = path.join(tmp, path.basename(file).replace(/\.\w+$/, heic ? ".jpg" : path.extname(file)));
  try {
    run("sips", [...(heic ? ["-s", "format", "jpeg"] : []), "-Z", "1600", file, "--out", out]);
  } catch { fs.copyFileSync(file, out); }
  const dims = run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", out]);
  const w = Number(/pixelWidth: (\d+)/.exec(dims)?.[1]) || 0, h = Number(/pixelHeight: (\d+)/.exec(dims)?.[1]) || 0;
  const ext = path.extname(out).slice(1).toLowerCase().replace("jpg", "jpeg");
  return { bytes: fs.readFileSync(out), type: `image/${ext}`, w, h };
}

/** A poster frame, size and length for a video; .mov is re-wrapped as .mp4 so every browser plays it. */
function prepVideo(file) {
  const info = JSON.parse(run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file]));
  const w = info.streams?.[0]?.width || 0, h = info.streams?.[0]?.height || 0, secs = Math.round(Number(info.format?.duration) || 0);
  const poster = path.join(tmp, path.basename(file) + ".jpg");
  run("ffmpeg", ["-y", "-v", "error", "-ss", String(Math.min(1, secs / 2)), "-i", file, "-frames:v", "1", "-vf", "scale='min(1200,iw)':-2", poster]);
  let video = file;
  if (/\.mov$/i.test(file)) {
    const mp4 = path.join(tmp, path.basename(file).replace(/\.mov$/i, ".mp4"));
    try { run("ffmpeg", ["-y", "-v", "error", "-i", file, "-c", "copy", "-movflags", "+faststart", mp4]); video = mp4; } catch {}
  }
  return { poster: fs.readFileSync(poster), w, h, dur: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`, video };
}

console.log(`${files.length} file(s) in ${dir} → theme "${theme}"${dry ? " (dry run)" : ""}`);
let added = 0, skipped = 0;
for (const file of files) {
  const id = "f-" + crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 14);
  const name = path.basename(file);
  const existing = await getCreative(id);
  if (existing) { console.log(`  ${name}: already imported`); skipped++; continue; }
  if (dry) { console.log(`  ${name}: would import (${VID.test(file) ? "video" : "image"})`); continue; }

  try {
    const isVideo = VID.test(file);
    let img, w, h, dur = "", video = "";
    if (isVideo) {
      const v = prepVideo(file);
      ({ w, h, dur } = v);
      img = await putImage(v.poster, "image/jpeg", theme);
      video = (await put(`videos/${theme.toLowerCase().replace(/\W+/g, "-")}.mp4`, fs.readFileSync(v.video),
        { access: "public", addRandomSuffix: true, contentType: "video/mp4", multipart: fs.statSync(v.video).size > 50e6 })).url;
    } else {
      const i = prepImage(file);
      ({ w, h } = i);
      img = await putImage(i.bytes, i.type, theme);
    }
    const c = await classify({ text: `Saved by the team as a "${theme}" example. File name: ${name}`, img });
    const sure = c?.confident && c.industry;
    await saveCreative({
      id, status: "filed", source: "Upload", filedBy: "claude",
      industry: c?.industry || "", theme, client: c?.client || "",
      ...(sure ? {} : { tagsUnconfirmed: true }),
      type: isVideo ? "video" : "static", dur, fmt: shapeOf(w, h), w, h,
      good: c?.note || name.replace(/\.\w+$/, "").replace(/[_-]+/g, " "),
      img, ...(video && { video }),
      by: "Imported", file: name,
      claude: c ? { isAd: c.isAd, confident: c.confident, reason: c.reason, at: new Date().toISOString() } : null,
      added: new Date().toISOString(),
    });
    added++;
    console.log(`  ${name}: ${c?.industry || "industry ?"} · ${theme}${sure ? "" : " (industry is a guess)"}`);
  } catch (e) {
    console.warn(`  ${name}: FAILED — ${e.message}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Done — ${added} added, ${skipped} already there.`);
