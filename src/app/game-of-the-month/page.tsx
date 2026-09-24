import Image from "next/image";
import Link from "next/link";
import { AdminControls } from "@/components/AdminControls";
import { AutoRefresh } from "@/components/AutoRefresh";
import { NominateForm } from "@/components/NominateForm";
import { RemoveNomination } from "@/components/RemoveNomination";
import { RoundsChart } from "@/components/RoundsChart";
import { MEETING_LIBRARY } from "@/data/meeting";
import { NOMINATIONS_PER_PERSON } from "@/data/gotm";
import { getUser } from "@/lib/auth/session";
import { pickForMonth } from "@/lib/game-picks";
import { gotmResults, monthName, previousKey, type Cover, type Nomination } from "@/lib/gotm";
import { syncCycle } from "@/lib/gotm-announce";
import { currentCycle, getGameBallot, listGameBallots, listNominations } from "@/lib/gotm-db";
import { igdbConfigured } from "@/lib/igdb";
import { TZ } from "@/lib/meeting";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Game of the month | Sac Retro Game Club",
  description: "Nominate games and vote live for the Sac Retro Game Club's next game of the month.",
};

// While voting is open the page refreshes itself so the room can watch results come in.
const LIVE_REFRESH_MS = 5000;

const when = (d: Date) =>
  d.toLocaleString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
const time = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

export default async function GameOfTheMonth() {
  const [user, cycle] = await Promise.all([getUser(), currentCycle()]);
  await syncCycle(cycle);
  const [nominations, ballots, nowPlaying, myBallot] = await Promise.all([
    listNominations(cycle.key),
    listGameBallots(cycle.key),
    pickForMonth(previousKey(cycle.key)),
    user ? getGameBallot(cycle.key, user.id) : null,
  ]);
  const month = monthName(cycle.key);
  const { result, labels } = gotmResults(nominations, ballots.map((b) => b.ranking));
  const winner = nominations.find((n) => n.id === result.winner);
  const mine = user ? nominations.filter((n) => n.userId === user.id).length : 0;
  const signIn = `/sign-in?next=${encodeURIComponent("/game-of-the-month")}`;

  return (
    <div className="flex flex-col gap-12">
      {cycle.phase === "nominating" && <AutoRefresh at={cycle.opensAt.toISOString()} />}
      {cycle.phase === "voting" && <AutoRefresh every={LIVE_REFRESH_MS} at={cycle.closesAt.toISOString()} />}

      <section>
        <p className="text-muted">Game of the month</p>
        {cycle.phase === "closed" && winner ? (
          <>
            {winner.cover && (
              <Image
                src={winner.cover.src}
                alt=""
                {...heroSize(winner.cover)}
                preload
                className="mb-4 mt-2 border-[3px] border-ink shadow-[6px_6px_0_var(--yellow)]"
              />
            )}
            <h1 className="mt-1 font-pixel text-4xl leading-tight sm:text-5xl">
              {month}&apos;s game is <span className="text-purple">{winner.title}</span>
            </h1>
            <p className="mt-3">
              {winner.platform}, nominated by {winner.nominator}. Chosen by {ballots.length} ballot{ballots.length === 1 ? "" : "s"}.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-1 font-pixel text-4xl leading-tight sm:text-5xl">Pick {month}&apos;s game</h1>
            <p className="mt-3 max-w-[60ch]">
              {cycle.phase === "nominating" ? (
                <>
                  Nominate up to {NOMINATIONS_PER_PERSON} games you&apos;d like the club to play. Voting opens{" "}
                  <strong>{when(cycle.opensAt)}</strong>, an hour before the meetup at {MEETING_LIBRARY.name}, and
                  closes at {time(cycle.closesAt)} so we can reveal the winner together. Rank as many nominations as
                  you like: if your favorite gets knocked out, your vote moves to your next pick.
                </>
              ) : cycle.phase === "voting" ? (
                <>
                  Voting is open until <strong>{time(cycle.closesAt)}</strong>. Results below update live. You can
                  change your ballot until voting closes.
                </>
              ) : (
                <>Voting has closed, but no ballots were cast.</>
              )}
            </p>
          </>
        )}

        {cycle.phase === "voting" && (
          <p className="mt-6">
            {user ? (
              <Link href="/game-of-the-month/vote" className="pixel-btn inline-block bg-yellow text-xl">
                {myBallot ? "Change my ballot" : "Vote now"}
              </Link>
            ) : (
              <Link href={`/sign-in?next=${encodeURIComponent("/game-of-the-month/vote")}`} className="pixel-btn inline-block bg-yellow text-xl">
                Sign in to vote
              </Link>
            )}
          </p>
        )}
      </section>

      {user?.isAdmin && (
        <AdminControls phase={cycle.phase} opensAt={when(cycle.opensAt)} closesAt={when(cycle.closesAt)} />
      )}

      {cycle.phase === "nominating" && nowPlaying && (
        <section className="border-l-4 border-purple pl-3">
          Playing now for the {monthName(previousKey(cycle.key))} meetup: <strong>{nowPlaying.title}</strong> ({nowPlaying.platform}).{" "}
          <Link href="/" className="underline">Details</Link>
        </section>
      )}

      {cycle.phase !== "nominating" && ballots.length > 0 && (
        <section>
          <h2 className="mb-1 font-pixel text-2xl">{cycle.phase === "voting" ? "If voting ended now" : "How the count went"}</h2>
          <p className="mb-4 max-w-[65ch] text-muted">
            Each round counts everyone&apos;s highest pick still in the running. If nothing has more than half,
            last place is knocked out and those ballots move to their next pick.
          </p>
          <RoundsChart result={result} labels={labels} color="var(--purple)" />
          <p className="mt-6">
            <span className="font-bold">{ballots.length} ballot{ballots.length === 1 ? "" : "s"}:</span>{" "}
            {ballots.map((b) => b.name).join(", ")}
          </p>
        </section>
      )}

      {cycle.phase === "nominating" && (
        <section>
          {!user ? (
            <p>
              <Link href={signIn} className="pixel-btn inline-block bg-yellow text-xl">Sign in to nominate</Link>
            </p>
          ) : mine < NOMINATIONS_PER_PERSON ? (
            <NominateForm remaining={NOMINATIONS_PER_PERSON - mine} searchEnabled={igdbConfigured()} />
          ) : (
            <p className="text-muted">
              You&apos;ve used both of your nominations. Withdraw one below to swap it for something else.
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 font-pixel text-2xl">
          {nominations.length === 0 ? "No nominations yet" : `${nominations.length} nomination${nominations.length === 1 ? "" : "s"}`}
        </h2>
        {nominations.length === 0 ? (
          <p className="text-muted">{cycle.phase === "nominating" ? "Be the first to suggest a game." : "Nothing was nominated this month."}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {nominations.map((n) => (
              <NominationCard
                key={n.id}
                n={n}
                winner={cycle.phase === "closed" && n.id === winner?.id}
                canWithdraw={cycle.phase === "nominating" && n.userId === user?.id}
                admin={Boolean(user?.isAdmin)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Box art is usually portrait, but some (like many SNES boxes) is landscape. */
function heroSize(cover: Cover) {
  const width = cover.width > cover.height ? 280 : 160;
  return { width, height: Math.round((width * cover.height) / cover.width) };
}

function NominationCard({ n, winner, canWithdraw, admin }: { n: Nomination; winner: boolean; canWithdraw: boolean; admin: boolean }) {
  return (
    <li className={`flex gap-3 border-[3px] border-ink bg-field p-3 ${winner ? "shadow-[6px_6px_0_var(--yellow)]" : ""}`}>
      {n.cover ? (
        <Image src={n.cover.src} alt="" width={64} height={91} className="h-[91px] w-16 shrink-0 border-2 border-ink object-cover" />
      ) : (
        <span aria-hidden className="grid h-[91px] w-16 shrink-0 place-items-center border-2 border-ink bg-panel font-pixel text-2xl text-muted">?</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-tight">
          {winner && <span className="mr-1" aria-label="Winner">🏆</span>}
          {n.infoUrl ? <a href={n.infoUrl} target="_blank" rel="noreferrer nofollow ugc" className="hover:underline">{n.title}</a> : n.title}
        </p>
        <p className="text-sm text-purple">{[n.platform, n.year].filter(Boolean).join(", ")}</p>
        {n.pitch && <p className="mt-1 text-sm">&ldquo;{n.pitch}&rdquo;</p>}
        <p className="mt-1 text-sm text-muted">Nominated by {n.nominator}</p>
        {(canWithdraw || admin) && (
          <p className="mt-1 flex flex-wrap gap-x-3">
            <RemoveNomination id={n.id} title={n.title} admin={!canWithdraw} />
          </p>
        )}
      </div>
    </li>
  );
}
