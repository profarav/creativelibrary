/**
 * The filing vocabulary in use: the built-in lists from vocab.js plus any
 * industries, themes and clients the team added from the website.
 */
import { INDUSTRIES, THEMES, KEYWORDS } from "./vocab.js";
import { getSetting, saveSetting } from "./store.js";

const EMPTY = { industries: [], themes: [], clients: [] };
const KINDS = { industry: "industries", theme: "themes", client: "clients" };

export async function getVocab() {
  const added = { ...EMPTY, ...(await getSetting("vocab", EMPTY)) };
  const industries = [...INDUSTRIES, ...added.industries.filter((x) => !INDUSTRIES.includes(x))];
  const themes = [...THEMES, ...added.themes.filter((x) => !THEMES.includes(x))];
  // A name someone adds is also a Slack keyword for itself.
  const keywords = { industry: { ...KEYWORDS.industry }, theme: { ...KEYWORDS.theme } };
  for (const i of added.industries) keywords.industry[i] ??= [i.toLowerCase()];
  for (const t of added.themes) keywords.theme[t] ??= [t.toLowerCase()];
  return { industries, themes, clients: added.clients, keywords };
}

/** Add an industry, theme or client. Returns the vocabulary afterwards. */
export async function addTerm(kind, raw) {
  const key = KINDS[kind];
  if (!key) throw Object.assign(new Error("Pick industry, theme or client."), { status: 400 });
  const name = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!name) throw Object.assign(new Error("Give it a name."), { status: 400 });
  const vocab = await getVocab();
  const existing = (key === "clients" ? vocab.clients : vocab[key]).find((x) => x.toLowerCase() === name.toLowerCase());
  if (existing) return { vocab, name: existing, existed: true };
  const added = { ...EMPTY, ...(await getSetting("vocab", EMPTY)) };
  added[key] = [...added[key], name];
  await saveSetting("vocab", added);
  return { vocab: await getVocab(), name, existed: false };
}
