import { describe, expect, it } from "vitest";
import { INTRO_ID, introMessage, readAnswers, reply, verifySignature, type Interaction } from "./discord-intro";

const config = { roleId: "role1", channelId: "chan1" };
const base = { token: "tok", application_id: "app1", guild_id: "guild1" };
const newcomer = { roles: [], user: { id: "user1" } };

describe("verifySignature", () => {
  it("accepts Discord's signature and rejects anything else", async () => {
    const keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const toHex = (b: ArrayBuffer) => Buffer.from(b).toString("hex");
    const publicKey = toHex(await crypto.subtle.exportKey("raw", keys.publicKey));
    const body = '{"type":1}';
    const sign = async (msg: string) => toHex(await crypto.subtle.sign("Ed25519", keys.privateKey, new TextEncoder().encode(msg)));
    const signature = await sign("1700000000" + body);

    expect(await verifySignature(publicKey, signature, "1700000000", body)).toBe(true);
    expect(await verifySignature(publicKey, signature, "1700000001", body)).toBe(false);
    expect(await verifySignature(publicKey, signature, "1700000000", '{"type":2}')).toBe(false);
    expect(await verifySignature(publicKey, "", "1700000000", body)).toBe(false);
    expect(await verifySignature(publicKey, "zz", "1700000000", body)).toBe(false);
  });
});

describe("reply", () => {
  it("answers Discord's ping", () => {
    expect(reply({ ...base, type: 1 }, config).body).toEqual({ type: 1 });
  });

  it("opens the intro form from the button", () => {
    const r = reply({ ...base, type: 3, member: newcomer, data: { custom_id: INTRO_ID } }, config);
    expect(r.body).toMatchObject({ type: 9, data: { custom_id: INTRO_ID } });
    expect(r.join).toBeUndefined();
  });

  it("turns away members who already have the role", () => {
    const member = { roles: ["role1"], user: { id: "user1" } };
    for (const type of [3, 5]) {
      const r = reply({ ...base, type, member, data: { custom_id: INTRO_ID } } as Interaction, config);
      expect(r.body).toMatchObject({ type: 4, data: { content: expect.stringContaining("already in"), flags: 64 } });
      expect(r.join).toBeUndefined();
    }
  });

  it("defers a submitted intro and lets the member in afterwards", () => {
    const components = [
      { type: 18, component: { type: 4, custom_id: "game", value: " Chrono Trigger " } },
      { type: 18, component: { type: 4, custom_id: "found", value: "A flyer" } },
      { type: 18, component: { type: 4, custom_id: "more", value: "" } },
    ];
    const r = reply({ ...base, type: 5, member: newcomer, data: { custom_id: INTRO_ID, components } }, config);
    expect(r.body).toEqual({ type: 5, data: { flags: 64 } });
    expect(r.join).toEqual({ userId: "user1", answers: { game: "Chrono Trigger", found: "A flyer", more: "" } });
  });

  it("refuses an intro with a required answer missing", () => {
    const components = [{ type: 1, components: [{ type: 4, custom_id: "game", value: "Chrono Trigger" }] }];
    const r = reply({ ...base, type: 5, member: newcomer, data: { custom_id: INTRO_ID, components } }, config);
    expect(r.body).toMatchObject({ type: 4 });
    expect(r.join).toBeUndefined();
  });

  it("refuses interactions from outside the server", () => {
    const r = reply({ ...base, type: 3, data: { custom_id: INTRO_ID } }, config);
    expect(r.body).toMatchObject({ type: 4 });
  });
});

describe("readAnswers", () => {
  it("reads labeled inputs and legacy action rows", () => {
    expect(
      readAnswers([
        { type: 18, component: { type: 4, custom_id: "game", value: "Metroid" } },
        { type: 1, components: [{ type: 4, custom_id: "found", value: " Reddit\n" }] },
      ]),
    ).toEqual({ game: "Metroid", found: "Reddit" });
  });
});

describe("introMessage", () => {
  it("welcomes the member and neutralizes markdown and mentions in answers", () => {
    const msg = introMessage("user1", { game: "@everyone **Contra**", found: "[a link](https://x.test)", more: "line one\n\nline two" });
    expect(msg).toContain("Welcome <@user1>");
    expect(msg).toContain("**Favorite retro game:** \\@everyone \\*\\*Contra\\*\\*");
    expect(msg).toContain("\\[a link\\]\\(https://x.test\\)");
    expect(msg).toContain("**Welcome message:** line one line two");
  });

  it("leaves out the optional answer when blank", () => {
    expect(introMessage("user1", { game: "Contra", found: "Friend", more: "" })).not.toContain("Welcome message");
  });
});
