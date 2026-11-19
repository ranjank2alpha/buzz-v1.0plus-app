/** One file or link shared in a channel, as the version graph sees it. */
export type VersionFile = {
  kind: "file" | "link";
  /** Graph identity. A message's first file uses the message id, which is
   * what a four-element `supersedes` tag names; any further file in the same
   * message uses `"<message id> <url>"`. */
  eventId: string;
  /** The message that carries the file. */
  messageId: string;
  /** Thread root when the message is a reply. */
  rootId: string | null;
  uploadedBy: string;
  /** Unix seconds. */
  uploadedAt: number;
  filename: string | null;
  sha256: string | null;
  size: number | null;
  mime: string | null;
  url: string | null;
  note: string | null;
  /** Graph identity of the file this one replaces. */
  supersedes: string | null;
  supersededBy: string | null;
};
