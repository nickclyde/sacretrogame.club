import { describe, expect, it } from "vitest";
import { tally } from "./irv";

const C = ["a", "b", "c"];

describe("tally", () => {
  it("returns no winner for no ballots", () => {
    expect(tally(C, [])).toEqual({ winner: null, rounds: [], ballots: 0 });
    expect(tally(C, [[], ["zzz"]]).winner).toBeNull();
  });

  it("declares a first-round majority", () => {
    const r = tally(C, [["a"], ["a", "b"], ["b"]]);
    expect(r.winner).toBe("a");
    expect(r.rounds).toHaveLength(1);
  });

  it("transfers votes across rounds", () => {
    // a:2 b:2 c:1 -> c out, its vote goes to b
    const r = tally(C, [["a"], ["a"], ["b"], ["b"], ["c", "b"]]);
    expect(r.rounds[0].eliminated).toEqual(["c"]);
    expect(r.rounds[1].tallies).toEqual({ a: 2, b: 3 });
    expect(r.winner).toBe("b");
  });

  it("counts exhausted ballots and takes the majority of what remains", () => {
    // a:2 b:2 c:1 (c-only ballot exhausts). Tie a/b then resolves by tie break.
    const r = tally(C, [["a"], ["a"], ["b", "a"], ["b"], ["c"]]);
    expect(r.rounds[1].exhausted).toBe(1);
    expect(r.winner).not.toBeNull();
  });

  it("drops zero-vote candidates together", () => {
    const r = tally(["a", "b", "c", "d"], [["a"], ["b"], ["b", "a"], ["a", "b"]]);
    expect(r.rounds[0].eliminated).toEqual(["c", "d"]);
  });

  it("breaks ties by first-round votes", () => {
    // round 1: a3 b2 c2 d1 -> d out to c. round 2: a3 b2 c3 -> b out to... exhausted.
    // round 3: a3 c3 tie; c had fewer first-round votes so c is eliminated.
    const r = tally(
      ["a", "b", "c", "d"],
      [["a"], ["a"], ["a"], ["b"], ["b"], ["c"], ["c"], ["d", "c"]],
    );
    const last = r.rounds[r.rounds.length - 2];
    expect(last.eliminated).toEqual(["c"]);
    expect(last.tieBreak).toBe("first-round");
    expect(r.winner).toBe("a");
  });

  it("breaks ties by Borda score", () => {
    // a and b tie on first choices; b is ranked second more often.
    const r = tally(C, [["a", "b"], ["b", "a"], ["c", "b"], ["c", "b"], ["c"], ["a"], ["b"]]);
    // round 1: a2 b2 c3 -> tie a/b for last. borda: a=3+2+3=8, b=2+3+2+2+3=12 -> a out
    expect(r.rounds[0].eliminated).toEqual(["a"]);
    expect(r.rounds[0].tieBreak).toBe("borda");
  });

  it("falls back to option order", () => {
    const r = tally(["a", "b"], [["a"], ["b"]]);
    expect(r.rounds[0].eliminated).toEqual(["b"]);
    expect(r.rounds[0].tieBreak).toBe("order");
    expect(r.winner).toBe("a");
  });

  it("ignores duplicate and unknown ids", () => {
    const r = tally(C, [["x", "a", "a", "b"], ["b"], ["a"]]);
    expect(r.rounds[0].tallies).toEqual({ a: 2, b: 1, c: 0 });
  });
});
