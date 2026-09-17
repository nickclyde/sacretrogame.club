import { LIBRARIES, LIBRARY_IDS } from "@/data/libraries";
import { DAYS, SLOTS, SLOT_IDS, WEEKS, WEEK_IDS, slotDay } from "@/data/polls";
import type { Ballot } from "./ballot";
import { tally, type IrvResult } from "./irv";

export const LABELS = {
  slot: Object.fromEntries(SLOTS.map((s) => [s.id, `${s.label}, ${s.detail}`])),
  week: Object.fromEntries(WEEKS.map((w) => [w.id, `${w.label} week`])),
  library: Object.fromEntries(LIBRARIES.map((l) => [l.id, l.name])),
  day: Object.fromEntries(DAYS.map((d) => [d.id, d.label])),
};

export type Results = { slot: IrvResult; week: IrvResult; library: IrvResult; day: IrvResult };

type Rankings = Pick<Ballot, "slots" | "weeks" | "libraries">;

export function computeResults(ballots: Rankings[]): Results {
  return {
    slot: tally(SLOT_IDS, ballots.map((b) => b.slots)),
    week: tally(WEEK_IDS, ballots.map((b) => b.weeks)),
    library: tally(LIBRARY_IDS, ballots.map((b) => b.libraries)),
    day: tally(DAYS.map((d) => d.id), ballots.map((b) => b.slots.map(slotDay))),
  };
}

/** "3rd Wednesday, 6 to 8 PM" plus the library name, or null parts while undecided. */
export function headline(r: Results) {
  const slot = SLOTS.find((s) => s.id === r.slot.winner);
  const week = WEEKS.find((w) => w.id === r.week.winner);
  const library = LIBRARIES.find((l) => l.id === r.library.winner);
  const when = slot ? `${week ? `${week.label} ` : ""}${slot.label}, ${slot.detail}` : null;
  return { when, where: library?.name ?? null };
}
