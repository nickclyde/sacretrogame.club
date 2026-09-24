import Link from "next/link";
import { safeNext } from "@/lib/auth/tokens";

export const metadata = { title: "Sign in | Sac Retro Game Club" };

/** Where emailed links land. Signing in takes a button press so link scanners can't use up the token. */
export default async function EmailSignIn(props: PageProps<"/sign-in/email">) {
  const params = await props.searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);

  if (!token) {
    return (
      <p>
        This link is missing its code. <Link href="/sign-in" className="font-bold underline">Request a new one</Link>.
      </p>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="font-pixel text-4xl leading-tight">Almost there</h1>
      <p className="mt-3">Press the button to finish signing in on this device.</p>
      <form method="post" action="/api/auth/email/verify" className="mt-6">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="pixel-btn bg-yellow text-xl">Sign in</button>
      </form>
    </div>
  );
}
