import type { EventData } from "../../relay/events";
import { foldMessages } from "../../relay/fold";
import { safeMessageUrl } from "../../relay/message-content";
import { buildFileVersionChains, buildLatestVersionIndex } from "./chains.mjs";
import { cleanCaption, collectChannelLinkEntries } from "./link-entries.mjs";
import type { LinkSourceMessage } from "./link-entries.mjs";
import { legacyLinkDeclaration, supersedesClaims } from "./supersedes";
import type { VersionFile } from "./types";

/** Every kind the channel file list is built from: messages, edits that can
 * replace attachments, author deletions, and the relay's 40099 tombstones. */
export const VERSION_READ_KINDS = [9, 40002, 40003, 5, 9005, 40099];

/** Message ids the relay has tombstoned (`{"type":"message_deleted"}`). The
 * relay soft-deletes, so older deletions are known only from these. */
function tombstoned(events: readonly EventData[]) {
  const deleted = new Set<string>();
  for (const event of events) {
    if (event.kind !== 40099) continue;
    try {
      const body = JSON.parse(event.content) as {
        type?: unknown;
        target_event_id?: unknown;
      };
      if (
        body.type === "message_deleted" &&
        typeof body.target_event_id === "string"
      )
        deleted.add(body.target_event_id.toLowerCase());
    } catch {
      // Another system message.
    }
  }
  return deleted;
}

/** `url -> sha256` from an event's imeta tags. */
function imetaHashes(event: EventData | undefined) {
  const hashes = new Map<string, string>();
  for (const tag of event?.tags ?? []) {
    if (tag[0] !== "imeta") continue;
    let url: string | undefined;
    let hash: string | undefined;
    for (const field of tag.slice(1)) {
      if (field.startsWith("url ")) url = safeMessageUrl(field.slice(4));
      if (field.startsWith("x ")) hash = field.slice(2);
    }
    if (url && hash && /^[0-9a-f]{64}$/i.test(hash)) hashes.set(url, hash);
  }
  return hashes;
}

/**
 * The channel's files and links, each linked to the file it replaces.
 *
 * Edits and author deletions follow 1.0's own fold. Forwarded and
 * sent-to-channel copies are left out: they repeat a file already listed.
 */
export function channelFiles(
  channelId: string,
  events: readonly EventData[],
): VersionFile[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const deleted = tombstoned(events);
  const rows = foldMessages(channelId, "", events, {
    includeReplies: true,
    collapseHuddles: false,
  });
  const files: VersionFile[] = [];
  /** File key -> the earlier file it names, before keys are resolved. */
  const claimed = new Map<string, { olderId: string; olderUrl?: string }>();
  const legacy = new Map<string, string>();
  const linkMessages: LinkSourceMessage[] = [];
  const attachmentUrls: string[] = [];
  for (const row of rows) {
    const event = byId.get(row.id);
    if (!event || deleted.has(row.id) || row.membership || row.forward)
      continue;
    if (event.tags.some(([name]) => name === "buzz:copy-of")) continue;
    const declaration = legacyLinkDeclaration(event.tags);
    if (declaration) {
      if (!legacy.has(declaration.subject))
        legacy.set(declaration.subject, declaration.older);
      continue;
    }
    const claims = supersedesClaims(event.tags);
    const hashes = imetaHashes(byId.get(row.attachmentSourceId ?? row.id));
    const attachments = row.attachments.filter((item) => hashes.has(item.url));
    attachments.forEach((attachment, index) => {
      const key = index === 0 ? row.id : `${row.id} ${attachment.url}`;
      const claim =
        claims.find((item) => item.newUrl === attachment.url) ??
        (index === 0 ? claims.find((item) => !item.newUrl) : undefined);
      if (claim)
        claimed.set(key, {
          olderId: claim.olderId,
          ...(claim.olderUrl ? { olderUrl: claim.olderUrl } : {}),
        });
      attachmentUrls.push(attachment.url);
      files.push({
        kind: "file",
        eventId: key,
        messageId: row.id,
        rootId: row.threadRootId ?? null,
        uploadedBy: row.authorId,
        uploadedAt: row.createdAt,
        filename: attachment.name ?? null,
        sha256: hashes.get(attachment.url) ?? null,
        size: attachment.size ?? null,
        mime: attachment.mime ?? null,
        url: attachment.url,
        note: cleanCaption(row.content),
        supersedes: null,
        supersededBy: null,
      });
    });
    linkMessages.push({
      eventId: row.id,
      pubkey: row.authorId,
      createdAt: row.createdAt,
      content: row.content,
      hasAttachment: attachments.length > 0,
      supersedes: claims[0]?.olderId ?? null,
    });
  }
  const used = new Set(files.map((file) => file.eventId));
  const rootOf = new Map(rows.map((row) => [row.id, row.threadRootId]));
  for (const link of collectChannelLinkEntries({
    messages: linkMessages,
    excludedUrls: attachmentUrls,
  })) {
    const key = used.has(link.eventId)
      ? `${link.eventId} ${link.url}`
      : link.eventId;
    used.add(key);
    if (link.supersedes) claimed.set(key, { olderId: link.supersedes });
    files.push({
      ...link,
      eventId: key,
      messageId: link.eventId,
      rootId: rootOf.get(link.eventId) ?? null,
      supersedes: null,
      supersededBy: null,
    });
  }
  // A message's own tag wins over a retroactive declaration about it.
  for (const [subject, older] of legacy)
    if (used.has(subject) && !claimed.has(subject))
      claimed.set(subject, { olderId: older });
  const byKey = new Map(files.map((file) => [file.eventId, file]));
  for (const file of files) {
    const claim = claimed.get(file.eventId);
    if (!claim) continue;
    const exact = claim.olderUrl && `${claim.olderId} ${claim.olderUrl}`;
    file.supersedes =
      exact && byKey.has(exact)
        ? exact
        : byKey.has(claim.olderId)
          ? claim.olderId
          : null;
  }
  for (const file of files) {
    if (!file.supersedes) continue;
    const older = byKey.get(file.supersedes);
    const current = older?.supersededBy && byKey.get(older.supersededBy);
    if (older && (!current || file.uploadedAt > current.uploadedAt))
      older.supersededBy = file.eventId;
  }
  return files;
}

export type ChannelVersions = Readonly<{
  files: readonly VersionFile[];
  chains: ReturnType<typeof buildFileVersionChains>;
  /** File key -> key of the newest version of it. */
  latest: ReadonlyMap<string, string>;
  byKey: ReadonlyMap<string, VersionFile>;
  /** Message id -> its files, in message order. */
  byMessage: ReadonlyMap<string, readonly VersionFile[]>;
}>;

export function channelVersions(
  files: readonly VersionFile[],
): ChannelVersions {
  const byMessage = new Map<string, VersionFile[]>();
  for (const file of files) {
    if (file.kind !== "file") continue;
    byMessage.set(file.messageId, [
      ...(byMessage.get(file.messageId) ?? []),
      file,
    ]);
  }
  return {
    files,
    chains: buildFileVersionChains(files),
    latest: buildLatestVersionIndex(files),
    byKey: new Map(files.map((file) => [file.eventId, file])),
    byMessage,
  };
}

/** How many earlier versions stand behind `key` in its chain. */
export function earlierVersions(versions: ChannelVersions, key: string) {
  let count = 0;
  const seen = new Set([key]);
  let current = versions.byKey.get(key)?.supersedes;
  while (current && !seen.has(current) && versions.byKey.has(current)) {
    // Only the edge the chain kept counts; a losing fork branch is its own chain.
    if (versions.byKey.get(current)?.supersededBy !== [...seen].at(-1)) break;
    seen.add(current);
    count += 1;
    current = versions.byKey.get(current)?.supersedes;
  }
  return count;
}
