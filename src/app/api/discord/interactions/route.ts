import { after } from "next/server";
import { join, reply, verifySignature, type Interaction } from "@/lib/discord-intro";

export async function POST(request: Request) {
  const { DISCORD_PUBLIC_KEY: publicKey, DISCORD_MEMBER_ROLE_ID: roleId, DISCORD_INTRO_CHANNEL_ID: channelId } = process.env;
  if (!publicKey || !roleId || !channelId || !process.env.DISCORD_BOT_TOKEN) {
    return Response.json({ error: "Not configured" }, { status: 503 });
  }
  const body = await request.text();
  const signature = request.headers.get("x-signature-ed25519") ?? "";
  const timestamp = request.headers.get("x-signature-timestamp") ?? "";
  if (!(await verifySignature(publicKey, signature, timestamp, body))) {
    return Response.json({ error: "Bad signature" }, { status: 401 });
  }

  const interaction = JSON.parse(body) as Interaction;
  const config = { roleId, channelId };
  const { body: response, join: joining } = reply(interaction, config);
  if (joining) after(() => join(interaction, config, joining.userId, joining.answers));
  return Response.json(response);
}
