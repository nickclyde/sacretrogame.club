import { sameOrigin, seeOther } from "@/lib/auth/http";
import { endSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  const res = seeOther(request, "/");
  await endSession(res);
  return res;
}
