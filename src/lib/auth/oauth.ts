import { pkceChallenge } from "./tokens";
import type { Profile } from "./users";

export type OAuthProvider = "discord" | "google";

/** Holds state, the PKCE verifier, and where to go next while the provider is open. */
export const OAUTH_COOKIE = "srgc_oauth";

export class NotInServerError extends Error {}

type Config = {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  clientId?: string;
  clientSecret?: string;
  profile: (accessToken: string) => Promise<Profile>;
};

const DISCORD_API = "https://discord.com/api/v10";

const PROVIDERS: Record<OAuthProvider, () => Config> = {
  discord: () => ({
    authorizeUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: `${DISCORD_API}/oauth2/token`,
    scopes: "identify email guilds.members.read",
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    profile: discordProfile,
  }),
  google: () => ({
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "openid email profile",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    profile: googleProfile,
  }),
};

export function isOAuthProvider(p: string): p is OAuthProvider {
  return p in PROVIDERS;
}

export function oauthConfigured(p: OAuthProvider) {
  const c = PROVIDERS[p]();
  return Boolean(c.clientId && c.clientSecret);
}

/** Where the provider sends people back. Built from SITE_URL so it matches the registered URI. */
export function redirectUri(p: OAuthProvider, requestUrl: string) {
  const origin = process.env.SITE_URL || new URL(requestUrl).origin;
  return `${origin}/api/auth/${p}/callback`;
}

export function authorizationUrl(p: OAuthProvider, redirect: string, state: string, verifier: string) {
  const c = PROVIDERS[p]();
  const url = new URL(c.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: c.clientId!,
    redirect_uri: redirect,
    response_type: "code",
    scope: c.scopes,
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: p === "google" ? "select_account" : "none",
  }).toString();
  return url.toString();
}

/** Trades the callback code for an access token and reads who signed in. */
export async function exchange(p: OAuthProvider, code: string, redirect: string, verifier: string): Promise<Profile> {
  const c = PROVIDERS[p]();
  const res = await fetch(c.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      client_id: c.clientId!,
      client_secret: c.clientSecret!,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`${p} token exchange returned ${res.status}`);
  const { access_token } = (await res.json()) as { access_token: string };
  return c.profile(access_token);
}

async function getJson<T>(url: string, token: string): Promise<{ status: number; body: T | null }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: res.ok ? ((await res.json()) as T) : null };
}

type DiscordUser = { id: string; username: string; global_name: string | null; email?: string | null; verified?: boolean };

async function discordProfile(token: string): Promise<Profile> {
  const me = await getJson<DiscordUser>(`${DISCORD_API}/users/@me`, token);
  if (!me.body) throw new Error(`Discord profile returned ${me.status}`);
  const guild = process.env.DISCORD_GUILD_ID;
  let nick: string | null = null;
  if (guild) {
    const member = await getJson<{ nick: string | null }>(`${DISCORD_API}/users/@me/guilds/${guild}/member`, token);
    if (member.status === 404) throw new NotInServerError();
    if (!member.body) throw new Error(`Discord member lookup returned ${member.status}`);
    nick = member.body.nick;
  }
  const u = me.body;
  return {
    provider: "discord",
    subject: u.id,
    email: u.verified && u.email ? u.email : null,
    displayName: nick || u.global_name || u.username,
  };
}

type GoogleUser = { sub: string; email?: string; email_verified?: boolean; name?: string; given_name?: string };

async function googleProfile(token: string): Promise<Profile> {
  const me = await getJson<GoogleUser>("https://openidconnect.googleapis.com/v1/userinfo", token);
  if (!me.body) throw new Error(`Google profile returned ${me.status}`);
  const u = me.body;
  return {
    provider: "google",
    subject: u.sub,
    email: u.email_verified && u.email ? u.email : null,
    displayName: u.name || u.given_name || "",
  };
}
