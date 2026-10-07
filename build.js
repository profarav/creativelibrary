/**
 * Builds the website: src/app.html → public/index.html.
 *
 *   npm run build
 *
 * - inlines lib/vocab.js (industries, themes, Slack keywords) so the site and
 *   the Slack handler always file things the same way
 * - wraps the page in a full document (charset, viewport, meta, favicon)
 *
 * Edit src/app.html and lib/vocab.js — never public/index.html.
 */
import fs from "node:fs";

const src = fs.readFileSync("src/app.html", "utf8");
const vocab = fs.readFileSync("lib/vocab.js", "utf8").replace(/^export /gm, "");
if (!src.includes("/*@vocab*/")) throw new Error("src/app.html is missing the /*@vocab*/ marker");

const body = src.replace("/*@vocab*/", () => vocab);
const title = (/<title>(.*?)<\/title>/.exec(body) || [, "Creative Library"])[1];
const styleBlock = (/<style>[\s\S]*?<\/style>/.exec(body) || [""])[0];
const markup = body.replace(/<title>[\s\S]*?<\/title>/, "").replace(styleBlock, "").trim();
const description = "The agency's shared creative library — every ad worth remembering, filed by industry, theme and client.";
const favicon = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="2" width="9" height="12" rx="2.5" fill="#111"/>' +
  '<rect x="13" y="2" width="9" height="7" rx="2.5" fill="#C23A2B"/><rect x="2" y="16" width="9" height="6" rx="2.5" fill="#C23A2B"/>' +
  '<rect x="13" y="11" width="9" height="11" rx="2.5" fill="#111"/></svg>');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<link rel="icon" href="${favicon}">
<style>img{max-width:100%}[hidden]{display:none!important}</style>
${styleBlock}
</head>
<body>
${markup}
</body>
</html>
`;

fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/index.html", html);
console.log(`built public/index.html (${(html.length / 1024).toFixed(1)} kB)`);
