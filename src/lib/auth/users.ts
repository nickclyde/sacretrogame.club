import { sql } from "@/lib/db";

export type Provider = "discord" | "google" | "email";

export type User = {
  id: string;
  displayName: string;
  isAdmin: boolean;
};

export type Profile = {
  provider: Provider;
  /** The provider's stable id for the account. For email, the normalized address. */
  subject: string;
  /** Only set when the provider has verified it. */
  email: string | null;
  /** Empty for email sign-ins, which have no name until the person picks one. */
  displayName: string;
};

export type SignInResult = { userId: string } | { error: "linked-elsewhere" };

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/** Hosts who can open and close the vote, listed by Discord user id or verified email. */
export function isAdmin(discordId: string | null, email: string | null) {
  return (
    (discordId !== null && list(process.env.ADMIN_DISCORD_IDS).includes(discordId)) ||
    (email !== null && list(process.env.ADMIN_EMAILS).includes(email))
  );
}

/**
 * Finds or creates the account for a sign-in. A new sign-in method joins the account that is
 * already signed in, or else the account with the same verified email, so one person keeps one
 * account (and one ballot) however they sign in.
 */
export async function signInWith(p: Profile, currentUserId: string | null): Promise<SignInResult> {
  const email = p.email ? normalizeEmail(p.email) : null;
  const [identity] = await sql<{ user_id: string }>`
    select user_id from identities where provider = ${p.provider} and subject = ${p.subject}`;
  if (identity) {
    if (currentUserId && identity.user_id !== currentUserId) return { error: "linked-elsewhere" };
    return { userId: identity.user_id };
  }

  let userId = currentUserId;
  if (!userId && email) {
    const [match] = await sql<{ id: string }>`select id from users where email = ${email}`;
    userId = match?.id ?? null;
  }
  if (!userId) {
    const [created] = await sql<{ id: string }>`
      insert into users (display_name, email) values (${p.displayName.trim().slice(0, 40)}, ${email})
      on conflict (email) do update set email = excluded.email
      returning id`;
    userId = created.id;
  } else if (email) {
    // Remember a verified email for linking later, unless another account already has it.
    await sql`
      update users set email = ${email}
      where id = ${userId} and email is null and not exists (select 1 from users where email = ${email})`;
  }
  if (p.displayName) {
    await sql`update users set display_name = ${p.displayName.trim().slice(0, 40)} where id = ${userId} and display_name = ''`;
  }
  await sql`
    insert into identities (provider, subject, user_id) values (${p.provider}, ${p.subject}, ${userId})
    on conflict do nothing`;
  return { userId };
}

export async function needsDisplayName(userId: string) {
  const [row] = await sql<{ display_name: string }>`select display_name from users where id = ${userId}`;
  return !row?.display_name;
}

export async function setDisplayName(userId: string, name: string) {
  await sql`update users set display_name = ${name} where id = ${userId}`;
}

export async function getIdentities(userId: string): Promise<Provider[]> {
  const rows = await sql<{ provider: Provider }>`
    select provider from identities where user_id = ${userId} order by created_at`;
  return [...new Set(rows.map((r) => r.provider))];
}
