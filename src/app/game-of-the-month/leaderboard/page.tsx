import Image from "next/image";
import Link from "next/link";
import { FinishedToggle } from "@/components/FinishedToggle";
import { getUser } from "@/lib/auth/session";
import { allTime, finishMonths, listFinishers, syncRaLater, type Finisher, type FinishMonth } from "@/lib/finishers";
import { monthName } from "@/lib/gotm";
import { TZ } from "@/lib/meeting";
import { raConfigured, raProfileUrl } from "@/lib/retroachievements";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Leaderboard | Sac Retro Game Club",
  description: "Who in the Sac Retro Game Club finished each game of the month.",
};

const SIGN_IN = `/sign-in?next=${encodeURIComponent("/game-of-the-month/leaderboard")}`;

/** 1 -> "1st", 12 -> "12th", 22 -> "22nd". */
function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

const day = (d: Date) => d.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });

export default async function Finishers() {
  const [user, months, finishers] = await Promise.all([getUser(), finishMonths(), listFinishers()]);
  syncRaLater();
  const board = allTime(finishers);

  return (
    <div className="flex flex-col gap-12">
      <section>
        <p className="text-muted">
          <Link href="/game-of-the-month" className="underline">Game of the month</Link>
        </p>
        <h1 className="mt-1 font-pixel text-4xl leading-tight sm:text-5xl">Leaderboard</h1>
        <p className="mt-3 max-w-[60ch]">
          Rolled the credits on the game of the month? Tick the box, however you played it. It&apos;s on the
          honor system, and it&apos;s never too late: finishing an older pick counts too.
        </p>
        {raConfigured() && (
          <p className="mt-3 max-w-[60ch]">
            Playing with RetroAchievements?{" "}
            <Link href="/account" className="underline">Link your account</Link> and beaten games show up here by
            themselves.
          </p>
        )}
      </section>

      {months.length === 0 && <p className="text-muted">There&apos;s no game of the month yet.</p>}

      {months.map((m) => (
        <MonthBoard
          key={m.key}
          month={m}
          finishers={finishers.filter((f) => f.month === m.key)}
          userId={user?.id ?? null}
        />
      ))}

      {board.length > 0 && (
        <section>
          <h2 className="mb-3 font-pixel text-2xl">All-time</h2>
          <ol className="flex flex-col gap-2">
            {board.map((row, i) => (
              <li key={row.userId} className="flex items-center gap-3 border-[3px] border-ink bg-field px-3 py-2">
                <span className="w-14 shrink-0 font-pixel text-2xl uppercase text-purple">{ordinal(i + 1)}</span>
                <span className="min-w-0 flex-1 font-bold">{row.name}</span>
                <span className="shrink-0 text-right">
                  <span className="font-pixel text-xl">{row.finished}</span> finished
                  {row.mastered > 0 && <span className="block text-sm text-muted">{row.mastered} mastered</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function MonthBoard({ month, finishers, userId }: { month: FinishMonth; finishers: Finisher[]; userId: string | null }) {
  const { pick } = month;
  const mine = finishers.find((f) => f.userId === userId);

  return (
    <section>
      <div className="mb-4 flex items-center gap-4">
        {pick.image && (
          <Image
            {...pick.image}
            alt=""
            unoptimized={pick.image.src.startsWith("https:")} // A vote winner's box art, see Cover.
            className={`h-auto shrink-0 ${pick.image.height > pick.image.width ? "w-16 border-2 border-ink" : "logo-plate w-28"}`}
          />
        )}
        <div className="min-w-0">
          <p className="text-muted">{monthName(month.key)} {month.key.slice(0, 4)}</p>
          <h2 className="font-pixel text-2xl leading-tight">{pick.title}</h2>
          <p className="text-sm text-purple">{pick.platform}</p>
        </div>
      </div>

      {!userId ? (
        <p className="mb-4">
          <Link href={SIGN_IN} className="underline">Sign in</Link> to mark it finished.
        </p>
      ) : mine?.via === "ra" ? (
        <p className="mb-4 border-l-4 border-green pl-3">
          RetroAchievements shows you {mine.masteredAt ? "mastered" : "beat"} it. Nice!
        </p>
      ) : (
        <div className="mb-4">
          <FinishedToggle month={month.key} done={Boolean(mine)} title={pick.title} />
        </div>
      )}

      {finishers.length === 0 ? (
        <p className="text-muted">Nobody yet. Be the first!</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {finishers.map((f, i) => (
            <li key={f.userId} className="flex items-center gap-3 border-[3px] border-ink bg-field px-3 py-2">
              <span className="w-14 shrink-0 font-pixel text-2xl uppercase text-purple">{ordinal(i + 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="font-bold">{f.name}</span>
                {f.via === "ra" && (
                  <span className="block text-sm text-muted">
                    {f.masteredAt ? "⭐ Mastered" : "Beaten"}
                    {f.hardcore && " in hardcore"} on{" "}
                    {f.raUsername ? (
                      <a href={raProfileUrl(f.raUsername)} target="_blank" rel="noreferrer" className="underline">
                        RetroAchievements
                      </a>
                    ) : (
                      "RetroAchievements"
                    )}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm text-muted">{day(f.finishedAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
