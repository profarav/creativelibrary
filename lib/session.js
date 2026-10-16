/**
 * The light sign-in: any @goprimer email gets in, no password. A signed cookie
 * remembers it for 30 days. Not real authentication — a placeholder until there is.
 *
 * Web Crypto only, so the same code runs in the middleware (edge) and the API (Node).
 */
const enc = new TextEncoder();
export const COOKIE = "cl_session";
const ALLOWED = /^[^@\s]+@goprimer\.[a-z.]{2,}$/i;

export const allowedEmail = (email) => ALLOWED.test(String(email || "").trim());

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const key = (secret) => crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function makeSession(email, secret, days = 30) {
  const body = b64u(enc.encode(JSON.stringify({ e: email.trim().toLowerCase(), x: Date.now() + days * 864e5 })));
  const sig = b64u(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)));
  return `${body}.${sig}`;
}

/** The signed-in email, or null. */
export async function readSession(token, secret) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig || !secret) return null;
    if (!(await crypto.subtle.verify("HMAC", await key(secret), fromB64u(sig), enc.encode(body)))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64u(body)));
    return p.x > Date.now() && allowedEmail(p.e) ? p.e : null;
  } catch {
    return null;
  }
}

export const tokenFrom = (request) =>
  decodeURIComponent((new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(request.headers.get("cookie") || "") || [])[1] || "");

export const emailFrom = (request) => readSession(tokenFrom(request), process.env.SESSION_SECRET);
