import type { Ballot, BallotInput } from "./ballot";
import { nameKey } from "./ballot";
import type { IrvResult } from "./irv";
import { LABELS, computeResults, headline } from "./results";

const RESULTS_URL = "https://sacretrogame.club/results";

// Names are typed by voters, so keep them from formatting or pinging.
function plain(name: string) {
  return name.replace(/([\\*_~`|>#\[\]()@])/g, "\\$1");
}

function pollLine(title: string, before: IrvResult, after: IrvResult, labels: Record<string, string>) {
  if (!after.winner) return `**${title}:** no votes yet`;
  // A two-way tie is settled by eliminating one side, which leaves a final round
  // of one. Describe the last round that still had a contest.
  const contested = [...after.rounds].reverse().find((r) => Object.values(r.tallies).filter((v) => v > 0).length > 1);
  const round = contested ?? after.rounds[after.rounds.length - 1];
  const counted = after.ballots - round.exhausted;
  const votes = round.tallies[after.winner];
  const runnerUp = Object.keys(round.tallies)
    .filter((id) => id !== after.winner)
    .sort((a, b) => round.tallies[b] - round.tallies[a])[0];

  let line = `**${title}:** ${labels[after.winner]} with ${votes} of ${counted}`;
  if (runnerUp && round.tallies[runnerUp] === votes) {
    line += `, tied with ${labels[runnerUp]} and ahead only on the tie-break`;
  } else if (runnerUp && round.tallies[runnerUp] > 0) {
    line += `, ahead of ${labels[runnerUp]} (${round.tallies[runnerUp]})`;
  }
  line += after.rounds.length > 1 ? ` after ${after.rounds.length} rounds` : " in the first round";
  if (before.winner && before.winner !== after.winner) {
    line += `. 🔀 New leader, it was ${labels[before.winner]}`;
  }
  return line;
}

export function ballotMessage(previous: Ballot[], ballot: BallotInput) {
  const key = nameKey(ballot.name);
  const isUpdate = previous.some((b) => nameKey(b.name) === key);
  const current = [...previous.filter((b) => nameKey(b.name) !== key), ballot];
  const before = computeResults(previous);
  const after = computeResults(current);
  const { when, where } = headline(after);

  return [
    isUpdate
      ? `🗳️ **${plain(ballot.name)}** changed their ballot (${current.length} total)`
      : `🗳️ **${plain(ballot.name)}** voted, that's ballot #${current.length}`,
    `If voting ended now: **${when ?? "day and time undecided"}${where ? ` at ${where}` : ""}**`,
    "",
    pollLine("Day and time", before.slot, after.slot, LABELS.slot),
    pollLine("Week", before.week, after.week, LABELS.week),
    pollLine("Library", before.library, after.library, LABELS.library),
    "",
    `Round by round: <${RESULTS_URL}>`,
  ].join("\n");
}

/** Posts to the channel webhook in DISCORD_WEBHOOK_URL. Never throws: a vote must not fail over this. */
export async function announceBallot(previous: Ballot[], ballot: BallotInput) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: ballotMessage(previous, ballot), allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) console.error(`Discord webhook returned ${res.status}`);
  } catch (e) {
    console.error("Discord webhook failed", e);
  }
}
