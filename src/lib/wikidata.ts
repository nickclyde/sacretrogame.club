// Game search through Wikidata, with box art from English Wikipedia. Both are free and need no key.

import type { Cover } from "./gotm";
import { pageCover, WIKIMEDIA_HEADERS, type WikiImage } from "./wikipedia";

export type Game = {
  wikidataId: string;
  title: string;
  year: number | null;
  platforms: string[];
  cover: Cover | null;
  url: string;
};

type Statement = { mainsnak: { datavalue?: { value: unknown } }; rank: string };

export type Entity = {
  id: string;
  labels?: Record<string, { value: string }>;
  claims?: Record<string, Statement[]>;
  sitelinks?: Record<string, { title: string }>;
};

const VIDEO_GAME = "Q7889";
const QID = /^Q\d+$/;

// Short names for common platforms, the way people say them. Others use their Wikidata label.
const PLATFORM_NAMES: Record<string, string> = {
  Q1406: "PC", // Microsoft Windows
  Q751046: "PC", // IBM PC compatible
  Q170434: "DOS",
  Q47604: "DOS", // MS-DOS
  Q14116: "Mac", // macOS
  Q13522376: "Mac", // Classic Mac OS
  Q192851: "Arcade", // arcade video game
  Q172742: "NES",
  Q183259: "SNES",
  Q30827691: "SNES Classic",
  Q184839: "N64",
  Q182172: "GameCube",
  Q188642: "GBA",
  Q170323: "DS",
  Q203597: "3DS",
  Q17679679: "New 3DS",
  Q19610114: "Switch",
  Q122761124: "Switch 2",
  Q10677: "PS1",
  Q10680: "PS2",
  Q10683: "PS3",
  Q5014725: "PS4",
  Q63184502: "PS5",
  Q170325: "PSP",
  Q188808: "PS Vita",
  Q98973368: "Xbox Series X|S",
  Q10676: "Genesis", // Sega Genesis
  Q209868: "Master System",
  Q200912: "Saturn",
  Q1047516: "Sega CD",
  Q100047: "Amiga", // Commodore Amiga
};

/** Values of an entity's statements for a property, skipping deprecated ones. */
function values(e: Entity, property: string): unknown[] {
  return (e.claims?.[property] ?? [])
    .filter((s) => s.rank !== "deprecated" && s.mainsnak.datavalue)
    .map((s) => s.mainsnak.datavalue!.value);
}

function itemIds(e: Entity, property: string): string[] {
  return values(e, property).map((v) => (v as { id: string }).id);
}

/** A video game with an English Wikipedia article, which supplies the info link and box art. */
export function isGame(e: Entity) {
  return Boolean(e.sitelinks?.enwiki) && itemIds(e, "P31").includes(VIDEO_GAME);
}

/** The English Wikipedia title without its disambiguation, like "Castlevania" for "Castlevania (1986 video game)". */
export function gameTitle(e: Entity): string {
  const article = e.sitelinks?.enwiki?.title.replace(/ \([^)]*\)$/, "");
  return article || e.labels?.en?.value || e.labels?.mul?.value || e.id;
}

function wikipediaUrl(title: string) {
  // Keep colons and slashes readable, the way Wikipedia writes its own links.
  const path = encodeURIComponent(title.replaceAll(" ", "_")).replace(/%3A/g, ":").replace(/%2F/g, "/");
  return `https://en.wikipedia.org/wiki/${path}`;
}

/** Maps an entity that passes isGame, given labels for its platforms and its box art. */
export function toGame(e: Entity, platformLabels: Map<string, string>, cover: Cover | null): Game {
  const years = values(e, "P577")
    .map((v) => Number((v as { time: string }).time.match(/^\+(\d{4})-/)?.[1]))
    .filter((y) => y > 0);
  const platforms = itemIds(e, "P400")
    .map((id) => PLATFORM_NAMES[id] ?? platformLabels.get(id))
    .filter((p): p is string => Boolean(p));
  return {
    wikidataId: e.id,
    title: gameTitle(e),
    year: years.length ? Math.min(...years) : null,
    platforms: [...new Set(platforms)].sort(),
    cover,
    url: wikipediaUrl(e.sitelinks!.enwiki.title),
  };
}

const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };

/** Lowercase words without accents or punctuation, with Roman numerals as digits. */
function words(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => ROMAN[w] ?? w);
}

/**
 * Games whose title starts a word with every word typed come first, then the more famous
 * game, measured by how many Wikipedia languages cover it. Search relevance alone often
 * buries the well-known release under ports and spinoffs.
 */
export function rank(entities: Entity[], query: string): Entity[] {
  const typed = words(query);
  const matches = (e: Entity) => {
    const title = words(gameTitle(e));
    return typed.every((w) => title.some((t) => t.startsWith(w)));
  };
  const fame = (e: Entity) => Object.keys(e.sitelinks ?? {}).length;
  return entities
    .map((e) => ({ e, match: matches(e), fame: fame(e) }))
    .sort((a, b) => Number(b.match) - Number(a.match) || b.fame - a.fame)
    .map(({ e }) => e);
}

async function mediawiki<T>(host: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({ ...params, format: "json", formatversion: "2" }).toString();
  const res = await fetch(url, { headers: WIKIMEDIA_HEADERS, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`${host} returned ${res.status}`);
  const body = (await res.json()) as T & { error?: { info: string } };
  if (body.error) throw new Error(`${host}: ${body.error.info}`);
  return body;
}

async function entities(ids: string[], props: string): Promise<Record<string, Entity>> {
  const body = await mediawiki<{ entities: Record<string, Entity> }>("www.wikidata.org", {
    action: "wbgetentities",
    ids: ids.join("|"),
    props,
    languages: "en|mul",
  });
  return body.entities;
}

// Platform names don't change, so each instance only looks one up once.
const platformLabels = new Map<string, string>();

async function loadPlatformLabels(ids: string[]) {
  const missing = [...new Set(ids)].filter((id) => !PLATFORM_NAMES[id] && !platformLabels.has(id));
  const batches = [];
  for (let i = 0; i < missing.length; i += 50) batches.push(missing.slice(i, i + 50));
  await Promise.all(
    batches.map(async (batch) => {
      const found = await entities(batch, "labels");
      for (const id of batch) {
        const label = found[id]?.labels?.en?.value ?? found[id]?.labels?.mul?.value;
        if (label) platformLabels.set(id, label);
      }
    }),
  );
}

type PageImages = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; original?: WikiImage; thumbnail?: WikiImage }[];
  };
};

/** Lead images of English Wikipedia articles, which for games are usually box art, by article title. */
async function leadImages(titles: string[]): Promise<Map<string, Cover>> {
  const covers = new Map<string, Cover>();
  if (titles.length === 0) return covers;
  const { query } = await mediawiki<PageImages>("en.wikipedia.org", {
    action: "query",
    prop: "pageimages",
    piprop: "original|thumbnail",
    pithumbsize: "500",
    pilicense: "any", // Box art is non-free, so the default of free images only would skip it.
    redirects: "1",
    titles: titles.join("|"),
  });
  const byPage = new Map<string, Cover>();
  for (const page of query?.pages ?? []) {
    const cover = pageCover(page.original, page.thumbnail);
    if (cover) byPage.set(page.title, cover);
  }
  const moved = new Map([...(query?.normalized ?? []), ...(query?.redirects ?? [])].map(({ from, to }) => [from, to]));
  for (const title of titles) {
    let page = title;
    for (let hops = 0; hops < 3 && moved.has(page); hops++) page = moved.get(page)!;
    const cover = byPage.get(page);
    if (cover) covers.set(title, cover);
  }
  return covers;
}

async function games(list: Entity[]): Promise<Game[]> {
  const titles = list.map((e) => e.sitelinks!.enwiki.title);
  // Box art is a nice extra, so a failed lookup shouldn't sink the search.
  const [covers] = await Promise.all([
    leadImages(titles).catch(() => new Map<string, Cover>()),
    loadPlatformLabels(list.flatMap((e) => itemIds(e, "P400"))),
  ]);
  return list.map((e) => toGame(e, platformLabels, covers.get(e.sitelinks!.enwiki.title) ?? null));
}

export async function searchGames(text: string): Promise<Game[]> {
  const q = text.trim();
  // The wildcard lets a half-typed last word match, like "chrono trig".
  const search = /[\p{L}\p{N}]$/u.test(q) ? `${q}*` : q;
  const found = await mediawiki<{ query: { search: { title: string }[] } }>("www.wikidata.org", {
    action: "query",
    list: "search",
    srsearch: `${search} haswbstatement:P31=${VIDEO_GAME}`,
    srlimit: "20",
    srprop: "",
  });
  const ids = found.query.search.map((r) => r.title).filter((id) => QID.test(id));
  if (ids.length === 0) return [];
  const byId = await entities(ids, "labels|claims|sitelinks");
  const list = ids.map((id) => byId[id]).filter((e): e is Entity => Boolean(e) && isGame(e));
  return games(rank(list, q).slice(0, 10));
}

export async function getGame(id: string): Promise<Game | null> {
  if (!QID.test(id)) return null;
  const e = (await entities([id], "labels|claims|sitelinks"))[id];
  return e && isGame(e) ? (await games([e]))[0] : null;
}
