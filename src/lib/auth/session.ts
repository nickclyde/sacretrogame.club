import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { cache } from "react";
import { sql } from "@/lib/db";
import { hashToken, randomToken } from "./tokens";
import { isAdmin, type User } from "./users";

export const SESSION_COOKIE = "srgc_session";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 30;
// Server components can't set cookies, so the cookie outlives the session and the
// database row decides. Using the site pushes the row's expiry forward.
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Starts a session and puts its cookie on the response. */
export async function startSession(res: NextResponse, userId: string) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await sql`insert into sessions (token_hash, user_id, expires_at) values (${hashToken(token)}, ${userId}, ${expires.toISOString()})`;
  res.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: COOKIE_MAX_AGE });
}

export async function endSession(res: NextResponse) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${hashToken(token)}`;
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

type Row = { id: string; display_name: string; email: string | null; discord_id: string | null; expires_at: string | Date };

/** The signed-in user for this request, or null. */
export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const hash = hashToken(token);
  const [row] = await sql<Row>`
    select u.id, u.display_name, u.email, s.expires_at,
      (select subject from identities i where i.user_id = u.id and i.provider = 'discord' limit 1) as discord_id
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${hash} and s.expires_at > now()`;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() - Date.now() < (SESSION_DAYS / 2) * DAY_MS) {
    await sql`update sessions set expires_at = ${new Date(Date.now() + SESSION_DAYS * DAY_MS).toISOString()} where token_hash = ${hash}`;
  }
  return { id: row.id, displayName: row.display_name, isAdmin: isAdmin(row.discord_id, row.email) };
});
