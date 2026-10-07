/**
 * Pull everything already posted in #creative-inspiration into the library.
 *
 *   vercel env pull .env.local     # once, to get the tokens
 *   npm run backfill               # whole history
 *   npm run backfill -- 2026-01-01 # only posts since a date
 *
 * Safe to re-run: posts already in the library are skipped.
 */
import fs from "node:fs";

for (const line of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { slackApi, ingestMessage } = await import("../lib/slack.js");
const { listCreatives } = await import("../lib/store.js");

const token = process.env.SLACK_BOT_TOKEN;
if (!token) throw new Error("SLACK_BOT_TOKEN is missing — run `vercel env pull .env.local` first.");
if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is missing — run `vercel env pull .env.local` first.");

const name = (process.env.SLACK_CHANNEL_NAME || "creative-inspiration").replace(/^#/, "");
let channel = process.env.SLACK_CHANNEL_ID;
if (!channel) {
  let cursor;
  do {
    const page = await slackApi("conversations.list",
      { types: "public_channel,private_channel", limit: 1000, exclude_archived: true, ...(cursor && { cursor }) }, token);
    channel = page.channels.find((c) => c.name === name)?.id;
    cursor = page.response_metadata?.next_cursor;
  } while (!channel && cursor);
}
if (!channel) throw new Error(`Can't see #${name}. Invite the bot to it: /invite @Creative Library`);

const since = process.argv[2] ? Date.parse(process.argv[2]) / 1000 : 0;
const clients = [...new Set((await listCreatives()).map((c) => c.client).filter(Boolean))];

const messages = [];
let cursor;
do {
  const page = await slackApi("conversations.history",
    { channel, limit: 200, ...(since && { oldest: since }), ...(cursor && { cursor }) }, token);
  messages.push(...page.messages);
  cursor = page.response_metadata?.next_cursor;
} while (cursor);

console.log(`#${name}: ${messages.length} messages${since ? ` since ${process.argv[2]}` : ""}`);
let saved = 0, done = 0;
for (const msg of messages.reverse()) {
  try {
    saved += await ingestMessage(msg, { channel, channelName: name, token, clients });
  } catch (e) {
    console.warn(`  skipped ${msg.ts}: ${e.message}`);
  }
  if (++done % 25 === 0) console.log(`  ${done}/${messages.length} read, ${saved} added`);
}
console.log(`Done — ${saved} new creatives added.`);
