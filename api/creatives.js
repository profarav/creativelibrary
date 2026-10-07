/**
 * /api/creatives — the shared library.
 *
 *   GET                 everything that isn't removed (left-out posts too, so they can be put back)
 *   POST   {...}        add a creative by hand
 *   PATCH  {id, ...}    file a post that needed a look, leave it out, put it back, or correct its tags
 *   DELETE ?id=...      remove a creative (kept, but hidden — so a backfill won't bring it back)
 */
import { listCreatives, getCreative, saveCreative, putImage, shapeOf, newId } from "../lib/store.js";
import { INDUSTRIES, THEMES, KEYWORDS } from "../lib/vocab.js";

const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const clean = (v, max = 600) => String(v ?? "").trim().slice(0, max);

export async function GET() {
  const all = await listCreatives();
  const creatives = all
    .filter((c) => c.status !== "removed")
    .sort((a, b) => String(b.added).localeCompare(String(a.added)));
  return json({ creatives, vocab: { industries: INDUSTRIES, themes: THEMES, keywords: KEYWORDS } });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Send the creative as JSON." }, 400); }

  const good = clean(body.good, 1000), industry = clean(body.industry, 80), theme = clean(body.theme, 80);
  const missing = [!good && "what's good about it", !industry && "an industry", !theme && "a creative theme"].filter(Boolean);
  if (missing.length) return json({ error: `Add ${missing.join(", ")}.` }, 400);

  let img = clean(body.imageUrl, 2000);
  if (img && !/^https?:\/\//i.test(img)) return json({ error: "The image link has to start with http:// or https://." }, 400);
  const w = Number(body.w) || 0, h = Number(body.h) || 0;

  const data = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(body.imageData || "");
  if (data) {
    const bytes = Buffer.from(data[2], "base64");
    if (bytes.length > 4_000_000) return json({ error: "That image is too large — keep it under 4 MB." }, 413);
    img = await putImage(bytes, data[1], clean(body.client) || industry);
  }

  const record = {
    id: newId("m"),
    status: "filed",
    source: "Manual",
    industry, theme,
    client: clean(body.client, 80),
    type: body.type === "video" ? "video" : "static",
    fmt: w && h ? shapeOf(w, h) : ["9:16", "4:5", "1:1"].includes(body.fmt) ? body.fmt : "4:5",
    w, h,
    good,
    img,
    by: clean(body.by, 80) || "Someone on the team",
    added: new Date().toISOString(),
  };
  await saveCreative(record);
  return json({ creative: record }, 201);
}

export async function PATCH(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Send the change as JSON." }, 400); }
  const record = body.id && (await getCreative(clean(body.id, 120)));
  if (!record) return json({ error: "That creative no longer exists." }, 404);

  for (const k of ["industry", "theme", "client", "good"]) if (k in body) record[k] = clean(body[k], k === "good" ? 1000 : 80);
  if ("good" in body) record.goodByHand = true;
  if (body.status === "skipped") {
    record.status = "skipped";
    record.autoSkipped = false;
  } else if (body.status === "review") {
    record.status = "review"; // "Put it back": a person wants to look at it after all
    record.autoSkipped = false;
  } else if (record.industry && record.theme) {
    record.status = "filed";
    record.filedBy = "person";
  }
  record.updated = new Date().toISOString();
  await saveCreative(record);
  return json({ creative: record });
}

export async function DELETE(request) {
  const id = new URL(request.url).searchParams.get("id");
  const record = id && (await getCreative(id));
  if (!record) return json({ error: "That creative no longer exists." }, 404);
  record.status = "removed";
  record.updated = new Date().toISOString();
  await saveCreative(record);
  return json({ ok: true });
}
