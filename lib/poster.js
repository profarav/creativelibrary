/**
 * Thumbnails for videos, made on the server with ffmpeg so they don't depend on
 * the uploader's browser (which often can't grab a frame — Safari especially).
 *
 * ffmpeg reads the video straight from its URL, fetching only the bytes it needs.
 */
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { putImage, shapeOf } from "./store.js";

function ffmpeg(args, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args);
    const out = [], err = [];
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timed out")); }, timeoutMs);
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(err).toString();
      code === 0 ? resolve({ stdout: Buffer.concat(out), stderr }) : reject(new Error(stderr.split("\n").slice(-3).join(" ")));
    });
  });
}

/**
 * Make a thumbnail for a video URL. Picks a representative frame from the first few
 * seconds (not frame one, which is often black). Returns { img, w, h, dur, fmt }.
 */
export async function makePoster(videoUrl, name = "video") {
  const { stdout, stderr } = await ffmpeg([
    "-hide_banner", "-ss", "0.3", "-t", "4", "-i", videoUrl,
    "-vf", "thumbnail=48,scale='min(1200,iw)':-2", "-frames:v", "1",
    "-f", "image2", "-c:v", "mjpeg", "-q:v", "4", "pipe:1",
  ]);
  if (!stdout.length) throw new Error("no frame came out");
  // Size and length come from ffmpeg's own report on the input.
  const size = /Stream #\S+.*Video:.*?(\d{2,5})x(\d{2,5})/.exec(stderr);
  const len = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const w = size ? Number(size[1]) : 0, h = size ? Number(size[2]) : 0;
  const secs = len ? Math.round(Number(len[1]) * 3600 + Number(len[2]) * 60 + Number(len[3])) : 0;
  const img = await putImage(stdout, "image/jpeg", name);
  return { img, w, h, fmt: shapeOf(w, h), dur: secs ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : "" };
}

/** Fill in a video creative's thumbnail (and size/length) if it's missing. Mutates the record. */
export async function ensurePoster(record) {
  if (!record.video || record.img) return record;
  const p = await makePoster(record.video, record.client || record.theme || "video");
  record.img = p.img;
  if (!record.w || !record.h) { record.w = p.w; record.h = p.h; record.fmt = p.fmt; }
  if (!record.dur) record.dur = p.dur;
  return record;
}
