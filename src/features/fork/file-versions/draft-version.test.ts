// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachmentDraft } from "../../messages/attachment-draft";
import { takeDraftVersion, withDraftVersion } from "./draft-version";

const origin = "https://relay.test";
const hash = "a".repeat(64);
const older = "b".repeat(64);
const first = {
  name: "plan v2.pdf",
  url: `${origin}/media/${hash}.pdf`,
  type: "application/pdf",
  size: 3,
  sha256: hash,
};
const second = { ...first, url: `${origin}/media/${"c".repeat(64)}.pdf` };
const third = { ...first, url: `${origin}/media/${"d".repeat(64)}.pdf` };
const saved = ["fork-reload", "draft:files"] as const;

// Each call is a new window: a fresh session reads the draft back from storage.
const reopen = () =>
  attachmentDraft(
    { attachments: { upload: vi.fn() } } as unknown as Parameters<
      typeof attachmentDraft
    >[0],
    "fork-reload",
    "c",
    false,
    saved,
  );

afterEach(() => localStorage.clear());

describe("version choice across a reload", () => {
  it("keeps a chosen file, a declined choice and an unmade one", async () => {
    const before = reopen();
    before.addUploaded(first);
    before.addUploaded(second);
    before.addUploaded(third);
    const [a, b] = before.snapshot();
    before.setVersion(a?.id ?? "", {
      messageId: older,
      url: "https://x.test/a",
    });
    before.setVersion(b?.id ?? "", null);

    const after = reopen();
    const items = after.snapshot();
    expect(items.map((item) => item.version)).toEqual([
      { messageId: older, url: "https://x.test/a" },
      null,
      undefined,
    ]);
    expect(items.map((item) => item.uploaded)).toEqual([first, second, third]);
    expect(await after.prepareForSend(new AbortController().signal)).toEqual([
      { ...first, supersedes: { messageId: older, url: "https://x.test/a" } },
      second,
      third,
    ]);
  });

  it("saves a file with no choice exactly as upstream does", () => {
    expect(withDraftVersion(first, undefined)).toBe(first);
    expect(takeDraftVersion(first)).toEqual({ uploaded: first });
  });

  it("drops a damaged saved choice and keeps the file", () => {
    for (const bad of [
      { messageId: "nope" },
      "x",
      { messageId: older, url: 1 },
    ])
      expect(
        takeDraftVersion({ ...first, k2Version: bad } as typeof first),
      ).toEqual({ uploaded: first });
  });
});
