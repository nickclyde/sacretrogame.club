import { LIBRARIES } from "./libraries";

export type MeetingRule = {
  /** Which occurrence of the weekday in the month, so 2 with Wednesday is "the 2nd Wednesday". */
  week: number;
  /** 0 is Sunday. */
  weekday: number;
  /** Pacific wall-clock hours, 24h. */
  startHour: number;
  endHour: number;
};

// The schedule the club voted for. Results are at /results.
export const MEETING: MeetingRule = { week: 2, weekday: 3, startHour: 18, endHour: 20 };

export const MEETING_LIBRARY = LIBRARIES.find((l) => l.id === "arcade")!;
