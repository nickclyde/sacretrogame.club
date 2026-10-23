import { plain } from "./discord";

// The intro gate: new members see only #welcome, whose "Say hi" button opens a short form.
// Submitting it posts the intro to DISCORD_INTRO_CHANNEL_ID and grants DISCORD_MEMBER_ROLE_ID,
// which unlocks the rest of the server. Discord calls /api/discord/interactions for both steps.

const API = "https://discord.com/api/v10";
export const INTRO_ID = "intro";

// Interaction and response types, from Discord's interactions reference.
const PING = 1;
const COMPONENT = 3;
const MODAL_SUBMIT = 5;
const PONG = 1;
const MESSAGE = 4;
const DEFERRED_MESSAGE = 5;
const MODAL = 9;
const EPHEMERAL = 64;

type Field = { id: string; label: string; description?: string; style: 1 | 2; max: number; required: boolean };

const FIELDS: Field[] = [
  { id: "game", label: "What's a retro game you love?", style: 1, max: 100, required: true },
  { id: "found", label: "How did you find the club?", style: 1, max: 100, required: true },
  {
    id: "more",
    label: "Anything else you'd like to share?",
    description: "What you're playing, what you collect, what part of town you're in",
    style: 2,
    max: 500,
    required: false,
  },
];

export type Answers = Record<string, string>;

export type Interaction = {
  type: number;
  token: string;
  application_id: string;
  guild_id?: string;
  member?: { roles: string[]; user: { id: string } };
  data?: { custom_id?: string; components?: unknown[] };
};

export type Config = { roleId: string; channelId: string };

/** What to answer Discord with, and whether to let the member in once that answer is sent. */
export type Reply = { body: unknown; join?: { userId: string; answers: Answers } };

/** Checks Discord's Ed25519 signature over timestamp + body, which Discord requires of every endpoint. */
export async function verifySignature(publicKey: string, signature: string, timestamp: string, body: string) {
  try {
    const key = await crypto.subtle.importKey("raw", hex(publicKey), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hex(signature), new TextEncoder().encode(timestamp + body));
  } catch {
    return false;
  }
}

function hex(s: string) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(s)) throw new Error("Not hex");
  return Uint8Array.from(s.match(/../g)!, (b) => parseInt(b, 16));
}

const ephemeral = (content: string) => ({ type: MESSAGE, data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } } });

export function reply(i: Interaction, config: Config): Reply {
  if (i.type === PING) return { body: { type: PONG } };
  if (!i.member) return { body: ephemeral("This only works inside the Sac Retro Game Club server.") };
  if (i.member.roles.includes(config.roleId)) {
    return { body: ephemeral(`You're already in! Come say hi in <#${config.channelId}>.`) };
  }
  if (i.type === COMPONENT && i.data?.custom_id === INTRO_ID) return { body: introModal() };
  if (i.type === MODAL_SUBMIT && i.data?.custom_id === INTRO_ID) {
    const answers = readAnswers(i.data.components ?? []);
    if (FIELDS.some((f) => f.required && !answers[f.id])) return { body: ephemeral("Please fill in the required questions.") };
    return { body: { type: DEFERRED_MESSAGE, data: { flags: EPHEMERAL } }, join: { userId: i.member.user.id, answers } };
  }
  return { body: ephemeral("Sorry, I don't know that one.") };
}

function introModal() {
  return {
    type: MODAL,
    data: {
      custom_id: INTRO_ID,
      title: "Say hi to Sac Retro Game Club",
      components: FIELDS.map((f) => ({
        type: 18, // label
        label: f.label,
        ...(f.description && { description: f.description }),
        component: { type: 4, custom_id: f.id, style: f.style, max_length: f.max, required: f.required },
      })),
    },
  };
}

/** Pulls text input values out of a modal submission, whether wrapped in labels or action rows. */
export function readAnswers(components: unknown[]): Answers {
  const answers: Answers = {};
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { custom_id?: unknown; value?: unknown; component?: unknown; components?: unknown };
    if (typeof n.custom_id === "string" && typeof n.value === "string") answers[n.custom_id] = n.value.trim();
    walk(n.component);
    if (Array.isArray(n.components)) n.components.forEach(walk);
  };
  components.forEach(walk);
  return answers;
}

export function introMessage(userId: string, answers: Answers) {
  const lines = [
    `👋 Welcome <@${userId}>, our newest member!`,
    `**Favorite retro game:** ${plain(answers.game)}`,
    `**Found us through:** ${plain(answers.found)}`,
  ];
  if (answers.more) lines.push(`**Welcome message:** ${plain(answers.more.replace(/\s+/g, " "))}`);
  return lines.join("\n");
}

/** The message with the "Say hi" button, posted once in #welcome by the bot. */
export function welcomeMessage(channelId: string) {
  return {
    content: [
      "**Welcome to Sac Retro Game Club!** 🕹️",
      "We're a Sacramento club for retro games of every kind: original hardware, emulation, FPGA, arcades, and collecting. We meet up monthly and play a game of the month together.",
      "",
      `To unlock the rest of the server, introduce yourself with the button below. Your intro gets posted in <#${channelId}> so everyone can say hi.`,
    ].join("\n"),
    components: [{ type: 1, components: [{ type: 2, style: 1, label: "Say hi", emoji: { name: "👋" }, custom_id: INTRO_ID }] }],
  };
}

async function discord(method: string, path: string, body?: unknown, auth = true) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(auth && { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }),
      "Content-Type": "application/json",
      "X-Audit-Log-Reason": "Introduced themselves",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Discord ${method} ${path.replace(/\/webhooks\/.*/, "/webhooks/…")} returned ${res.status}`);
}

/**
 * Runs after the deferred reply: grants the role first (that's what matters), then posts the
 * intro, then tells the member how it went in the ephemeral reply Discord is showing them.
 */
export async function join(i: Interaction, config: Config, userId: string, answers: Answers) {
  const tell = (content: string) =>
    discord("PATCH", `/webhooks/${i.application_id}/${i.token}/messages/@original`, { content }, false);
  try {
    await discord("PUT", `/guilds/${i.guild_id}/members/${userId}/roles/${config.roleId}`);
  } catch (e) {
    console.error("Intro: granting the member role failed", e);
    await tell("Sorry, something went wrong letting you in. Please try again, or message a moderator.").catch(() => {});
    return;
  }
  try {
    await discord("POST", `/channels/${config.channelId}/messages`, {
      content: introMessage(userId, answers),
      allowed_mentions: { users: [userId] },
    });
  } catch (e) {
    console.error("Intro: posting the intro failed", e);
  }
  await tell(`You're in, welcome! Your intro is up in <#${config.channelId}>. Meetup details are at https://sacretrogame.club`).catch(
    (e) => console.error("Intro: updating the reply failed", e),
  );
}
