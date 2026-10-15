import type { MeetingRule } from "@/data/meeting";

export const TZ = "America/Los_Angeles";

const monthFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });

/** Day of the month of the nth given weekday (0 is Sunday). `month` is zero based. */
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/** The instant of a Pacific wall-clock hour (20.5 is 8:30 PM) on a calendar date, whichever side of DST it falls on. */
function pacific(year: number, month: number, day: number, hours: number): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  const hour = Math.floor(hours);
  const minute = Math.round((hours - hour) * 60);
  for (const offset of ["-07:00", "-08:00"]) {
    const d = new Date(`${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${offset}`);
    if (Number(hourFmt.format(d)) === hour) return d;
  }
  throw new Error("unreachable");
}

/** The rule in effect for a month given as YYYY-MM. Months before the first rule use the first rule. */
export function ruleFor(rules: MeetingRule[], key: string): MeetingRule {
  return rules.findLast((r) => r.from <= key) ?? rules[0];
}

/** The upcoming monthly meeting. A meeting stays current until it ends, then the next month takes over. */
export function nextMeeting(rules: MeetingRule[], now = new Date()): { start: Date; end: Date } {
  const [year, month] = monthFmt.format(now).split("-").map(Number);
  for (let i = 0; i <= 1; i++) {
    const probe = new Date(Date.UTC(year, month - 1 + i, 1));
    const y = probe.getUTCFullYear();
    const m = probe.getUTCMonth();
    const rule = ruleFor(rules, `${y}-${String(m + 1).padStart(2, "0")}`);
    const day = nthWeekday(y, m, rule.weekday, rule.week);
    const end = pacific(y, m, day, rule.endHour);
    if (now < end) return { start: pacific(y, m, day, rule.startHour), end };
  }
  throw new Error("unreachable");
}
