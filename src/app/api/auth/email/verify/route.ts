import { consumeEmailToken } from "@/lib/auth/email";
import { finishSignIn, sameOrigin, seeOther } from "@/lib/auth/http";
import { getUser } from "@/lib/auth/session";
import { signInWith } from "@/lib/auth/users";

/**
 * The emailed link opens a page whose button posts here. Mail scanners that follow links
 * only make GET requests, so they can't use up the token.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const form = await request.formData();
  const address = await consumeEmailToken(form.get("token")?.toString() ?? "");
  if (!address) return seeOther(request, "/sign-in?error=link-expired");

  const current = await getUser();
  const result = await signInWith(
    { provider: "email", subject: address, email: address, displayName: "" },
    current?.id ?? null,
  );
  if ("error" in result) return seeOther(request, `/account?error=${result.error}`);
  return finishSignIn(request, result.userId, Boolean(current), form.get("next")?.toString() ?? "/");
}
