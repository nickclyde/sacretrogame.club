import { LIBRARIES } from "./libraries";

export type MeetingRule = {
  /** The first month the rule applies to, as YYYY-MM. */
  from: string;
  /** Which occurrence of the weekday in the month, so 2 with Wednesday is "the 2nd Wednesday". */
  week: number;
  /** 0 is Sunday. */
  weekday: number;
  /** Pacific wall-clock hours, 24h. Halves work, so 20.5 is 8:30 PM. */
  startHour: number;
  endHour: number;
};

/** Oldest first. Each rule lasts until the next one starts, so past meetups keep their real dates. */
export const MEETINGS: MeetingRule[] = [
  // The schedule the club voted for. Results are at /results.
  { from: "2026-01", week: 2, weekday: 3, startHour: 18, endHour: 20 },
  // Another group books the room on 2nd Wednesdays.
  { from: "2026-11", week: 3, weekday: 3, startHour: 18, endHour: 20.5 },
];

export const MEETING_LIBRARY = LIBRARIES.find((l) => l.id === "arcade")!;
