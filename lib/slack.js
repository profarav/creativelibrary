/**
 * Turning #creative-inspiration posts into creatives. Shared by the live
 * event handler (api/slack.js) and the history backfill (scripts/backfill-slack.js).
 */
import crypto from "node:crypto";
import { fileFor, stripTags } from "./vocab.js";
import { getCreative, saveCreative, putImage, shapeOf } from "./store.js";
import { classify, applyClassification } from "./classify.js";

/** Slack signs every request; reject anything that isn't from Slack or is older than 5 minutes. */
export function verifySlack(rawBody, headers, secret) {
  const ts = headers.get("x-slack-request-timestamp");
  const sig = headers.get("x-slack-signature");
  if (!secret || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const mine = "v0=" + crypto.createHmac("sha256", secret).update(`v0:${ts}:${rawBody}`).digest("hex");
  return mine.length === sig.length && crypto.timingSafeEqual(Buffer.from(mine), Buffer.from(sig));
}

export async function slackApi(method, params, token) {
  const url = `https://slack.com/api/${method}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack ${method}: ${data.error}`);
  return data;
}

/** Slack's markup → plain text. */
export function cleanText(t = "") {
  return t
    .replace(/<https?:[^>]+>/g, "") // links are kept separately on the creative
    .replace(/<@[A-Z0-9]+(\|[^>]+)?>/g, "")
    .replace(/<#[A-Z0-9]+\|([^>]*)>/g, "#$1")
    .replace(/<![^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
const firstLink = (t = "") => (/<(https?:\/\/[^>|]+)/.exec(t) || [])[1] || "";

const people = new Map();
async function nameOf(user, token) {
  if (!user) return "Someone";
  if (!people.has(user)) {
    const p = await slackApi("users.info", { user }, token).then((d) => d.user).catch(() => null);
    people.set(user, p?.profile?.display_name || p?.real_name || p?.name || "Someone");
  }
  return people.get(user);
}

async function download(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const type = res.headers.get("content-type") || "";
  // Without files:read Slack answers with its login page, not the file.
  if (!res.ok || !/^image\//.test(type)) return null;
  return { bytes: Buffer.from(await res.arrayBuffer()), type };
}

/* Link previews worth showing. Motion's preview is its own marketing image for every
   link, so it's skipped — those creatives show a colour block and an "Open in Motion" link. */
const GENERIC_PREVIEW = /(^|\.)motionapp\.com$/i;

/** Slack's preview image for a posted link, fetched WITHOUT the Slack token (it's another site). */
async function previewImage(msg) {
  for (const a of msg.attachments || []) {
    const src = a.image_url || a.thumb_url;
    const host = (() => { try { return new URL(a.from_url || a.original_url || src).hostname; } catch { return ""; } })();
    if (!src || GENERIC_PREVIEW.test(host)) continue;
    const res = await fetch(src).catch(() => null);
    const type = res?.headers.get("content-type") || "";
    if (res?.ok && /^image\//.test(type)) {
      return { bytes: Buffer.from(await res.arrayBuffer()), type, w: a.image_width || a.thumb_width || 0, h: a.image_height || a.thumb_height || 0 };
    }
  }
  return null;
}

/** A screenshot the poster added in their own post's thread — common when a Motion link
    doesn't open for people. Downloaded with the Slack token (it's a Slack file). */
async function threadImage(msg, channel, token) {
  if (!msg?.reply_count) return null;
  const r = await slackApi("conversations.replies", { channel, ts: msg.ts, limit: 100 }, token).catch(() => null);
  const reply = r?.messages?.slice(1).find((m) => m.user === msg.user && (m.files || []).some((f) => /^image\//.test(f.mimetype || "")));
  const f = reply?.files.find((x) => /^image\//.test(x.mimetype || ""));
  if (!f) return null;
  const file = await download(f.url_private_download || f.url_private, token);
  return file && { ...file, w: f.original_w || 0, h: f.original_h || 0 };
}

/** Ids are derived from the message, so a retried event or a re-run backfill never duplicates. */
export const slackId = (channel, ts, i) => `slack-${channel}-${String(ts).replace(".", "")}-${i}`;

/**
 * Save the creatives in one message: one per image or video, or one for a
 * bare link. Returns how many new creatives were saved.
 */
export async function ingestMessage(msg, { channel, channelName, token, clients = [] }) {
  if (!msg || msg.bot_id || (msg.thread_ts && msg.thread_ts !== msg.ts)) return 0;
  if (msg.subtype && !["file_share", "thread_broadcast"].includes(msg.subtype)) return 0;

  const media = (msg.files || []).filter((f) => /^(image|video)\//.test(f.mimetype || ""));
  const link = firstLink(msg.text);
  if (!media.length && !link) return 0; // conversation, not a creative

  const text = cleanText(msg.text);
  const tags = fileFor(text, clients);
  const by = await nameOf(msg.user, token);
  const permalink = await slackApi("chat.getPermalink", { channel, message_ts: msg.ts }, token)
    .then((d) => d.permalink).catch(() => "");
  const items = media.length ? media : [null];

  let saved = 0;
  for (let i = 0; i < items.length; i++) {
    const id = slackId(channel, msg.ts, i);
    if (await getCreative(id)) continue;
    const f = items[i];
    const isVideo = !!f && f.mimetype.startsWith("video/");
    let w = f?.original_w || f?.thumb_video_w || 0, h = f?.original_h || f?.thumb_video_h || 0;

    let img = "";
    const source = isVideo ? f.thumb_video : f?.url_private_download || f?.url_private;
    const file = source ? await download(source, token)
      : !f ? (await threadImage(msg, channel, token)) || (await previewImage(msg)) : null;
    if (file) {
      img = await putImage(file.bytes, file.type, tags.client || tags.industry || "slack");
      if (!w && file.w) { w = file.w; h = file.h; }
    }

    const record = {
      id,
      status: tags.automatic ? "filed" : "review",
      filedBy: tags.automatic ? "tags" : undefined,
      source: "Slack",
      industry: tags.industry,
      theme: tags.theme,
      client: tags.client,
      type: isVideo ? "video" : "static",
      dur: isVideo && f.duration_ms ? `${Math.floor(f.duration_ms / 60000)}:${String(Math.round(f.duration_ms / 1000) % 60).padStart(2, "0")}` : "",
      fmt: shapeOf(w, h),
      w, h,
      good: stripTags(text, clients),
      text,
      img,
      link,
      by,
      channel: channelName ? `#${channelName}` : "#creative-inspiration",
      permalink,
      added: new Date(Number(msg.ts) * 1000).toISOString(),
    };
    // Tagged posts are filed as tagged. Untagged ones go to Claude, which only
    // files them itself when it's sure.
    if (!tags.automatic) applyClassification(record, await classify({ text, img, link }));
    await saveCreative(record);
    saved++;
  }
  return saved;
}

/**
 * When the poster adds a screenshot in their post's thread after the fact, put it on the
 * creative (if it doesn't have an image yet) and let Claude take another look.
 */
export async function addThreadImage(channel, parentTs, token) {
  const rec = await getCreative(slackId(channel, parentTs, 0));
  if (!rec || rec.img || rec.status === "removed") return false;
  const parent = (await slackApi("conversations.replies", { channel, ts: parentTs, limit: 1 }, token)).messages?.[0];
  const file = await threadImage(parent, channel, token);
  if (!file) return false;
  rec.img = await putImage(file.bytes, file.type, rec.client || rec.industry || "slack");
  rec.w = file.w; rec.h = file.h; rec.fmt = shapeOf(file.w, file.h);
  if (rec.filedBy !== "person" && rec.filedBy !== "tags") {
    delete rec.tagsUnconfirmed;
    applyClassification(rec, await classify({ text: rec.text, img: rec.img, link: rec.link }));
  }
  await saveCreative(rec);
  return true;
}

/** A post deleted in Slack disappears from the library too. */
export async function removeMessage(channel, ts) {
  for (let i = 0; i < 10; i++) {
    const rec = await getCreative(slackId(channel, ts, i));
    if (!rec) break;
    rec.status = "removed";
    await saveCreative(rec);
  }
}
