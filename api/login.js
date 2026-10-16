/**
 * /api/login
 *   POST {email}   sign in — any @goprimer address, no password
 *   GET            who's signed in
 *   DELETE         sign out
 */
import { COOKIE, allowedEmail, makeSession, emailFrom } from "../lib/session.js";

const DAYS = 30;
const cookie = (value, maxAge) =>
  `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Send your email." }, { status: 400 }); }
  const email = String(body.email || "").trim().toLowerCase();
  if (!allowedEmail(email)) {
    return Response.json({ error: "Use your Primer email — it should end in @goprimer.com." }, { status: 403 });
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret) return Response.json({ error: "Sign-in isn't set up yet (SESSION_SECRET missing)." }, { status: 500 });
  return Response.json({ email }, { headers: { "Set-Cookie": cookie(await makeSession(email, secret, DAYS), DAYS * 86400) } });
}

export async function GET(request) {
  const email = await emailFrom(request);
  return email ? Response.json({ email }) : Response.json({ error: "Not signed in." }, { status: 401 });
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie("", 0) } });
}
