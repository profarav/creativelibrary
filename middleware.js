/**
 * Everything except the sign-in page and Slack's endpoint needs a signed-in
 * @goprimer email (see lib/session.js).
 */
import { next } from "@vercel/functions";
import { emailFrom } from "./lib/session.js";

export const config = { matcher: ["/((?!login|api/login|api/slack).*)"] };

export default async function middleware(request) {
  if (await emailFrom(request)) return next();
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return Response.json({ error: "Sign in first." }, { status: 401 });
  const to = new URL("/login", request.url);
  if (url.pathname !== "/") to.searchParams.set("next", url.pathname + url.search);
  return Response.redirect(to, 302);
}
