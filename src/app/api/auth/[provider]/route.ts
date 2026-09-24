import { NextResponse } from "next/server";
import { OAUTH_COOKIE, authorizationUrl, isOAuthProvider, oauthConfigured, redirectUri } from "@/lib/auth/oauth";
import { cookieOptions } from "@/lib/auth/session";
import { randomToken, safeNext } from "@/lib/auth/tokens";
import { seeOther } from "@/lib/auth/http";

/** Starts a Discord or Google sign-in. */
export async function GET(request: Request, ctx: RouteContext<"/api/auth/[provider]">) {
  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider) || !oauthConfigured(provider)) return seeOther(request, "/sign-in?error=unavailable");

  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const state = randomToken(16);
  const verifier = randomToken();
  const res = NextResponse.redirect(authorizationUrl(provider, redirectUri(provider, request.url), state, verifier));
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ provider, state, verifier, next }), {
    ...cookieOptions,
    path: "/api/auth",
    maxAge: 10 * 60,
  });
  return res;
}
