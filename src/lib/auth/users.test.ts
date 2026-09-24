import { beforeEach, describe, expect, it } from "vitest";
import { resetDevDb, sql } from "@/lib/db";
import { consumeEmailToken, createEmailToken } from "./email";
import { needsDisplayName, signInWith, type Profile } from "./users";

const discord: Profile = { provider: "discord", subject: "111", email: "ana@example.com", displayName: "Ana" };
const google: Profile = { provider: "google", subject: "g-1", email: "Ana@Example.com", displayName: "Ana G" };
const email = (address: string): Profile => ({ provider: "email", subject: address, email: address, displayName: "" });

const id = (r: Awaited<ReturnType<typeof signInWith>>) => ("userId" in r ? r.userId : r.error);

beforeEach(() => resetDevDb());

describe("signInWith", () => {
  it("creates an account on first sign-in and returns it after", async () => {
    const first = id(await signInWith(discord, null));
    expect(id(await signInWith(discord, null))).toBe(first);
    const [row] = await sql<{ display_name: string }>`select display_name from users where id = ${first}`;
    expect(row.display_name).toBe("Ana");
  });

  it("joins sign-ins that share a verified email", async () => {
    const ana = id(await signInWith(discord, null));
    expect(id(await signInWith(google, null))).toBe(ana);
    expect(id(await signInWith(email("ana@example.com"), null))).toBe(ana);
    expect(await sql`select 1 from identities where user_id = ${ana}`).toHaveLength(3);
  });

  it("keeps unverified or different emails apart", async () => {
    const ana = id(await signInWith(discord, null));
    const other = id(await signInWith({ ...google, email: null }, null));
    expect(other).not.toBe(ana);
  });

  it("adds a sign-in to the account that is already signed in", async () => {
    const ana = id(await signInWith(discord, null));
    expect(id(await signInWith({ ...google, email: "ana.work@example.com" }, ana))).toBe(ana);
    expect(id(await signInWith({ ...google, email: null }, null))).toBe(ana);
  });

  it("refuses to move a sign-in that belongs to someone else", async () => {
    await signInWith(discord, null);
    const bo = id(await signInWith(email("bo@example.com"), null));
    expect(id(await signInWith(discord, bo))).toBe("linked-elsewhere");
  });

  it("asks email-only accounts to pick a name", async () => {
    const bo = id(await signInWith(email("bo@example.com"), null));
    expect(await needsDisplayName(bo)).toBe(true);
    expect(await needsDisplayName(id(await signInWith(discord, null)))).toBe(false);
  });
});

describe("email tokens", () => {
  it("work once", async () => {
    const token = (await createEmailToken("Ana@Example.com"))!;
    expect(await consumeEmailToken(token)).toBe("ana@example.com");
    expect(await consumeEmailToken(token)).toBeNull();
    expect(await consumeEmailToken("made-up")).toBeNull();
  });

  it("expire", async () => {
    const token = (await createEmailToken("ana@example.com"))!;
    await sql`update email_tokens set expires_at = now() - interval '1 second'`;
    expect(await consumeEmailToken(token)).toBeNull();
  });

  it("are limited to 3 an hour per address", async () => {
    for (let i = 0; i < 3; i++) expect(await createEmailToken("ana@example.com")).not.toBeNull();
    expect(await createEmailToken("ANA@example.com")).toBeNull();
    expect(await createEmailToken("bo@example.com")).not.toBeNull();
  });
});
