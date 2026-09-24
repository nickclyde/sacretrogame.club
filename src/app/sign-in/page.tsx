import Link from "next/link";
import { emailConfigured } from "@/lib/auth/email";
import { oauthConfigured } from "@/lib/auth/oauth";
import { getUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/tokens";
import { DISCORD_INVITE_URL } from "@/data/club";

export const metadata = { title: "Sign in | Sac Retro Game Club" };

const ERRORS: Record<string, React.ReactNode> = {
  "not-in-server": (
    <>
      That Discord account isn&apos;t in the club server yet.{" "}
      <a href={DISCORD_INVITE_URL} className="underline" target="_blank" rel="noreferrer">Join the Discord</a>, then
      try again, or sign in another way below.
    </>
  ),
  cancelled: "Sign-in was cancelled.",
  failed: "Sign-in didn't work. Please try again.",
  unavailable: "That sign-in option isn't set up yet.",
  "bad-email": "That doesn't look like an email address.",
  "too-many": "Too many sign-in links were requested. Try again in an hour.",
  "email-failed": "Couldn't send the email. Please try again in a minute.",
  "link-expired": "That sign-in link has expired or was already used. Request a new one below.",
};

export default async function SignIn(props: PageProps<"/sign-in">) {
  const params = await props.searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  const error = typeof params.error === "string" ? ERRORS[params.error] : null;
  const user = await getUser();
  const q = `?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex max-w-md flex-col gap-8">
      <section>
        <h1 className="font-pixel text-4xl leading-tight">Sign in</h1>
        <p className="mt-3">
          Sign in to nominate games and vote for the game of the month. Use whichever option you like: it&apos;s
          the same account either way.
        </p>
        {user && (
          <p className="mt-3 border-l-4 border-green pl-3">
            You&apos;re signed in as <strong>{user.displayName}</strong>.{" "}
            <Link href={next} className="font-bold underline">Continue</Link>
          </p>
        )}
        {error && <p role="alert" className="mt-3 border-l-4 border-red pl-3">{error}</p>}
      </section>

      <section className="flex flex-col gap-3">
        {oauthConfigured("discord") && (
          <a href={`/api/auth/discord${q}`} className="pixel-btn bg-[#5865f2] text-center text-xl text-white">
            Sign in with Discord
          </a>
        )}
        {oauthConfigured("google") && (
          <a href={`/api/auth/google${q}`} className="pixel-btn bg-field text-center text-xl">
            Sign in with Google
          </a>
        )}
      </section>

      {emailConfigured() && (
        <section>
          <h2 className="font-pixel text-2xl">Or get a link by email</h2>
          {params.sent ? (
            <p role="status" className="mt-2 border-l-4 border-green pl-3">
              Check your inbox for a sign-in link. It works once and expires in 15 minutes.
            </p>
          ) : (
            <form method="post" action="/api/auth/email" className="mt-2 flex flex-wrap gap-3">
              <input type="hidden" name="next" value={next} />
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
              <button type="submit" className="pixel-btn bg-yellow">Email me a link</button>
            </form>
          )}
        </section>
      )}

      <section className="text-sm text-muted">
        <h2 className="font-bold">What gets saved</h2>
        <p className="mt-1">
          Your display name, which other members see next to your nominations and in the list of who
          voted. An id from Discord or Google so you can sign in again. Your email address, only to sign
          you in and to recognize you across sign-in options. It&apos;s never shown on the site. How you
          rank games is never shown to anyone.
        </p>
      </section>
    </div>
  );
}
