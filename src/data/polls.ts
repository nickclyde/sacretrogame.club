export type Option = { id: string; label: string; detail?: string };

export const DAYS = [
  { id: "tue", label: "Tuesday" },
  { id: "wed", label: "Wednesday" },
  { id: "thu", label: "Thursday" },
  { id: "fri", label: "Friday" },
  { id: "sat", label: "Saturday" },
] as const;

// Slot ids are "<day>-<24h start hour>". The day prefix drives the by-day rollup.
export const SLOTS: Option[] = [
  { id: "tue-18", label: "Tuesday", detail: "6 to 8 PM" },
  { id: "wed-18", label: "Wednesday", detail: "6 to 8 PM" },
  { id: "thu-18", label: "Thursday", detail: "6 to 8 PM" },
  { id: "fri-18", label: "Friday", detail: "6 to 8 PM" },
  { id: "sat-10", label: "Saturday", detail: "10 AM to noon" },
  { id: "sat-13", label: "Saturday", detail: "1 to 3 PM" },
  { id: "sat-15", label: "Saturday", detail: "3 to 5 PM" },
];

export const WEEKS: Option[] = [
  { id: "w1", label: "1st", detail: "week of the month" },
  { id: "w2", label: "2nd", detail: "week of the month" },
  { id: "w3", label: "3rd", detail: "week of the month" },
  { id: "w4", label: "4th", detail: "week of the month" },
];

export const SLOT_IDS = SLOTS.map((o) => o.id);
export const WEEK_IDS = WEEKS.map((o) => o.id);

export function slotDay(slotId: string) {
  return slotId.split("-")[0];
}

// Voting ended once the club settled on a schedule (see src/data/meeting.ts).
// Set to null, or to a future time, to reopen the poll.
const CLOSES_AT: string | null = "2026-09-21T00:00:00-07:00";

/** When ballots become read only. The VOTING_CLOSES_AT env var (ISO timestamp) overrides the default. */
export function votingClosesAt(): Date | null {
  const raw = process.env.VOTING_CLOSES_AT || CLOSES_AT;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function votingIsClosed(now = new Date()) {
  const closes = votingClosesAt();
  return closes !== null && now >= closes;
}
