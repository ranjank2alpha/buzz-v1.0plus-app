/** The fork's edits to upstream files, tested where they run. */
import { describe, expect, it, vi } from "vitest";
import { attachmentDraft } from "../messages/attachment-draft";
import { attachmentMessage } from "../relay/attachments";
import { createMessages } from "../relay/messages";
import type { Outbox } from "../relay/outbox";
import type { MessageAttention } from "../relay/unread";
import { hereAlert } from "./here-alert";

const origin = "https://relay.test";
const hash = "a".repeat(64);
const older = "b".repeat(64);
const root = "f".repeat(64);
const uploaded = {
  name: "plan v2.pdf",
  url: `${origin}/media/${hash}.pdf`,
  type: "application/pdf",
  size: 3,
  sha256: hash,
};

describe("supersedes tag on upload", () => {
  it("follows the file's imeta and names both files", () => {
    const result = attachmentMessage(
      "",
      [
        {
          ...uploaded,
          supersedes: { messageId: older, url: "https://x.test/a" },
        },
      ],
      origin,
    );
    expect(result.tags[1]).toEqual([
      "e",
      older,
      "",
      "supersedes",
      uploaded.url,
      "https://x.test/a",
    ]);
  });

  it("adds nothing to a file that replaces none", () => {
    expect(attachmentMessage("", [uploaded], origin).tags).toHaveLength(1);
  });
});

function setup() {
  const send = vi.fn((_template: { tags: string[][] }) => "id");
  const outbox = { supports: () => true, send } as unknown as Outbox;
  const messages = createMessages(
    outbox,
    "1".repeat(64),
    () => undefined,
    () => [],
    () => {},
    () => true,
    origin,
  );
  const tags = () => send.mock.calls.at(-1)?.[0].tags ?? [];
  return { messages, tags };
}

describe("mention-scope tag on send", () => {
  it.each(["send", "reply"] as const)("is written by %s", (verb) => {
    const { messages, tags } = setup();
    if (verb === "send") messages.send("c", "@channel standup moved");
    else messages.reply("c", root, "@here quick look");
    expect(tags()).toContainEqual([
      "mention-scope",
      verb === "send" ? "channel" : "here",
    ]);
  });

  it("is not written for a URL or ordinary text", () => {
    const { messages, tags } = setup();
    messages.send("c", "see https://medium.com/@channel");
    expect(tags().some(([name]) => name === "mention-scope")).toBe(false);
  });

  it("goes out with reply and supersedes tags on one reply", () => {
    const { messages, tags } = setup();
    messages.reply(
      "c",
      root,
      "@channel v2 attached",
      [],
      [{ ...uploaded, supersedes: { messageId: older } }],
    );
    expect(tags()).toContainEqual(["e", root, "", "reply"]);
    expect(tags()).toContainEqual(["mention-scope", "channel"]);
    expect(
      tags().some(
        ([name, id, , marker]) =>
          name === "e" && id === older && marker === "supersedes",
      ),
    ).toBe(true);
  });
});

describe("@here alerts", () => {
  const attention = (
    change: Partial<MessageAttention> = {},
  ): MessageAttention => ({
    status: "ineligible",
    here: true,
    unread: true,
    forced: false,
    viewing: false,
    ...change,
  });
  const session = (
    muted: readonly string[] = [],
    presence: "online" | "away" | "offline" | "unknown" = "online",
  ) =>
    ({
      sidebarPreferences: {
        snapshot: () => ({ status: "ready", cached: false, data: { muted } }),
      },
      presence: { status: () => presence },
    }) as unknown as Parameters<typeof hereAlert>[1];

  it("alerts an online, unmuted member", () => {
    expect(hereAlert(attention(), session(), "v", "c", false)).toBe(true);
  });

  it("never overrides a mute", () => {
    expect(hereAlert(attention(), session(["c"]), "v", "c", false)).toBe(false);
  });

  it("skips a member who is away or offline", () => {
    expect(hereAlert(attention(), session([], "away"), "v", "c", false)).toBe(
      false,
    );
    expect(
      hereAlert(attention(), session([], "offline"), "v", "c", false),
    ).toBe(false);
  });

  it("stays quiet once read, or while viewing unless asked", () => {
    expect(
      hereAlert(attention({ unread: false }), session(), "v", "c", false),
    ).toBe(false);
    expect(
      hereAlert(attention({ viewing: true }), session(), "v", "c", false),
    ).toBe(false);
  });

  it("waits for an event not indexed yet", () => {
    expect(
      hereAlert(attention({ status: "unknown" }), session(), "v", "c", false),
    ).toBe("wait");
  });
});

describe("version choice in the attachment draft", () => {
  it("rides on the uploaded file at send, and none means none", async () => {
    const session = {
      attachments: { upload: vi.fn() },
    } as unknown as Parameters<typeof attachmentDraft>[0];
    const draft = attachmentDraft(session, "fork-test", "c");
    draft.addUploaded(uploaded);
    draft.addUploaded({
      ...uploaded,
      url: `${origin}/media/${"c".repeat(64)}.pdf`,
    });
    const [first, second] = draft.snapshot();
    draft.setVersion(first?.id ?? "", { messageId: older });
    draft.setVersion(second?.id ?? "", null);
    const sent = await draft.prepareForSend(new AbortController().signal);
    expect(sent[0]?.supersedes).toEqual({ messageId: older });
    expect(sent[1]?.supersedes).toBeUndefined();
    expect(draft.snapshot()[1]?.version).toBeNull();
  });
});
