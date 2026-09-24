import { sql } from "@/lib/db";
import { hashToken, randomToken } from "./tokens";
import { normalizeEmail } from "./users";

const LINK_MINUTES = 15;
const PER_EMAIL_PER_HOUR = 3;

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY) || process.env.NODE_ENV !== "production";
}

/**
 * Creates a one-time sign-in token for an address, or returns null when too many links
 * were requested for it in the last hour.
 */
export async function createEmailToken(email: string): Promise<string | null> {
  const address = normalizeEmail(email);
  const token = randomToken();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const expires = new Date(Date.now() + LINK_MINUTES * 60 * 1000).toISOString();
  const rows = await sql`
    insert into email_tokens (token_hash, email, expires_at)
    select ${hashToken(token)}, ${address}, ${expires}
    where (select count(*) from email_tokens where email = ${address} and created_at > ${since}) < ${PER_EMAIL_PER_HOUR}
    returning email`;
  return rows.length ? token : null;
}

/** Uses up a token and returns its address, or null if it is unknown, used, or expired. */
export async function consumeEmailToken(token: string): Promise<string | null> {
  const [row] = await sql<{ email: string }>`
    update email_tokens set used_at = now()
    where token_hash = ${hashToken(token)} and used_at is null and expires_at > now()
    returning email`;
  return row?.email ?? null;
}

/** Sends the sign-in link through Resend. Without an API key in dev, the link is logged instead. */
export async function sendSignInEmail(to: string, link: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[dev] Sign-in link for ${to}: ${link}`);
    return;
  }
  const text = [
    "Here's your link to sign in to Sac Retro Game Club:",
    "",
    link,
    "",
    `It works once and expires in ${LINK_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
  ].join("\n");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Sac Retro Game Club <login@sacretrogame.club>",
      to,
      subject: "Your Sac Retro Game Club sign-in link",
      text,
    }),
  });
  if (!res.ok) throw new Error(`Resend returned ${res.status}`);
}
