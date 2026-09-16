#!/usr/bin/env node
/**
 * Wraps the artifact source (creative-library.html, which is a fragment —
 * the Artifact host supplies the document skeleton) into a standalone
 * index.html for static hosting on Vercel.
 *
 *   node build.js
 *
 * Edit creative-library.html, never index.html — index.html is generated.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "creative-library.html");
const OUT = path.join(__dirname, "index.html");

const body = fs.readFileSync(SRC, "utf8");
const title = (body.match(/<title>(.*?)<\/title>/) || [, "Creative Library"])[1];
const description =
  "A unified creative library for Klimt & Design — every ad the agency has " +
  "saved, filterable by client, industry and ad type.";

// Registration mark, matching the in-app brand. Inline so the page ships no external assets.
const favicon =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
      'stroke="#BE3318" stroke-width="1.6"><circle cx="12" cy="12" r="7.2"/>' +
      '<circle cx="12" cy="12" r="2.4"/><path d="M12 .8v6M12 17.2v6M.8 12h6M17.2 12h6"/></svg>'
  );

// The source is head-ish bits (title, font link, stylesheet) followed by
// markup and script — split them so each lands in the right place.
const fontLink = (body.match(/<link rel="stylesheet"[^>]*>/) || [""])[0];
const styleBlock = (body.match(/<style>[\s\S]*?<\/style>/) || [""])[0];
const markup = body
  .replace(/<title>[\s\S]*?<\/title>/, "")
  .replace(fontLink, "")
  .replace(styleBlock, "")
  .trim();

const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#DEE2DD" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F1210" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<link rel="icon" href="${favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fontLink}
<style>
  :root{color-scheme:light dark}
  html,body{margin:0}
  img{max-width:100%}
  [hidden]{display:none!important}
</style>
${styleBlock}
</head>
<body>
${markup}
</body>
</html>
`;

fs.writeFileSync(OUT, doc);
console.log(
  `built index.html — ${title} (${(doc.length / 1024).toFixed(1)} kB)`
);
