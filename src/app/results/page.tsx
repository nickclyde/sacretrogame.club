import Link from "next/link";
import { RoundsChart } from "@/components/RoundsChart";
import { BRANCH_FINDER_URL, LIBRARIES } from "@/data/libraries";
import { slotDay, votingIsClosed } from "@/data/polls";
import { getBallots } from "@/lib/db";
import { LABELS, computeResults, headline } from "@/lib/results";

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
  const results = computeResults(ballots);
  const { slot, week, library, day } = results;
  const { slot: slotLabels, week: weekLabels, library: libraryLabels, day: dayLabels } = LABELS;
  const { when, where } = headline(results);
  const closed = votingIsClosed();

  const sharers = ballots.filter((b) => b.driveMinutes);
  const drives = LIBRARIES.map((l) => {
    const rows = sharers.map((b) => b.driveMinutes![l.id]).filter((m) => m !== undefined);
    return { library: l, weeknight: rows.map((r) => r.weeknight), weekend: rows.map((r) => r.weekend) };
  }).filter((d) => d.weeknight.length >= MIN_SHARERS);

  if (ballots.length === 0) {
    return (
      <>
        <h1 className="font-pixel text-4xl">{closed ? "No ballots were cast" : "No ballots yet"}</h1>
        {!closed && (
          <p className="mt-3">
            Be the first: <Link href="/meeting-vote" className="font-bold underline">rank your picks</Link>.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <section>
        <p className="text-muted">{closed ? "Final result" : "If voting ended now"}</p>
        <h1 className="mt-1 font-pixel text-4xl leading-tight sm:text-5xl">
          {when ?? "Day and time undecided"}
          {where && <span className="block text-purple">at {where}</span>}
        </h1>
        <p className="mt-3">
          {ballots.length} ballot{ballots.length === 1 ? "" : "s"} {closed ? "counted. Voting has closed." : "so far."}{" "}
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
