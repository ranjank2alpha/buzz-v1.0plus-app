import { describe, expect, it } from "vitest";
import {
  channelScopeMentions,
  detectMentionScope,
  MENTION_SCOPE_TAG,
  mentionScopeOf,
  mentionScopeTags,
} from "./mention-scope";

describe("detectMentionScope", () => {
  it("finds @channel and @here in the composed text", () => {
    expect(detectMentionScope("@channel standup moved")).toBe("channel");
    expect(detectMentionScope("heads up @here")).toBe("here");
    expect(detectMentionScope("mid @here sentence works")).toBe("here");
  });

  it("ignores case", () => {
    expect(detectMentionScope("@Channel please read")).toBe("channel");
    expect(detectMentionScope("@HERE")).toBe("here");
  });

  it("prefers @channel when both appear", () => {
    expect(detectMentionScope("@here and @channel")).toBe("channel");
  });

  it("finds nothing in ordinary text", () => {
    expect(detectMentionScope("nothing to see")).toBeNull();
    expect(detectMentionScope("")).toBeNull();
    expect(detectMentionScope("@priya can you look")).toBeNull();
  });

  it("does not page anyone for lookalikes", () => {
    expect(detectMentionScope("mail support@channel-ops.example")).toBeNull();
    expect(detectMentionScope("see docs/@here-ish")).toBeNull();
    expect(detectMentionScope("@channels")).toBeNull();
    expect(detectMentionScope("@herewith")).toBeNull();
    expect(detectMentionScope("email me@here.com")).toBeNull();
    expect(detectMentionScope("@channel-ops is on it")).toBeNull();
  });

  it("ends the word at trailing punctuation", () => {
    expect(detectMentionScope("please read this @here.")).toBe("here");
    expect(detectMentionScope("@channel, standup moved")).toBe("channel");
    expect(detectMentionScope("(@here)")).toBe("here");
  });

  it("does not page anyone for a URL", () => {
    expect(detectMentionScope("https://medium.com/@channel")).toBeNull();
    expect(
      detectMentionScope("read [this](https://medium.com/@here/post)"),
    ).toBeNull();
    expect(detectMentionScope("see http://x.test/@channel now")).toBeNull();
  });

  it("does not page anyone for code", () => {
    expect(detectMentionScope("`@here` is the syntax")).toBeNull();
    expect(detectMentionScope("```\nsay @channel\n```")).toBeNull();
    expect(detectMentionScope("~~~md\n@here\n~~~\nthanks")).toBeNull();
    expect(detectMentionScope("```\nunclosed @channel")).toBeNull();
  });

  it("does not page anyone for a quote", () => {
    expect(detectMentionScope("> @channel standup moved\nnoted")).toBeNull();
  });

  it("still pages for the real word beside code, quotes and links", () => {
    expect(
      detectMentionScope("> old @here\n`@here` aside, @channel please read"),
    ).toBe("channel");
    expect(
      detectMentionScope("```\ncode\n```\n@here review https://x.test/a"),
    ).toBe("here");
  });
});

describe("mention-scope tags", () => {
  it("writes one tag for a scoped message and none otherwise", () => {
    expect(mentionScopeTags("@here quick sync")).toEqual([
      [MENTION_SCOPE_TAG, "here"],
    ]);
    expect(mentionScopeTags("no scope")).toEqual([]);
  });

  it("reads only known scope values", () => {
    expect(
      mentionScopeOf([
        ["h", "c"],
        [MENTION_SCOPE_TAG, "channel"],
      ]),
    ).toBe("channel");
    expect(mentionScopeOf([[MENTION_SCOPE_TAG, "here"]])).toBe("here");
    expect(mentionScopeOf([[MENTION_SCOPE_TAG, "everyone"]])).toBeNull();
    expect(mentionScopeOf([["h", "c"]])).toBeNull();
  });

  it("addresses every member but the author", () => {
    const event = { pubkey: "author", tags: [[MENTION_SCOPE_TAG, "channel"]] };
    expect(channelScopeMentions(event, "viewer")).toBe(true);
    expect(channelScopeMentions(event, "author")).toBe(false);
    expect(
      channelScopeMentions(
        { pubkey: "author", tags: [[MENTION_SCOPE_TAG, "here"]] },
        "viewer",
      ),
    ).toBe(false);
  });
});
