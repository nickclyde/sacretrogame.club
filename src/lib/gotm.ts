import { MEETING } from "@/data/meeting";
import { VOTE_CLOSES_BEFORE_END_MIN, VOTE_OPENS_BEFORE_START_MIN } from "@/data/gotm";
import { tally, type IrvResult } from "./irv";
import { TZ, nextMeeting } from "./meeting";

export type Phase = "nominating" | "voting" | "closed";

export type Overrides = { voteOpensAt: Date | null; voteClosesAt: Date | null };

export type Cycle = {
  /** The month the winning game gets discussed, as YYYY-MM. Matches the keys of GAME_PICKS. */
  key: string;
  /** The meetup where the vote happens, the month before. */
  meeting: { start: Date; end: Date };
  opensAt: Date;
  closesAt: Date;
  phase: Phase;
};

const MINUTE = 60 * 1000;

function addMonths(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthKey(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" });
}

export function previousKey(key: string) {
  return addMonths(key, -1);
}

/** "November" for "2026-11". */
export function monthName(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long" });
}

/**
 * The vote that is coming up or underway. It belongs to the next meetup and stays current until
 * that meetup ends, then the following month's nominations open.
 */
export function gotmCycle(now = new Date(), overrides: Overrides = { voteOpensAt: null, voteClosesAt: null }): Cycle {
  const meeting = nextMeeting(MEETING, now);
  const opensAt = overrides.voteOpensAt ?? new Date(meeting.start.getTime() - VOTE_OPENS_BEFORE_START_MIN * MINUTE);
  const closesAt = overrides.voteClosesAt ?? new Date(meeting.end.getTime() - VOTE_CLOSES_BEFORE_END_MIN * MINUTE);
  const phase: Phase = now < opensAt ? "nominating" : now < closesAt ? "voting" : "closed";
  return { key: addMonths(monthKey(meeting.start), 1), meeting, opensAt, closesAt, phase };
}

/** Box art with its pixel size, from IGDB or a Wikipedia article. */
export type Cover = { src: string; width: number; height: number };

export type Nomination = {
  id: string;
  userId: string;
  nominator: string;
  igdbId: number | null;
  title: string;
  platform: string;
  year: number | null;
  cover: Cover | null;
  infoUrl: string | null;
  pitch: string | null;
};

export function nominationLabel(n: Pick<Nomination, "title" | "platform">) {
  return `${n.title} (${n.platform})`;
}

/** Instant runoff over the nominations, in the order they were made (earlier wins a full tie). */
export function gotmResults(nominations: Nomination[], rankings: string[][]): { result: IrvResult; labels: Record<string, string> } {
  return {
    result: tally(nominations.map((n) => n.id), rankings),
    labels: Object.fromEntries(nominations.map((n) => [n.id, nominationLabel(n)])),
  };
}
