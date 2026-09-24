import { z } from "zod";
import { emailConfigured, createEmailToken, sendSignInEmail } from "@/lib/auth/email";
import { sameOrigin, seeOther } from "@/lib/auth/http";
import { safeNext } from "@/lib/auth/tokens";
import { clientIp, rateLimiter } from "@/lib/rate-limit";

const allowed = rateLimiter(10, 60 * 60 * 1000);
const email = z.email().max(254);

/** Emails a one-time sign-in link. The reply never says whether the address has an account. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const form = await request.formData();
  const next = safeNext(form.get("next")?.toString());
  const back = (query: string) => seeOther(request, `/sign-in?${query}&next=${encodeURIComponent(next)}`);

  if (!emailConfigured()) return back("error=unavailable");
  const parsed = email.safeParse(form.get("email")?.toString().trim());
  if (!parsed.success) return back("error=bad-email");
  if (!allowed(clientIp(request))) return back("error=too-many");

  const token = await createEmailToken(parsed.data);
  if (!token) return back("error=too-many");
  const link = new URL("/sign-in/email", process.env.SITE_URL || request.url);
  link.search = new URLSearchParams({ token, next }).toString();
  try {
    await sendSignInEmail(parsed.data, link.toString());
  } catch (e) {
    console.error("Sign-in email failed", e);
    return back("error=email-failed");
  }
  return back("sent=1");
}
