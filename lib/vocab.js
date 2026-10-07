/**
 * The library's filing vocabulary — one copy, used by the API, the Slack
 * handler, the backfill script, and (inlined by build.js) the website.
 *
 * Edit the lists here; nothing else needs to change.
 */

export const INDUSTRIES = ["Beauty", "Finance", "Fintech", "Food & bev", "Home", "Primer Growth", "Wellness"];

export const THEMES = [
  "UGC", "Vs the alt", "Facts + Stats", "This or that", "Copy only", "Reviews/Testimonials",
  "BDQs", "Search bar", "Question box/comment response", "Organic",
];

/* Words people type with a post in #creative-inspiration → where it gets filed.
   Within each group the first match wins, so put specific phrases before loose ones. */
export const KEYWORDS = {
  industry: {
    "Primer Growth": ["primer growth", "primer"],
    "Beauty": ["beauty", "skincare", "skin", "makeup", "lip", "serum", "cosmetic"],
    "Fintech": ["fintech", "payments", "neobank"],
    "Finance": ["finance", "bank", "banking", "savings", "apy", "loan", "credit"],
    "Wellness": ["wellness", "supplement", "supplements", "vitamin", "greens", "health"],
    "Food & bev": ["food", "snack", "drink", "protein", "bev", "cpg"],
    "Home": ["home", "cleaning", "rug", "vacuum", "furniture", "decor"],
  },
  theme: {
    "Question box/comment response": ["question box", "comment", "comments", "reply", "replying"],
    "Search bar": ["search bar", "search ad", "search"],
    "Reviews/Testimonials": ["review", "reviews", "testimonial", "testimonials"],
    "This or that": ["this or that", "before/after", "before and after", "before after"],
    "Vs the alt": ["vs the alt", "vs", "versus", "alternative", "compared"],
    "Facts + Stats": ["facts", "fact", "stats", "stat", "numbers", "data"],
    "Copy only": ["copy only", "copy", "text only", "type only"],
    "BDQs": ["bdq", "bdqs"],
    "Organic": ["organic", "lofi", "lo-fi", "native"],
    "UGC": ["ugc", "creator", "talking head", "pov", "fyp", "founder"],
  },
};

const normalise = (text) =>
  " " + String(text || "").toLowerCase()
    .replace(/#/g, " ")
    .replace(/[—–,.!?:;()"“”|]/g, " ")
    .replace(/\s+/g, " ")
    .trim() + " ";

/** Find the industry, theme and client a message names. Any of them may be "". */
export function tag(text, clients = []) {
  const t = normalise(text);
  const has = (w) => t.includes(" " + w + " ");
  const pick = (map) => Object.keys(map).find((k) => map[k].some(has)) || "";
  const client = clients.find((c) => {
    const lc = c.toLowerCase();
    return has(lc) || has(lc.split(" ")[0]);
  }) || "";
  return { industry: pick(KEYWORDS.industry), theme: pick(KEYWORDS.theme), client };
}

function phrasesFor(clients) {
  return [
    ...Object.values(KEYWORDS.industry).flat(),
    ...Object.values(KEYWORDS.theme).flat(),
    ...clients.flatMap((c) => [c.toLowerCase(), c.toLowerCase().split(" ")[0]]),
  ].sort((a, b) => b.length - a.length);
}

/** Split a message into its leading run of filing words and the rest. */
function splitLead(text, clients = []) {
  const phrases = phrasesFor(clients);
  const full = String(text || "");
  let rest = full;
  for (;;) {
    const before = rest;
    rest = rest.replace(/^[\s—–\-:,|/·•#]+/, "");
    const lower = rest.toLowerCase();
    const hit = phrases.find((p) => lower.startsWith(p) && /^($|[\s—–\-:,.|/·•!?])/.test(lower.slice(p.length)));
    if (hit) rest = rest.slice(hit.length);
    if (rest === before) break;
  }
  return { lead: full.slice(0, full.length - rest.length), rest: rest.trim() };
}

/**
 * Drop the filing words from the front of a message so what's left reads as
 * the note: "beauty ugc kiss now — the pause is the ad" → "The pause is the ad".
 */
export function stripTags(text, clients = []) {
  const { rest } = splitLead(text, clients);
  return rest ? rest[0].toUpperCase() + rest.slice(1) : "";
}

/**
 * How a Slack post should be filed.
 *
 * Only words someone put there on purpose count towards filing it automatically:
 * the run of filing words at the start ("beauty ugc — …") and hashtags ("#beauty #ugc").
 * Words that just happen to appear mid-sentence ("…high protein…") only pre-fill the
 * suggestions for a person to confirm.
 */
export function fileFor(text, clients = []) {
  const { lead } = splitLead(text, clients);
  const squash = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
  const tags = new Set((String(text || "").match(/#[\w-]+/g) || []).map((h) => squash(h)));
  const hashWords = [...phrasesFor(clients)].filter((p) => tags.has(squash(p))).join(" , ");
  const meant = tag(`${lead} , ${hashWords}`, clients);
  const guess = tag(text, clients);
  return {
    industry: meant.industry || guess.industry,
    theme: meant.theme || guess.theme,
    client: meant.client || guess.client,
    automatic: Boolean(meant.industry && meant.theme),
  };
}
