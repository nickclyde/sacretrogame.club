// RetroAchievements web API. It has no OAuth, so members just tell us their username, and the
// site reads their public awards with the club's key in RA_API_KEY.

const API = "https://retroachievements.org/API";
const HEADERS = { "User-Agent": "sacretrogame.club (club game of the month board)" };

export type RaUser = { ulid: string; username: string };

export type RaAward = { gameId: number; kind: "beaten" | "mastered"; hardcore: boolean; at: Date };

/** Why a lookup failed, worded for a member. */
export class RaError extends Error {}

export function raConfigured() {
  return Boolean(process.env.RA_API_KEY);
}

export function raProfileUrl(username: string) {
  return `https://retroachievements.org/user/${encodeURIComponent(username)}`;
}

/** The game id in a link like https://retroachievements.org/game/355, or null. */
export function raGameIdFromUrl(url: string): number | null {
  const match = url.match(/^(?:https?:\/\/)?(?:www\.)?retroachievements\.org\/game\/(\d+)(?:[/?#]|$)/i);
  return match ? Number(match[1]) : null;
}

/**
 * Game ids typed by a host: numbers or RA game links, separated by commas or spaces.
 * Returns null if anything in the list is neither.
 */
export function parseRaGameIds(text: string): number[] | null {
  const ids: number[] = [];
  for (const part of text.split(/[\s,]+/).filter(Boolean)) {
    const id = /^\d+$/.test(part) ? Number(part) : raGameIdFromUrl(part);
    if (!id) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Keeps the "Game Beaten" and "Mastery/Completion" awards from an API_GetUserAwards response. */
export function parseAwards(body: unknown): RaAward[] {
  const list = (body as { VisibleUserAwards?: unknown } | null)?.VisibleUserAwards;
  if (!Array.isArray(list)) return [];
  const kinds: Record<string, RaAward["kind"]> = { "Game Beaten": "beaten", "Mastery/Completion": "mastered" };
  return list.flatMap((a: { AwardType?: string; AwardData?: unknown; AwardDataExtra?: unknown; AwardedAt?: string }) => {
    const kind = a.AwardType ? kinds[a.AwardType] : undefined;
    const gameId = Number(a.AwardData);
    const at = new Date(a.AwardedAt ?? "");
    if (!kind || !Number.isInteger(gameId) || gameId <= 0 || Number.isNaN(at.getTime())) return [];
    return [{ gameId, kind, hardcore: Number(a.AwardDataExtra) === 1, at }];
  });
}

async function call(endpoint: string, user: string): Promise<unknown> {
  const key = process.env.RA_API_KEY;
  if (!key) throw new RaError("RetroAchievements isn't set up on this site.");
  // The key is in the URL, so never log it.
  const url = `${API}/${endpoint}.php?${new URLSearchParams({ u: user, y: key })}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res) throw new RaError("RetroAchievements didn't answer. Try again in a bit.");
  if (res.status === 404) return null;
  if (res.status === 429) throw new RaError("RetroAchievements is busy. Try again in a few minutes.");
  if (!res.ok) throw new RaError(`RetroAchievements returned an error (${res.status}). Try again later.`);
  return res.json();
}

/** Looks up a username. Returns null if there is no such user. */
export async function resolveUser(name: string): Promise<RaUser | null> {
  const body = (await call("API_GetUserProfile", name)) as { ULID?: string; User?: string } | null;
  return body?.ULID && body.User ? { ulid: body.ULID, username: body.User } : null;
}

/** Every visible beaten and mastery award, in one call however many games there are. */
export async function userAwards(ulid: string): Promise<RaAward[]> {
  return parseAwards(await call("API_GetUserAwards", ulid));
}
