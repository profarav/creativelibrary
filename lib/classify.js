/**
 * Claude sorts Slack posts nobody tagged: is it an ad, and if so which
 * industry, theme and client — plus a short "what's good" note.
 *
 * It only files a post on its own when it's sure. Everything else is left for a
 * person, with Claude's guess pre-filled and its reason shown.
 *
 * Needs ANTHROPIC_API_KEY. Without it, classify() returns null and posts simply
 * wait under Needs a look, as before.
 */
import Anthropic from "@anthropic-ai/sdk";
import { INDUSTRIES, THEMES } from "./vocab.js";

const MODEL = "claude-opus-5-5";

const SCHEMA = {
  type: "object",
  properties: {
    is_ad: { type: "string", enum: ["yes", "no", "unsure"] },
    industry: { type: "string", enum: [...INDUSTRIES, ""] },
    theme: { type: "string", enum: [...THEMES, ""] },
    client: { type: "string" },
    note: { type: "string" },
    confident: { type: "boolean" },
    reason: { type: "string" },
  },
  required: ["is_ad", "industry", "theme", "client", "note", "confident", "reason"],
  additionalProperties: false,
};

const SYSTEM = `You file posts from a performance-marketing agency's #creative-inspiration Slack channel into its creative library — a swipe file of ads the team wants to remember.

For each post decide:
- is_ad: "yes" if the post is sharing an ad or ad creative (an uploaded ad, a screenshot of one, or a link to one, e.g. a Motion, TikTok, Meta Ad Library or Instagram link) as inspiration. "no" if it is something else — an announcement, a tool or AI tip, a prompt, an SOP or doc, a question, chat. "unsure" if you can't tell.
- industry: one of ${INDUSTRIES.join(", ")} — or "" if it isn't clear.
- theme: the ad's creative format, one of ${THEMES.join(", ")} — or "" if it isn't clear. These are the team's own names for formats; only pick one when the image or message clearly shows it. A link with no image almost never shows the format.
- client: the brand or client name if the post names one, otherwise "".
- note: one short sentence on what's good about the ad, in the poster's words where possible. "" if it isn't an ad.
- If the post is only a link (no image) and it's clearly someone sharing an ad, still answer is_ad "yes" — the team files those as links.
- confident: true only if you would bet on every field you filled in. Being wrong costs more than leaving it for a person, so when in doubt say false.
- reason: one short sentence a teammate would find useful — what you were unsure about, or why it isn't an ad.`;

let client;

/**
 * @param {{text: string, img?: string, link?: string}} post  img is a public image URL
 * @returns {Promise<null | {isAd: string, industry: string, theme: string, client: string,
 *   note: string, confident: boolean, reason: string}>}
 */
export async function classify({ text, img, link }) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();

  const content = [];
  if (img) content.push({ type: "image", source: { type: "url", url: img } });
  content.push({
    type: "text",
    text: [`Message: ${text || "(no message)"}`, link && `Link: ${link}`, !img && "(no image attached)"]
      .filter(Boolean).join("\n"),
  });

  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") return null;
    const out = res.content.find((b) => b.type === "text");
    if (!out) return null;
    const r = JSON.parse(out.text);
    return { isAd: r.is_ad, industry: r.industry, theme: r.theme, client: r.client.trim(),
      note: r.note.trim(), confident: r.confident, reason: r.reason.trim() };
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error(`classify: API ${e.status}: ${e.message}`);
    else console.error("classify failed", e);
    return null;
  }
}

/**
 * Turn Claude's answer into a filing decision on the record (mutates it).
 * Only "sure" answers act on their own; everything else goes to a person.
 */
export function applyClassification(record, c) {
  if (!c) return record;
  record.claude = { isAd: c.isAd, confident: c.confident, reason: c.reason, model: MODEL, at: new Date().toISOString() };
  if (c.isAd === "no" && c.confident) {
    record.status = "skipped";
    record.autoSkipped = true;
    return record;
  }
  record.industry = c.industry || record.industry;
  record.theme = c.theme || record.theme;
  record.client = c.client || record.client;
  if (c.note && !record.goodByHand) record.good = c.note;
  // Anything Claude says is clearly an ad goes on the board — including a bare link to an ad
  // it can't see (Motion, TikTok, Meta…). If it wasn't sure of the tags, they're shown as a
  // guess for someone to correct. Only "is this even an ad?" doubts wait for a person.
  const sure = c.isAd === "yes" && c.confident && record.industry && record.theme;
  record.status = c.isAd === "yes" ? "filed" : "review";
  if (record.status === "filed") record.filedBy = "claude";
  if (record.status === "filed" && !sure) record.tagsUnconfirmed = true;
  return record;
}
