/**
 * Creative records and images, kept in Vercel Blob.
 *
 * Each creative is one JSON file: creatives/<id>/<random>.json. Every save
 * writes a new file (so its URL is never served stale from the CDN) and then
 * removes the older ones. Images live under images/.
 *
 * Fine for a team library of a few thousand creatives; if it outgrows that,
 * swap this file for a database and nothing else has to change.
 */
import { put, list, del } from "@vercel/blob";

const PREFIX = "creatives/";

async function listAll(prefix) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

const idOf = (pathname) => pathname.slice(PREFIX.length).split("/")[0];
const newest = (a, b) => (new Date(a.uploadedAt) >= new Date(b.uploadedAt) ? a : b);

/* A record that exists must never silently drop out of a listing because one
   read hiccupped, so reads are retried before giving up. */
async function readJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch (e) {
      if (i >= tries) throw e;
    }
    if (i >= tries) throw new Error(`Couldn't read ${url}`);
    await new Promise((r) => setTimeout(r, 200 * i));
  }
}

/** Every creative, newest version of each. */
export async function listCreatives() {
  const latest = new Map();
  for (const b of await listAll(PREFIX)) {
    const id = idOf(b.pathname);
    latest.set(id, latest.has(id) ? newest(latest.get(id), b) : b);
  }
  const records = await Promise.all([...latest.values()].map((b) => readJson(b.url)));
  return records.filter(Boolean);
}

export async function getCreative(id) {
  const blobs = await listAll(`${PREFIX}${id}/`);
  if (!blobs.length) return null;
  return readJson(blobs.reduce(newest).url);
}

export async function saveCreative(record) {
  const saved = await put(`${PREFIX}${record.id}/v.json`, JSON.stringify(record), {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/json",
  });
  const stale = (await listAll(`${PREFIX}${record.id}/`)).filter((b) => b.url !== saved.url);
  if (stale.length) await del(stale.map((b) => b.url));
  return record;
}

/** Store an image and return its public URL. */
export async function putImage(body, contentType, name = "image") {
  const ext = (contentType.split("/")[1] || "jpg").replace("jpeg", "jpg").split(/[;+]/)[0];
  const safe = name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40) || "image";
  const blob = await put(`images/${safe}.${ext}`, body, { access: "public", addRandomSuffix: true, contentType });
  return blob.url;
}

/** Nearest of the three shapes the board knows, from real pixel sizes. */
export function shapeOf(w, h) {
  if (!w || !h) return "4:5";
  const r = h / w;
  return r > 1.45 ? "9:16" : r > 1.1 ? "4:5" : "1:1";
}

export const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
