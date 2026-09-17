export type TieBreak = "first-round" | "borda" | "order";

export type Round = {
  /** Votes for each candidate still standing at the start of the round. */
  tallies: Record<string, number>;
  /** Ballots with no remaining ranked candidate. */
  exhausted: number;
  eliminated: string[];
  tieBreak?: TieBreak;
};

export type IrvResult = {
  winner: string | null;
  rounds: Round[];
  ballots: number;
};

/**
 * Instant runoff. Ballots may rank any subset of candidates; ids that are not
 * candidates and repeated ids are ignored. Elimination ties are broken by fewer
 * first-round votes, then lower Borda score, then later position in `candidates`.
 */
export function tally(candidates: string[], rawBallots: string[][]): IrvResult {
  const valid = new Set(candidates);
  const ballots = rawBallots
    .map((b) => [...new Set(b.filter((id) => valid.has(id)))])
    .filter((b) => b.length > 0);

  const result: IrvResult = { winner: null, rounds: [], ballots: ballots.length };
  if (ballots.length === 0 || candidates.length === 0) return result;

  const borda = Object.fromEntries(candidates.map((c) => [c, 0]));
  for (const b of ballots) {
    b.forEach((id, i) => (borda[id] += candidates.length - i));
  }

  const active = new Set(candidates);
  let firstRound: Record<string, number> | null = null;

  while (active.size > 0) {
    const tallies = Object.fromEntries([...active].map((c) => [c, 0]));
    let exhausted = 0;
    for (const b of ballots) {
      const top = b.find((id) => active.has(id));
      if (top) tallies[top]++;
      else exhausted++;
    }
    firstRound ??= tallies;

    const round: Round = { tallies, exhausted, eliminated: [] };
    result.rounds.push(round);

    const continuing = ballots.length - exhausted;
    const max = Math.max(...Object.values(tallies));
    const leaders = [...active].filter((c) => tallies[c] === max);
    if (active.size === 1 || (leaders.length === 1 && max * 2 > continuing)) {
      result.winner = leaders[0];
      return result;
    }

    const zeros = [...active].filter((c) => tallies[c] === 0);
    if (zeros.length > 0) {
      round.eliminated = zeros;
    } else {
      const min = Math.min(...Object.values(tallies));
      let lowest = [...active].filter((c) => tallies[c] === min);
      if (lowest.length > 1) {
        const steps: [TieBreak, (c: string) => number][] = [
          ["first-round", (c) => firstRound![c]],
          ["borda", (c) => borda[c]],
          ["order", (c) => -candidates.indexOf(c)],
        ];
        for (const [name, score] of steps) {
          const worst = Math.min(...lowest.map(score));
          const narrowed = lowest.filter((c) => score(c) === worst);
          if (narrowed.length < lowest.length) round.tieBreak = name;
          lowest = narrowed;
          if (lowest.length === 1) break;
        }
      }
      round.eliminated = [lowest[0]];
    }
    for (const c of round.eliminated) active.delete(c);
  }
  return result;
}
