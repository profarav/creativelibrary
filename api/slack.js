/**
 * /api/slack — Slack sends every new message in channels the bot is in here.
 *
 * Slack wants an answer within 3 seconds, so we acknowledge straight away and
 * do the download / file / save afterwards (waitUntil keeps the function alive).
 */
import { waitUntil } from "@vercel/functions";
import { verifySlack, ingestMessage, removeMessage, slackApi } from "../lib/slack.js";
import { listCreatives } from "../lib/store.js";

const ok = () => new Response("ok");

export async function POST(request) {
  const raw = await request.text();
  let body;
  try { body = JSON.parse(raw); } catch { return new Response("bad request", { status: 400 }); }

  const secret = process.env.SLACK_SIGNING_SECRET;
  // Slack checks the URL before the app's secret can be saved here, so the
  // one-time handshake is answered even without it. It only echoes a value back.
  if (body.type === "url_verification" && (!secret || verifySlack(raw, request.headers, secret))) {
    return Response.json({ challenge: body.challenge });
  }
  if (!verifySlack(raw, request.headers, secret)) return new Response("unauthorised", { status: 401 });

  // Slack retries if it thinks we were slow. The first delivery is already being handled.
  if (request.headers.get("x-slack-retry-num")) return ok();

  const ev = body.event;
  if (body.type !== "event_callback" || ev?.type !== "message") return ok();
  const only = process.env.SLACK_CHANNEL_ID;
  if (only && ev.channel !== only) return ok();

  const token = process.env.SLACK_BOT_TOKEN;
  if (ev.subtype === "message_deleted") {
    waitUntil(removeMessage(ev.channel, ev.deleted_ts).catch((e) => console.error(e)));
    return ok();
  }

  waitUntil((async () => {
    try {
      const [clients, channelName] = await Promise.all([
        listCreatives().then((all) => [...new Set(all.map((c) => c.client).filter(Boolean))]),
        slackApi("conversations.info", { channel: ev.channel }, token).then((d) => d.channel?.name).catch(() => ""),
      ]);
      const n = await ingestMessage(ev, { channel: ev.channel, channelName, token, clients });
      if (n) console.log(`filed ${n} creative(s) from ${ev.channel} ${ev.ts}`);
    } catch (e) {
      console.error("slack ingest failed", e);
    }
  })());
  return ok();
}
