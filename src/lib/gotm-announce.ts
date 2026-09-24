import { after } from "next/server";
import { announceGotm, votingOpenMessage, winnerMessage } from "./discord";
import { gotmResults, type Cycle, type Nomination } from "./gotm";
import { claimAnnouncement, listGameBallots, listNominations, storedWinner } from "./gotm-db";

/**
 * Posts "voting is open" and the winner to Discord the first time any request notices those
 * moments have passed. There is no scheduler: during the meetup the live page refreshes every
 * few seconds, so these go out within moments.
 */
export async function syncCycle(cycle: Cycle) {
  if (cycle.phase !== "nominating" && (await claimAnnouncement(cycle.key, "opened"))) {
    const count = (await listNominations(cycle.key)).length;
    after(() => announceGotm(votingOpenMessage(cycle, count)));
  }
  if (cycle.phase === "closed") await settle(cycle.key);
}

/** Records (and announces, once) the winner of a cycle whose vote has closed. */
export async function settle(key: string): Promise<Nomination | null> {
  const stored = await storedWinner(key);
  if (stored.settled) return stored.winner;
  const nominations = await listNominations(key);
  const ballots = await listGameBallots(key);
  const { result } = gotmResults(nominations, ballots.map((b) => b.ranking));
  const winner = nominations.find((n) => n.id === result.winner) ?? null;
  if ((await claimAnnouncement(key, "winner", winner?.id ?? null)) && winner) {
    after(() => announceGotm(winnerMessage(key, winner, result)));
  }
  return winner;
}
