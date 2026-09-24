import { createHash, randomBytes } from "node:crypto";

/** A random URL-safe secret, used for session tokens, emailed links, and OAuth state. */
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Tokens are stored only as hashes, so a database leak can't be replayed as sign-ins. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** PKCE S256 challenge for an OAuth code verifier. */
export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Only same-site paths are allowed as a post sign-in destination. */
export function safeNext(next: string | null | undefined, fallback = "/") {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
