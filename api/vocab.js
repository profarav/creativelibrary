/**
 * /api/vocab — the industries, themes and clients people can file under.
 *
 *   GET                          everything (built-in + added by the team)
 *   POST {kind, name}            add one; kind is "industry", "theme" or "client"
 */
import { getVocab, addTerm } from "../lib/terms.js";

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  return json(await getVocab());
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Send {kind, name} as JSON." }, 400); }
  try {
    const { vocab, name, existed } = await addTerm(body.kind, body.name);
    return json({ vocab, name, existed }, existed ? 200 : 201);
  } catch (e) {
    return json({ error: e.message }, e.status || 500);
  }
}
