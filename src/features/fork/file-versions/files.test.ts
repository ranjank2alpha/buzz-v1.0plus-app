import { describe, expect, it } from "vitest";
import type { EventData } from "../../relay/events";
import { channelFiles, channelVersions, earlierVersions } from "./files";
import {
  legacyLinkDeclaration,
  supersedesClaims,
  supersedesTag,
} from "./supersedes";

const CHANNEL = "channel-1";
const id = (n: number) => n.toString(16).padStart(64, "0");
const url = (name: string) => `https://media.example/${name}`;
const hash = (n: number) => n.toString(16).padStart(64, "a");
const imeta = (name: string, n: number) => [
  "imeta",
  `url ${url(name)}`,
  "m application/pdf",
  "size 10",
  `x ${hash(n)}`,
  `filename ${name}`,
];
let clock = 1_000;
function message(
  n: number,
  tags: string[][],
  content = "",
  pubkey = "alice",
): EventData {
  clock += 10;
  return {
    id: id(n),
    pubkey,
    created_at: clock,
    kind: 9,
    content,
    tags: [["h", CHANNEL], ...tags],
  };
}

describe("supersedes tags", () => {
  it("writes the 0.X prefix followed by the exact files", () => {
    expect(
      supersedesTag({ messageId: id(1), url: url("a") }, url("b")),
    ).toEqual(["e", id(1), "", "supersedes", url("b"), url("a")]);
    expect(() => supersedesTag({ messageId: "x" }, url("b"))).toThrow();
  });

  it("reads 0.X and 1.0 claims, ignoring thread markers", () => {
    expect(
      supersedesClaims([
        ["e", id(9), "", "root"],
        ["e", id(1), "", "supersedes"],
        ["e", id(2), "", "supersedes", url("b")],
        ["e", "nothex", "", "supersedes"],
      ]),
    ).toEqual([{ olderId: id(1) }, { olderId: id(2), newUrl: url("b") }]);
  });

  it("recognises a pre-0.5.14-1 link declaration", () => {
    expect(
      legacyLinkDeclaration([
        ["h", CHANNEL],
        ["e", id(2), "", "supersedes-subject"],
        ["e", id(1), "", "supersedes"],
      ]),
    ).toEqual({ subject: id(2), older: id(1) });
    expect(
      legacyLinkDeclaration([
        imeta("a.pdf", 1),
        ["e", id(1), "", "supersedes"],
      ]),
    ).toBeNull();
  });
});

describe("channelFiles", () => {
  it("chains a 0.X four-element tag to the message's first file", () => {
    const files = channelFiles(CHANNEL, [
      message(1, [imeta("plan.pdf", 1)]),
      message(2, [imeta("plan v2.pdf", 2), ["e", id(1), "", "supersedes"]]),
    ]);
    const versions = channelVersions(files);
    expect(versions.chains).toHaveLength(1);
    expect(versions.latest.get(id(1))).toBe(id(2));
    expect(earlierVersions(versions, id(2))).toBe(1);
  });

  it("keeps a separate link for each file in one message", () => {
    const files = channelFiles(CHANNEL, [
      message(1, [imeta("budget.pdf", 1)]),
      message(2, [imeta("deck.pdf", 2)]),
      message(3, [
        imeta("budget v2.pdf", 3),
        imeta("deck v2.pdf", 4),
        supersedesTag(
          { messageId: id(1), url: url("budget.pdf") },
          url("budget v2.pdf"),
        ),
        supersedesTag(
          { messageId: id(2), url: url("deck.pdf") },
          url("deck v2.pdf"),
        ),
      ]),
    ]);
    const versions = channelVersions(files);
    expect(versions.latest.get(id(1))).toBe(id(3));
    expect(versions.latest.get(id(2))).toBe(`${id(3)} ${url("deck%20v2.pdf")}`);
    expect(versions.chains).toHaveLength(2);
  });

  it("targets the exact earlier file when that message had several", () => {
    const files = channelFiles(CHANNEL, [
      message(1, [imeta("a.pdf", 1), imeta("b.pdf", 2)]),
      message(2, [
        imeta("b v2.pdf", 3),
        supersedesTag({ messageId: id(1), url: url("b.pdf") }, url("b v2.pdf")),
      ]),
    ]);
    const versions = channelVersions(files);
    expect(versions.latest.get(`${id(1)} ${url("b.pdf")}`)).toBe(id(2));
    expect(versions.latest.get(id(1))).toBe(id(1));
  });

  it("drops deleted, tombstoned and copied messages", () => {
    const deletion: EventData = {
      id: id(90),
      pubkey: "alice",
      created_at: 5_000,
      kind: 5,
      content: "",
      tags: [
        ["h", CHANNEL],
        ["e", id(2)],
        ["k", "9"],
      ],
    };
    const tombstone: EventData = {
      id: id(91),
      pubkey: "relay",
      created_at: 5_001,
      kind: 40099,
      content: JSON.stringify({
        type: "message_deleted",
        target_event_id: id(3),
      }),
      tags: [["h", CHANNEL]],
    };
    const files = channelFiles(CHANNEL, [
      message(1, [imeta("a.pdf", 1)]),
      message(2, [imeta("b.pdf", 2)]),
      message(3, [imeta("c.pdf", 3)]),
      message(4, [imeta("a.pdf", 1), ["buzz:copy-of", id(1)]]),
      deletion,
      tombstone,
    ]);
    expect(files.map((file) => file.filename)).toEqual(["a.pdf"]);
  });

  it("reads a pre-0.5.14-1 declaration without listing it", () => {
    const files = channelFiles(CHANNEL, [
      message(1, [imeta("a.pdf", 1)]),
      message(2, [imeta("a v2.pdf", 2)]),
      message(3, [
        ["e", id(2), "", "supersedes-subject"],
        ["e", id(1), "", "supersedes"],
      ]),
    ]);
    const versions = channelVersions(files);
    expect(files).toHaveLength(2);
    expect(versions.latest.get(id(1))).toBe(id(2));
  });

  it("lists links and lets a lone link supersede a file", () => {
    const files = channelFiles(CHANNEL, [
      message(1, [imeta("spec.pdf", 1)]),
      message(
        2,
        [["e", id(1), "", "supersedes"]],
        "now at https://docs.example/spec",
      ),
    ]);
    const link = files.find((file) => file.kind === "link");
    expect(link?.url).toBe("https://docs.example/spec");
    expect(channelVersions(files).latest.get(id(1))).toBe(id(2));
  });

  it("includes files in thread replies", () => {
    const files = channelFiles(CHANNEL, [
      message(1, [], "root"),
      message(2, [imeta("r.pdf", 1), ["e", id(1), "", "reply"]]),
    ]);
    expect(files[0]?.rootId).toBe(id(1));
  });
});
