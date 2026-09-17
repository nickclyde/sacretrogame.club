import { describe, expect, it } from "vitest";
import type { Ballot } from "./ballot";
import { ballotMessage } from "./discord";

const ballot = (name: string, slots: string[], weeks: string[], libraries: string[]): Ballot => ({
  name, slots, weeks, libraries, driveMinutes: null, updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("ballotMessage", () => {
  it("announces a first ballot with the headline", () => {
    const msg = ballotMessage([], ballot("Ana", ["wed-18"], ["w3"], ["arcade"]));
    expect(msg).toContain("**Ana** voted, that's ballot #1");
    expect(msg).toContain("**3rd Wednesday, 6 to 8 PM at Arcade Library**");
    expect(msg).toContain("**Library:** Arcade Library with 1 of 1 in the first round");
  });

  it("flags a change of leader and the runner-up", () => {
    const previous = [ballot("Ana", ["wed-18"], ["w3"], ["arcade"])];
    const msg = ballotMessage(previous, ballot("Bo", ["sat-13"], ["w3"], ["arcade"]));
    expect(msg).toContain("Wednesday, 6 to 8 PM with 1 of 2, tied with Saturday, 1 to 3 PM");
    expect(msg).not.toContain("New leader");
    const third = ballotMessage([...previous, ballot("Bo", ["sat-13"], [], [])], ballot("Cy", ["sat-13"], [], []));
    expect(third).toContain("New leader, it was Wednesday, 6 to 8 PM");
  });

  it("treats a repeat name as an update, not a new ballot", () => {
    const previous = [ballot("Ana", ["wed-18"], [], [])];
    const msg = ballotMessage(previous, ballot("@ana", ["thu-18"], [], []));
    expect(msg).toContain("changed their ballot (1 total)");
    expect(msg).toContain("New leader, it was Wednesday");
  });

  it("neutralizes markdown and mentions in names", () => {
    expect(ballotMessage([], ballot("@everyone **hi**", ["wed-18"], [], []))).toContain("\\@everyone \\*\\*hi\\*\\*");
  });
});
