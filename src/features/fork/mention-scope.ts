/**
 * `@channel` and `@here`: one marker tag, resolved against the channel's
 * current members by each reader. Compatible with every 0.X build.
 *
 * Unrelated to 1.0's `["broadcast", "1"]` tag, which marks a thread reply
 * also posted to the channel.
 */
export const MENTION_SCOPE_TAG = "mention-scope";
export type MentionScope = "channel" | "here";

const SCOPES = new Set<string>(["channel", "here"]);

/**
 * The message text with everything that addresses no one removed: fenced
 * code, inline code, quoted lines, and URLs (including Markdown link
 * targets). Paging forty people by accident is the costly mistake, so a word
 * inside any of these never counts.
 */
export function addressedText(content: string) {
  const kept: string[] = [];
  let fence: string | undefined;
  for (const line of content.split("\n")) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length)
        fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    if (/^ {0,3}>/.test(line)) continue;
    kept.push(line);
  }
  return kept
    .join("\n")
    .replace(/`+[^`\n]*`+/g, " ")
    .replace(/\]\([^)\s]*\)/g, "]")
    .replace(/\b(?:https?|ftp):\/\/\S*/gi, " ");
}

/** The scope written in a message, or null. `@channel` wins when both appear:
 * it is the wider audience. The word must stand alone: `@channel-ops` and
 * `docs/@here-ish` page nobody. */
export function detectMentionScope(content: string): MentionScope | null {
  const text = addressedText(content);
  if (/(^|[^\w@/])@channel(?![\w-])/i.test(text)) return "channel";
  if (/(^|[^\w@/])@here(?![\w-])/i.test(text)) return "here";
  return null;
}

/** The tag a sent message carries, if any. */
export function mentionScopeTags(content: string): string[][] {
  const scope = detectMentionScope(content);
  return scope ? [[MENTION_SCOPE_TAG, scope]] : [];
}

export function mentionScopeOf(
  tags: readonly (readonly string[])[],
): MentionScope | null {
  for (const [name, value] of tags)
    if (name === MENTION_SCOPE_TAG && value && SCOPES.has(value))
      return value as MentionScope;
  return null;
}

/** `@channel` addresses every member except its author. */
export function channelScopeMentions(
  event: Readonly<{ pubkey: string; tags: readonly (readonly string[])[] }>,
  viewer: string,
) {
  return event.pubkey !== viewer && mentionScopeOf(event.tags) === "channel";
}
