// Game search through IGDB (free for non-commercial use under the Twitch Developer Services Agreement).

export type Game = {
  igdbId: number;
  title: string;
  year: number | null;
  platforms: string[];
  coverImageId: string | null;
  url: string | null;
};

export type IgdbGame = {
  id: number;
  name: string;
  first_release_date?: number;
  platforms?: { name: string; abbreviation?: string }[];
  cover?: { image_id: string };
  url?: string;
  game_type?: { type: string };
  total_rating_count?: number;
};

// Add-ons and collections aren't something to play as a club.
const SKIPPED_TYPES = /dlc|addon|bundle|mod|episode|season|pack|update/i;

// Official platform names, shortened the way people say them when IGDB has no abbreviation that fits.
const PLATFORM_NAMES: Record<string, string> = {
  "Super Nintendo Entertainment System": "SNES",
  "Nintendo Entertainment System": "NES",
  "Sega Mega Drive/Genesis": "Genesis",
  "Super Famicom": "Super Famicom",
};

export function platformName(p: { name: string; abbreviation?: string }) {
  return PLATFORM_NAMES[p.name] ?? p.abbreviation ?? p.name;
}

/** Maps an IGDB game, or returns null for add-ons and bundles. */
export function toGame(g: IgdbGame): Game | null {
  if (g.game_type && SKIPPED_TYPES.test(g.game_type.type)) return null;
  return {
    igdbId: g.id,
    title: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
    platforms: [...new Set((g.platforms ?? []).map(platformName))].sort(),
    coverImageId: g.cover?.image_id ?? null,
    url: g.url ?? null,
  };
}

export function igdbConfigured() {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

let token: { value: string; expires: number } | null = null;

async function accessToken(fresh = false) {
  if (!fresh && token && token.expires > Date.now()) return token.value;
  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.search = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID!,
    client_secret: process.env.TWITCH_CLIENT_SECRET!,
    grant_type: "client_credentials",
  }).toString();
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`Twitch token returned ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expires: Date.now() + (body.expires_in - 60) * 1000 };
  return token.value;
}

async function query(endpoint: string, body: string, retry = true): Promise<unknown> {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${await accessToken(!retry)}`,
      Accept: "application/json",
    },
    body,
  });
  if (res.status === 401 && retry) return query(endpoint, body, false);
  if (!res.ok) throw new Error(`IGDB returned ${res.status}`);
  return res.json();
}

const FIELDS = "fields name, first_release_date, platforms.name, platforms.abbreviation, cover.image_id, url, game_type.type, total_rating_count;";

export async function searchGames(text: string): Promise<Game[]> {
  const q = text.replace(/["\\]/g, " ").trim();
  const rows = (await query("games", `search "${q}"; ${FIELDS} where version_parent = null; limit 25;`)) as IgdbGame[];
  // Search relevance alone often buries the well-known release under ports and spinoffs.
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => (b.row.total_rating_count ?? 0) - (a.row.total_rating_count ?? 0) || a.i - b.i)
    .map(({ row }) => toGame(row))
    .filter((g): g is Game => g !== null)
    .slice(0, 10);
}

export async function getGame(id: number): Promise<Game | null> {
  const rows = (await query("games", `${FIELDS} where id = ${Math.trunc(id)};`)) as IgdbGame[];
  return rows[0] ? toGame(rows[0]) : null;
}
