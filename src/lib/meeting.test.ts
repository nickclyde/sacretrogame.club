import { describe, expect, it } from "vitest";
import { nextMeeting } from "./meeting";

// 2nd Wednesday, 6 to 8 PM Pacific.
const RULE = { week: 2, weekday: 3, startHour: 18, endHour: 20 };

const start = (now: string) => nextMeeting(RULE, new Date(now)).start.toISOString();

describe("nextMeeting", () => {
  it("finds the 2nd Wednesday of next month once this month's has passed", () => {
    expect(start("2026-09-21T12:00:00-07:00")).toBe("2026-10-15T01:00:00.000Z");
  });

  it("counts from the 1st when the month starts on the meeting weekday", () => {
    expect(start("2026-04-01T09:00:00-07:00")).toBe("2026-04-09T01:00:00.000Z");
  });

  it("keeps showing a meeting until it ends", () => {
    expect(start("2026-10-14T19:59:00-07:00")).toBe("2026-10-15T01:00:00.000Z");
  });

  it("moves to the next month when the meeting ends, across the DST change", () => {
    const { start, end } = nextMeeting(RULE, new Date("2026-10-14T20:00:00-07:00"));
    expect(start.toISOString()).toBe("2026-11-12T02:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-12T04:00:00.000Z");
  });

  it("rolls over the year", () => {
    expect(start("2026-12-10T08:00:00-08:00")).toBe("2027-01-14T02:00:00.000Z");
  });

  it("uses the Pacific month, not the UTC one", () => {
    // Already October in UTC, still September 30 in Sacramento.
    expect(start("2026-10-01T05:00:00Z")).toBe("2026-10-15T01:00:00.000Z");
  });
});
