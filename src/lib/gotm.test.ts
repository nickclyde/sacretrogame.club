import { describe, expect, it } from "vitest";
import { gotmCycle, gotmResults, monthName, previousKey, type Nomination } from "./gotm";

const at = (iso: string) => new Date(iso);

describe("gotmCycle", () => {
  it("votes at the October meetup for November's game", () => {
    const c = gotmCycle(at("2026-09-23T12:00:00-07:00"));
    expect(c.key).toBe("2026-11");
    expect(c.phase).toBe("nominating");
    expect(c.meeting.start).toEqual(at("2026-10-14T18:00:00-07:00"));
    expect(c.opensAt).toEqual(at("2026-10-14T17:00:00-07:00"));
    expect(c.closesAt).toEqual(at("2026-10-14T19:45:00-07:00"));
  });

  it("moves through voting and closed during the meetup", () => {
    expect(gotmCycle(at("2026-10-14T16:59:59-07:00")).phase).toBe("nominating");
    expect(gotmCycle(at("2026-10-14T17:00:00-07:00")).phase).toBe("voting");
    expect(gotmCycle(at("2026-10-14T19:44:59-07:00")).phase).toBe("voting");
    expect(gotmCycle(at("2026-10-14T19:45:00-07:00")).phase).toBe("closed");
    expect(gotmCycle(at("2026-10-14T19:59:59-07:00")).key).toBe("2026-11");
  });

  it("opens the next month's nominations when the meetup ends", () => {
    const c = gotmCycle(at("2026-10-14T20:00:00-07:00"));
    expect(c.key).toBe("2026-12");
    expect(c.phase).toBe("nominating");
  });

  it("follows Pacific time across the fall DST change", () => {
    const c = gotmCycle(at("2026-10-20T12:00:00-07:00"));
    expect(c.meeting.start).toEqual(at("2026-11-11T18:00:00-08:00"));
    expect(c.opensAt).toEqual(at("2026-11-11T17:00:00-08:00"));
  });

  it("rolls over the year", () => {
    expect(gotmCycle(at("2026-12-01T12:00:00-08:00")).key).toBe("2027-01");
  });

  it("uses admin overrides", () => {
    const now = at("2026-10-01T12:00:00-07:00");
    expect(gotmCycle(now, { voteOpensAt: at("2026-10-01T11:00:00-07:00"), voteClosesAt: null }).phase).toBe("voting");
    const closedEarly = gotmCycle(at("2026-10-14T19:00:00-07:00"), { voteOpensAt: null, voteClosesAt: at("2026-10-14T18:50:00-07:00") });
    expect(closedEarly.phase).toBe("closed");
  });
});

describe("month helpers", () => {
  it("names and steps months", () => {
    expect(monthName("2026-11")).toBe("November");
    expect(previousKey("2027-01")).toBe("2026-12");
  });
});

describe("gotmResults", () => {
  const nom = (id: string, title: string): Nomination => ({
    id, userId: "u", nominator: "Ana", wikidataId: null, title, platform: "SNES", year: null, cover: null, infoUrl: null, pitch: null,
  });

  it("ranks nominations by instant runoff with labels", () => {
    const noms = [nom("a", "Chrono Trigger"), nom("b", "EarthBound"), nom("c", "Super Metroid")];
    const { result, labels } = gotmResults(noms, [["a"], ["b", "a"], ["c", "a"], ["a"], ["b"]]);
    expect(result.winner).toBe("a");
    expect(labels.b).toBe("EarthBound (SNES)");
  });

  it("breaks a dead heat in favor of the earlier nomination", () => {
    const noms = [nom("a", "Chrono Trigger"), nom("b", "EarthBound")];
    expect(gotmResults(noms, [["a"], ["b"]]).result.winner).toBe("a");
  });

  it("ignores ballots for removed nominations", () => {
    expect(gotmResults([nom("b", "EarthBound")], [["gone", "b"]]).result).toMatchObject({ winner: "b", ballots: 1 });
  });
});
