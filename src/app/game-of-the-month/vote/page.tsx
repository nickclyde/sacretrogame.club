import Link from "next/link";
import { redirect } from "next/navigation";
import { GameBallot } from "@/components/GameBallot";
import { getUser } from "@/lib/auth/session";
import { monthName } from "@/lib/gotm";
import { syncCycle } from "@/lib/gotm-announce";
import { currentCycle, getGameBallot, listNominations } from "@/lib/gotm-db";
import { TZ } from "@/lib/meeting";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vote | Game of the month | Sac Retro Game Club" };

export default async function Vote() {
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent("/game-of-the-month/vote")}`);
  if (!user.displayName) redirect(`/account?welcome=1&next=${encodeURIComponent("/game-of-the-month/vote")}`);
  const cycle = await currentCycle();
  await syncCycle(cycle);

  if (cycle.phase !== "voting") {
    return (
      <>
        <h1 className="font-pixel text-4xl leading-tight">
          {cycle.phase === "closed" ? "Voting has closed" : "Voting hasn't opened yet"}
        </h1>
        <p className="mt-3">
          <Link href="/game-of-the-month" className="font-bold underline">
            {cycle.phase === "closed" ? "See the winner" : "See the nominations"}
          </Link>
        </p>
      </>
    );
  }

  const [nominations, saved] = await Promise.all([listNominations(cycle.key), getGameBallot(cycle.key, user.id)]);
  const ids = new Set(nominations.map((n) => n.id));
  const closes = cycle.closesAt.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

  return (
    <>
      <h1 className="font-pixel text-4xl leading-tight sm:text-5xl">Rank {monthName(cycle.key)}&apos;s games</h1>
      <p className="mb-8 mt-3 max-w-[60ch]">
        Put the game you most want to play first, and rank as many as you like. If your top pick gets knocked
        out, your vote moves to your next one. Anything you leave unranked counts as a pass. You can change your
        ballot until voting closes at <strong>{closes}</strong>.
      </p>
      <GameBallot
        options={nominations.map((n) => ({ id: n.id, label: n.title, detail: [n.platform, n.year].filter(Boolean).join(", ") }))}
        initial={(saved ?? []).filter((id) => ids.has(id))}
        hasSaved={saved !== null}
      />
    </>
  );
}
