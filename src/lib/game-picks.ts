import { GAME_PICKS, type GamePick } from "@/data/games";
import { settle } from "./gotm-announce";
import { siteName } from "./links";

/**
 * The game for a month's meetup: a hand-written entry in GAME_PICKS if there is one, otherwise
 * the winner of the club vote held at the meetup before. Only call this for a month whose vote
 * has already closed.
 */
export async function pickForMonth(month: string): Promise<GamePick | null> {
  if (GAME_PICKS[month]) return GAME_PICKS[month];
  const winner = await settle(month);
  if (!winner) return null;
  return {
    title: winner.title,
    platform: winner.platform,
    image: winner.cover ?? undefined,
    aboutUrl: winner.infoUrl ?? undefined,
    aboutSite: winner.infoUrl ? siteName(winner.infoUrl) : undefined,
    nominator: winner.nominator,
  };
}
