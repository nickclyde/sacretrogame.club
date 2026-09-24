import type { IrvResult } from "@/lib/irv";

const TIE_BREAK_NOTE = {
  "first-round": "tie broken by fewest first-round votes",
  borda: "tie broken by overall ranking points",
  order: "tie broken by list order",
} as const;

type Props = { result: IrvResult; labels: Record<string, string>; color: string };

/** Every instant runoff round as labeled bars. The last round is the deciding one. */
export function RoundsChart({ result, labels, color }: Props) {
  if (result.rounds.length === 0) return <p className="text-muted">No votes yet.</p>;
  const order = Object.keys(result.rounds[0].tallies);

  return (
    <ol className="flex flex-col gap-5">
      {result.rounds.map((round, i) => {
        const counted = result.ballots - round.exhausted;
        const final = i === result.rounds.length - 1;
        const ids = order.filter((id) => id in round.tallies).sort((a, b) => round.tallies[b] - round.tallies[a]);
        return (
          <li key={i}>
            <p className="mb-1 font-pixel text-lg">
              Round {i + 1}
              {final && " (final)"}
            </p>
            <ul className="flex flex-col gap-1">
              {ids.map((id) => {
                const votes = round.tallies[id];
                const out = round.eliminated.includes(id);
                return (
                  <li key={id} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-2 text-sm sm:grid-cols-[minmax(0,16rem)_1fr_2.5rem]">
                    <span className={`truncate ${out ? "text-muted line-through" : ""} ${final && id === result.winner ? "font-bold" : ""}`}>
                      {labels[id]}
                    </span>
                    <span className="h-4 border-2 border-ink bg-field">
                      <span className="block h-full" style={{ width: `${counted ? (votes / counted) * 100 : 0}%`, background: out ? "var(--muted)" : color }} />
                    </span>
                    <span className="text-right tabular-nums">{votes}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-sm text-muted">
              {final
                ? `${labels[result.winner!]} wins with ${round.tallies[result.winner!]} of ${counted} counted ballots.`
                : `Knocked out: ${round.eliminated.map((id) => labels[id]).join(", ")}${round.tieBreak ? ` (${TIE_BREAK_NOTE[round.tieBreak]})` : ""}.`}
              {round.exhausted > 0 && ` ${round.exhausted} ballot${round.exhausted === 1 ? "" : "s"} had no remaining picks.`}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
