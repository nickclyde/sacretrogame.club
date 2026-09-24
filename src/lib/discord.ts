import type { Ballot, BallotInput } from "./ballot";
import { nameKey } from "./ballot";
import { monthName, type Cycle, type Nomination } from "./gotm";
import type { IrvResult } from "./irv";
import { webUrl } from "./links";
import { TZ } from "./meeting";
import { LABELS, computeResults, headline } from "./results";

const RESULTS_URL = "https://sacretrogame.club/results";
const GOTM_URL = "https://sacretrogame.club/game-of-the-month";

// Names, game titles, and pitches are typed by members, so keep them from formatting or pinging.
export function plain(name: string) {
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

/** Posts to a channel webhook. Never throws: a vote or nomination must not fail over this. */
async function postWebhook(url: string | undefined, content: string) {
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) console.error(`Discord webhook returned ${res.status}`);
  } catch (e) {
    console.error("Discord webhook failed", e);
  }
}

/** Posts to the meeting vote channel webhook in DISCORD_WEBHOOK_URL. */
export function announceBallot(previous: Ballot[], ballot: BallotInput) {
  return postWebhook(process.env.DISCORD_WEBHOOK_URL, ballotMessage(previous, ballot));
}

/** Posts to the game of the month channel webhook in DISCORD_GOTM_WEBHOOK_URL. */
export function announceGotm(content: string) {
  return postWebhook(process.env.DISCORD_GOTM_WEBHOOK_URL, content);
}

function gameLine(n: Nomination) {
  const href = n.infoUrl && webUrl(n.infoUrl);
  // Angle brackets stop the link from unfurling into an embed. Encoding parentheses keeps
  // links like Wikipedia's "Chrono_Trigger_(video_game)" from ending the markdown early.
  const title = href ? `[${plain(n.title)}](<${href.replace(/\(/g, "%28").replace(/\)/g, "%29")}>)` : plain(n.title);
  return `**${title}** (${plain([n.platform, n.year].filter(Boolean).join(", "))})`;
}

export function nominationMessage(cycleKey: string, n: Nomination, total: number) {
  const lines = [`🎮 **${plain(n.nominator)}** nominated ${gameLine(n)} for ${monthName(cycleKey)}'s game of the month`];
  if (n.pitch) lines.push(`> ${plain(n.pitch.replace(/\s+/g, " "))}`);
  lines.push("", `${total} nomination${total === 1 ? "" : "s"} so far: <${GOTM_URL}>`);
  return lines.join("\n");
}

export function votingOpenMessage(cycle: Cycle, nominations: number) {
  const closes = cycle.closesAt.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  return [
    `🗳️ Voting is open for ${monthName(cycle.key)}'s game of the month!`,
    `Rank the ${nominations} nomination${nominations === 1 ? "" : "s"} by ${closes}. Results update live, and we'll reveal the winner together at the meetup.`,
    `<${GOTM_URL}>`,
  ].join("\n");
}

export function winnerMessage(cycleKey: string, winner: Nomination, result: IrvResult) {
  const last = result.rounds[result.rounds.length - 1];
  const counted = result.ballots - last.exhausted;
  const rounds = result.rounds.length > 1 ? `after ${result.rounds.length} rounds` : "in the first round";
  return [
    `🏆 ${monthName(cycleKey)}'s game of the month is ${gameLine(winner)}, nominated by ${plain(winner.nominator)}!`,
    `It won with ${last.tallies[winner.id]} of ${counted} ballots ${rounds}. Round by round: <${GOTM_URL}>`,
  ].join("\n");
}
