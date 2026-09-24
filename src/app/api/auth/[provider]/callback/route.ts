import { cookies } from "next/headers";
import { finishSignIn, seeOther } from "@/lib/auth/http";
import { NotInServerError, OAUTH_COOKIE, exchange, isOAuthProvider, redirectUri } from "@/lib/auth/oauth";
import { getUser } from "@/lib/auth/session";
import { signInWith } from "@/lib/auth/users";

type Pending = { provider: string; state: string; verifier: string; next: string };

export async function GET(request: Request, ctx: RouteContext<"/api/auth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const params = new URL(request.url).searchParams;
  let pending: Pending | null = null;
  try {
    pending = JSON.parse((await cookies()).get(OAUTH_COOKIE)?.value ?? "null");
  } catch {}

  const code = params.get("code");
  if (!isOAuthProvider(provider) || !pending || pending.provider !== provider || pending.state !== params.get("state")) {
    return seeOther(request, "/sign-in?error=failed");
  }
  if (!code) return seeOther(request, "/sign-in?error=cancelled");

  let profile;
  try {
    profile = await exchange(provider, code, redirectUri(provider, request.url), pending.verifier);
  } catch (e) {
    if (e instanceof NotInServerError) return seeOther(request, "/sign-in?error=not-in-server");
    console.error(`${provider} sign-in failed`, e);
    return seeOther(request, "/sign-in?error=failed");
  }

  const current = await getUser();
  const result = await signInWith(profile, current?.id ?? null);
  if ("error" in result) return seeOther(request, `/account?error=${result.error}`);
  const res = await finishSignIn(request, result.userId, Boolean(current), pending.next);
  res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth", maxAge: 0 });
  return res;
}
