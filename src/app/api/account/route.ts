import { z } from "zod";
import { sameOrigin, seeOther } from "@/lib/auth/http";
import { getUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/tokens";
import { setDisplayName } from "@/lib/auth/users";

const displayName = z.string().trim().min(1).max(40);

/** Saves the name shown next to someone's nominations and in the list of who voted. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const user = await getUser();
  if (!user) return seeOther(request, "/sign-in?next=/account");
  const form = await request.formData();
  const next = form.get("next")?.toString();
  const parsed = displayName.safeParse(form.get("name")?.toString());
  if (!parsed.success) return seeOther(request, "/account?error=bad-name");
  await setDisplayName(user.id, parsed.data);
  return seeOther(request, next ? safeNext(next) : "/account?saved=1");
}
