// Points nominations made through the old IGDB search at their Wikidata item, with Wikipedia box
// art and link. Run `pnpm migrate` first. Dry run by default; pass --apply to write.
// Usage: pnpm dlx tsx --env-file=.env.local scripts/backfill-wikidata.mts [--apply]
import { sql } from "../src/lib/db";
import { getGame, searchGames, type Game } from "../src/lib/wikidata";
import { WIKIMEDIA_HEADERS } from "../src/lib/wikipedia";

type Row = { id: string; cycle: string; title: string; platform: string; info_url: string | null };

const apply = process.argv.includes("--apply");

/** Games whose Wikidata item lists this IGDB slug (property P5794). */
async function byIgdbSlug(slug: string): Promise<Game | null> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `haswbstatement:P5794=${slug}`,
    srprop: "",
    format: "json",
    formatversion: "2",
  }).toString();
  const res = await fetch(url, { headers: WIKIMEDIA_HEADERS });
  if (!res.ok) throw new Error(`Wikidata returned ${res.status}`);
  const body = (await res.json()) as { query: { search: { title: string }[] } };
  for (const { title } of body.query.search) {
    const game = await getGame(title);
    if (game) return game;
  }
  return null;
}

async function match(row: Row): Promise<Game | null> {
  const slug = row.info_url?.match(/igdb\.com\/games\/([^/?#]+)/)?.[1];
  const game = slug ? await byIgdbSlug(slug) : null;
  if (game) return game;
  // Otherwise only trust an exact title match.
  const results = await searchGames(row.title);
  return results.find((g) => g.title.toLowerCase() === row.title.toLowerCase()) ?? null;
}

const rows = await sql<Row>`
  select id, cycle, title, platform, info_url from nominations
  where wikidata_id is null and (igdb_id is not null or info_url like '%igdb.com%' or cover_url like '%images.igdb.com%')
  order by created_at`;
console.log(`${rows.length} nomination${rows.length === 1 ? "" : "s"} from IGDB.`);

let unmatched = 0;
for (const row of rows) {
  const game = await match(row);
  if (!game) {
    unmatched++;
    console.log(`  ${row.cycle} ${row.title} (${row.platform}): no match, left as is`);
    continue;
  }
  console.log(`  ${row.cycle} ${row.title} (${row.platform}) -> ${game.wikidataId} ${game.title}, ${game.url}, ${game.cover ? "with art" : "no art"}`);
  if (!apply) continue;
  // Title, platform, and year stay as the member nominated them, and IGDB art stays when Wikipedia has none.
  try {
    await sql`update nominations set wikidata_id = ${game.wikidataId}, info_url = ${game.url} where id = ${row.id}`;
    if (game.cover) {
      const { src, width, height } = game.cover;
      await sql`update nominations set cover_url = ${src}, cover_width = ${width}, cover_height = ${height} where id = ${row.id}`;
    }
  } catch (e) {
    // Another standing nomination this cycle already has the same game.
    unmatched++;
    console.log(`    not saved: ${(e as Error).message}`);
  }
}
if (unmatched) console.log(`${unmatched} left unmatched. Fix those by hand, or leave them with their IGDB art.`);
if (!apply && rows.length > unmatched) console.log("Dry run. Pass --apply to save.");
