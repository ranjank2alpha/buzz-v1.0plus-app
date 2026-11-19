/**
 * The `supersedes` tag: a file message declaring that one of its files is a
 * newer version of a file in an earlier message.
 *
 * Wire format, compatible with every 0.X build:
 *   ["e", "<older message id>", "", "supersedes", "<new file url>", "<older file url>"]
 * 0.X writes and reads only the first four elements, and applies the link to
 * the first file of each message. The fifth and sixth elements, written since
 * 1.0.5-1, name the exact files, so a message carrying several new versions
 * keeps a link for each. Either may be absent; a reader then falls back to
 * the message's first file, as 0.X does.
 */
import { safeMessageUrl } from "../../relay/message-content";

export const SUPERSEDES_MARKER = "supersedes";
/** 0.X builds before 0.5.14-1 published retroactive links as empty messages
 * carrying this marker on the newer file's message id. */
export const SUPERSEDES_SUBJECT_MARKER = "supersedes-subject";

const HEX64 = /^[0-9a-f]{64}$/i;

/** The earlier file a draft attachment replaces. */
export type VersionTarget = Readonly<{ messageId: string; url?: string }>;

export type SupersedesClaim = Readonly<{
  olderId: string;
  newUrl?: string;
  olderUrl?: string;
}>;

export function supersedesTag(target: VersionTarget, newUrl: string) {
  if (!HEX64.test(target.messageId))
    throw new Error("A valid earlier version is required");
  return [
    "e",
    target.messageId.toLowerCase(),
    "",
    SUPERSEDES_MARKER,
    newUrl,
    ...(target.url ? [target.url] : []),
  ];
}

/** Every `supersedes` claim on a message, in tag order, duplicates removed. */
export function supersedesClaims(
  tags: readonly (readonly string[])[],
): SupersedesClaim[] {
  const claims: SupersedesClaim[] = [];
  const seen = new Set<string>();
  for (const [name, id, , marker, newValue, olderValue] of tags) {
    if (name !== "e" || marker !== SUPERSEDES_MARKER || !id || !HEX64.test(id))
      continue;
    const newUrl = newValue ? safeMessageUrl(newValue) : undefined;
    const olderUrl = olderValue ? safeMessageUrl(olderValue) : undefined;
    const olderId = id.toLowerCase();
    const key = `${olderId} ${newUrl ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({
      olderId,
      ...(newUrl ? { newUrl } : {}),
      ...(olderUrl ? { olderUrl } : {}),
    });
  }
  return claims;
}

/** A pre-0.5.14-1 retroactive link: no file of its own, one `e` tag marked
 * `supersedes-subject` (the newer message) and one marked `supersedes`. */
export function legacyLinkDeclaration(
  tags: readonly (readonly string[])[],
): Readonly<{ subject: string; older: string }> | null {
  if (tags.some(([name]) => name === "imeta")) return null;
  let subject: string | undefined;
  let older: string | undefined;
  for (const [name, id, , marker] of tags) {
    if (name !== "e" || !id || !HEX64.test(id)) continue;
    if (marker === SUPERSEDES_SUBJECT_MARKER) subject = id.toLowerCase();
    if (marker === SUPERSEDES_MARKER) older = id.toLowerCase();
  }
  return subject && older && subject !== older ? { subject, older } : null;
}
