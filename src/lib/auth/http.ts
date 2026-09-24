import { NextResponse } from "next/server";
import { startSession } from "./session";
import { safeNext } from "./tokens";
import { needsDisplayName } from "./users";

/** Browsers send Origin on every POST. Refusing other origins blocks cross-site form posts. */
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

/** A redirect that turns a form POST into a GET of the destination. */
export function seeOther(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

/**
 * Finishes any sign-in: starts a session unless the person was already signed in (and just
 * linked another method), then sends them on, by way of picking a name if they have none.
 */
export async function finishSignIn(request: Request, userId: string, alreadySignedIn: boolean, next: string) {
  const dest = safeNext(next);
  const path = (await needsDisplayName(userId))
    ? `/account?welcome=1&next=${encodeURIComponent(dest)}`
    : alreadySignedIn
      ? "/account?linked=1"
      : dest;
  const res = seeOther(request, path);
  if (!alreadySignedIn) await startSession(res, userId);
  return res;
}
