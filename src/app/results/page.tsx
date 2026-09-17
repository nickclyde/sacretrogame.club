import Link from "next/link";
import { RoundsChart } from "@/components/RoundsChart";
import { BRANCH_FINDER_URL, LIBRARIES, LIBRARY_IDS } from "@/data/libraries";
import { DAYS, SLOTS, SLOT_IDS, WEEKS, WEEK_IDS, slotDay, votingIsClosed } from "@/data/polls";
import { getBallots } from "@/lib/db";
import { tally } from "@/lib/irv";

export const dynamic = "force-dynamic";
export const metadata = { title: "Results | Sac Retro Game Club" };

const MIN_SHARERS = 3;

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export default async function Results() {
  const ballots = await getBallots();
  const slot = tally(SLOT_IDS, ballots.map((b) => b.slots));
  const week = tally(WEEK_IDS, ballots.map((b) => b.weeks));
  const library = tally(LIBRARY_IDS, ballots.map((b) => b.libraries));
  const day = tally(DAYS.map((d) => d.id), ballots.map((b) => b.slots.map(slotDay)));

  const slotLabels = Object.fromEntries(SLOTS.map((s) => [s.id, `${s.label}, ${s.detail}`]));
  const weekLabels = Object.fromEntries(WEEKS.map((w) => [w.id, `${w.label} week`]));
  const libraryLabels = Object.fromEntries(LIBRARIES.map((l) => [l.id, l.name]));
  const dayLabels = Object.fromEntries(DAYS.map((d) => [d.id, d.label]));

  const winSlot = SLOTS.find((s) => s.id === slot.winner);
  const winWeek = WEEKS.find((w) => w.id === week.winner);
  const winLibrary = LIBRARIES.find((l) => l.id === library.winner);
  const closed = votingIsClosed();

  const sharers = ballots.filter((b) => b.driveMinutes);
  const drives = LIBRARIES.map((l) => {
    const rows = sharers.map((b) => b.driveMinutes![l.id]).filter((m) => m !== undefined);
    return { library: l, weeknight: rows.map((r) => r.weeknight), weekend: rows.map((r) => r.weekend) };
  }).filter((d) => d.weeknight.length >= MIN_SHARERS);

  if (ballots.length === 0) {
    return (
      <>
        <h1 className="font-pixel text-4xl">No ballots yet</h1>
        <p className="mt-3">
          Be the first: <Link href="/meeting-vote" className="font-bold underline">rank your picks</Link>.
        </p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <section>
        <p className="text-muted">{closed ? "Final result" : "If voting ended now"}</p>
        <h1 className="mt-1 font-pixel text-4xl leading-tight sm:text-5xl">
          {winWeek && winSlot ? `${winWeek.label} ${winSlot.label}, ${winSlot.detail}` : winSlot ? `${winSlot.label}, ${winSlot.detail}` : "Day and time undecided"}
          {winLibrary && <span className="block text-purple">at {winLibrary.name}</span>}
        </h1>
        <p className="mt-3">
          {ballots.length} ballot{ballots.length === 1 ? "" : "s"} so far.{" "}
          {!closed && <Link href="/meeting-vote" className="font-bold underline">Add or change yours</Link>}
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-pixel text-2xl">How the count works</h2>
        <p className="max-w-[65ch] text-muted">
          Each round counts everyone&apos;s highest pick that is still in the running. If nothing has more
          than half, the option in last place is knocked out and those ballots move to their next pick.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-pixel text-2xl">Day and time</h2>
        <RoundsChart result={slot} labels={slotLabels} color="var(--blue)" />
        {day.winner && (
          <p className="mt-4 border-l-4 border-blue pl-3 text-sm">
            Counting by day alone (ignoring the time), {dayLabels[day.winner]} comes out on top
            {day.winner === (slot.winner && slotDay(slot.winner)) ? ", matching the winning slot." : ", which differs from the winning slot. Worth talking over."}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-pixel text-2xl">Week of the month</h2>
        <RoundsChart result={week} labels={weekLabels} color="var(--green)" />
      </section>

      <section>
        <h2 className="mb-3 font-pixel text-2xl">Library</h2>
        <RoundsChart result={library} labels={libraryLabels} color="var(--red)" />
        <p className="mt-4 text-sm">
          Room booking happens through the library. <a className="underline" href={BRANCH_FINDER_URL}>Find branch pages on saclibrary.org</a>.
        </p>
      </section>

      {drives.length > 0 && (
        <section>
          <h2 className="mb-1 font-pixel text-2xl">Drive times</h2>
          <p className="mb-3 text-muted">
            From the {sharers.length} members who shared theirs. Minutes with typical traffic, shown as median (longest).
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-[3px] border-ink">
                <th className="py-1 pr-2 font-bold">Library</th>
                <th className="py-1 pr-2 text-right font-bold">Weeknight</th>
                <th className="py-1 text-right font-bold">Saturday</th>
              </tr>
            </thead>
            <tbody>
              {drives.sort((a, b) => median(a.weeknight) - median(b.weeknight)).map((d) => (
                <tr key={d.library.id} className="border-b border-ink/20">
                  <td className="py-1 pr-2">{d.library.name}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{median(d.weeknight)} ({Math.max(...d.weeknight)})</td>
                  <td className="py-1 text-right tabular-nums">{median(d.weekend)} ({Math.max(...d.weekend)})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-pixel text-2xl">Who has voted</h2>
        <p>{ballots.map((b) => b.name).join(", ")}</p>
      </section>
    </div>
  );
}
