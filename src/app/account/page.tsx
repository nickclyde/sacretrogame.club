import Link from "next/link";
import { redirect } from "next/navigation";
import { emailConfigured } from "@/lib/auth/email";
import { oauthConfigured } from "@/lib/auth/oauth";
import { getUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/tokens";
import { getIdentities, type Provider } from "@/lib/auth/users";
import { RaGamesForm } from "@/components/RaGamesForm";
import { finishMonths, getRaAccount } from "@/lib/finishers";
import { monthName } from "@/lib/gotm";
import { raConfigured, raGameIdFromUrl, raProfileUrl } from "@/lib/retroachievements";

export const metadata = { title: "Account | Sac Retro Game Club" };

const PROVIDER_NAMES: Record<Provider, string> = { discord: "Discord", google: "Google", email: "Email link" };

const MESSAGES: Record<string, { text: string; error?: boolean }> = {
  saved: { text: "Name saved." },
  linked: { text: "Sign-in option added. You can use it next time." },
  "bad-name": { text: "Names need 1 to 40 characters.", error: true },
  "linked-elsewhere": {
    text: "That sign-in already belongs to a different account, so it wasn't added. Sign out and use it to reach that account.",
    error: true,
  },
  "ra-linked": { text: "RetroAchievements linked. Games of the month you've beaten are on the leaderboard." },
  "ra-checked": { text: "Checked RetroAchievements. The leaderboard is up to date." },
  "ra-unlinked": { text: "RetroAchievements unlinked. Games it already found stay on the leaderboard." },
  "ra-unknown": { text: "RetroAchievements has no user by that name.", error: true },
  "ra-taken": { text: "That RetroAchievements account is already linked to another member.", error: true },
  "ra-down": { text: "Couldn't reach RetroAchievements. Try again in a bit.", error: true },
  "ra-busy": { text: "That's a lot of checks. Try again in a few minutes.", error: true },
};

export default async function Account(props: PageProps<"/account">) {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/account");
  const params = await props.searchParams;
  const welcome = Boolean(params.welcome) || !user.displayName;
  const next = typeof params.next === "string" ? safeNext(params.next) : null;
  const ra = typeof params.ra === "string" ? `ra-${params.ra}` : null;
  const code = [params.error, params.saved && "saved", params.linked && "linked", ra].find((v) => typeof v === "string");
  const message = code ? MESSAGES[code] : null;
  const [linked, raAccount, hostMonths] = await Promise.all([
    getIdentities(user.id),
    getRaAccount(user.id),
    user.isAdmin && raConfigured() ? finishMonths() : [],
  ]);
  const linkable = (["discord", "google"] as const).filter((p) => !linked.includes(p) && oauthConfigured(p));

  return (
    <div className="flex max-w-md flex-col gap-10">
      <section>
        <h1 className="font-pixel text-4xl leading-tight">{welcome ? "Welcome!" : "Your account"}</h1>
        {message && (
          <p role={message.error ? "alert" : "status"} className={`mt-3 border-l-4 pl-3 ${message.error ? "border-red" : "border-green"}`}>
            {message.text}
          </p>
        )}
      </section>

      <section>
        <form method="post" action="/api/account">
          {next && <input type="hidden" name="next" value={next} />}
          <label htmlFor="name" className="font-pixel text-2xl">
            {welcome ? "Pick a display name" : "Display name"}
          </label>
          <p className="mb-3 text-muted">Other members see this next to your nominations and in the list of who voted.</p>
          <div className="flex flex-wrap gap-3">
            <input
              id="name"
              name="name"
              required
              maxLength={40}
              autoComplete="nickname"
              defaultValue={user.displayName}
              className="min-w-0 flex-1 basis-56 border-[3px] border-ink bg-field px-3 py-2 font-pixel text-xl"
            />
            <button type="submit" className="pixel-btn bg-yellow">{welcome ? "Continue" : "Save"}</button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="font-pixel text-2xl">Ways to sign in</h2>
        <ul className="mt-2 list-inside list-disc">
          {linked.map((p) => <li key={p}>{PROVIDER_NAMES[p]}</li>)}
        </ul>
        {(linkable.length > 0 || (!linked.includes("email") && emailConfigured())) && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-muted">Add another way to reach this same account:</p>
            {linkable.map((p) => (
              <a key={p} href={`/api/auth/${p}?next=/account`} className="pixel-btn bg-field text-center">
                Add {PROVIDER_NAMES[p]}
              </a>
            ))}
            {!linked.includes("email") && emailConfigured() && (
              <form method="post" action="/api/auth/email" className="flex flex-wrap gap-3">
                <input type="hidden" name="next" value="/account" />
                <label htmlFor="email" className="sr-only">Email address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="min-w-0 flex-1 basis-56 border-[3px] border-ink bg-field px-3 py-2"
                />
                <button type="submit" className="pixel-btn bg-field">Add email</button>
              </form>
            )}
          </div>
        )}
      </section>

      {raConfigured() && (
        <section>
          <h2 className="font-pixel text-2xl">RetroAchievements</h2>
          {raAccount ? (
            <>
              <p className="mt-2">
                Linked to{" "}
                <a href={raProfileUrl(raAccount.username)} target="_blank" rel="noreferrer" className="font-bold underline">
                  {raAccount.username}
                </a>
                . When you beat a game of the month, it shows up on the{" "}
                <Link href="/game-of-the-month/leaderboard" className="underline">leaderboard</Link> by itself.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <form method="post" action="/api/account/retroachievements">
                  <input type="hidden" name="action" value="check" />
                  <button type="submit" className="pixel-btn bg-field">Check now</button>
                </form>
                <form method="post" action="/api/account/retroachievements">
                  <input type="hidden" name="action" value="unlink" />
                  <button type="submit" className="pixel-btn bg-field">Unlink</button>
                </form>
              </div>
            </>
          ) : (
            <form method="post" action="/api/account/retroachievements">
              <input type="hidden" name="action" value="link" />
              <p className="mb-3 mt-2 text-muted">
                Link your account and games of the month you beat show up on the{" "}
                <Link href="/game-of-the-month/leaderboard" className="underline">leaderboard</Link> by themselves.
                The site only reads your public awards, and shows your RetroAchievements username there.
              </p>
              <label htmlFor="ra-username" className="sr-only">RetroAchievements username</label>
              <div className="flex flex-wrap gap-3">
                <input
                  id="ra-username"
                  name="username"
                  required
                  maxLength={32}
                  autoComplete="off"
                  placeholder="Username"
                  className="min-w-0 flex-1 basis-56 border-[3px] border-ink bg-field px-3 py-2"
                />
                <button type="submit" className="pixel-btn bg-field">Link</button>
              </div>
            </form>
          )}
        </section>
      )}

      {hostMonths.length > 0 && (
        <section className="border-[3px] border-dashed border-ink p-4">
          <h2 className="font-pixel text-xl">Host controls</h2>
          <p className="text-sm text-muted">
            RetroAchievements sets that count toward the{" "}
            <Link href="/game-of-the-month/leaderboard" className="underline">leaderboard</Link>. Use game numbers or
            retroachievements.org/game links, separated by commas.
          </p>
          <div className="mt-4 flex flex-col gap-5">
            {hostMonths.map((m) => {
              const fixed = m.pick.achievementsUrl ? raGameIdFromUrl(m.pick.achievementsUrl) : null;
              return (
                <RaGamesForm
                  key={m.key}
                  month={m.key}
                  label={`${monthName(m.key)} ${m.key.slice(0, 4)}: ${m.pick.title}`}
                  stored={m.raGameIds.filter((id) => id !== fixed)}
                  fixed={fixed}
                />
              );
            })}
          </div>
        </section>
      )}

      <section>
        <form method="post" action="/api/auth/sign-out">
          <button type="submit" className="pixel-btn bg-field">Sign out</button>
        </form>
      </section>
    </div>
  );
}
