import { redirect } from "next/navigation";
import { emailConfigured } from "@/lib/auth/email";
import { oauthConfigured } from "@/lib/auth/oauth";
import { getUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/tokens";
import { getIdentities, type Provider } from "@/lib/auth/users";

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
};

export default async function Account(props: PageProps<"/account">) {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/account");
  const params = await props.searchParams;
  const welcome = Boolean(params.welcome) || !user.displayName;
  const next = typeof params.next === "string" ? safeNext(params.next) : null;
  const code = [params.error, params.saved && "saved", params.linked && "linked"].find((v) => typeof v === "string");
  const message = code ? MESSAGES[code] : null;
  const linked = await getIdentities(user.id);
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

      <section>
        <form method="post" action="/api/auth/sign-out">
          <button type="submit" className="pixel-btn bg-field">Sign out</button>
        </form>
      </section>
    </div>
  );
}
