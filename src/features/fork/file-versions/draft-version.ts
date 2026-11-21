/**
 * A draft file's version choice is saved with the file, so a reload keeps it
 * the way upstream keeps the file. Without it a restored file looks unchosen
 * and the picker pre-selects again, even after the sender chose "Not a new
 * version". The choice is saved under its own key and taken off on restore,
 * so it reaches a message only through `prepareForSend`.
 */
import type { UploadedAttachment } from "../../relay/attachments";
import type { VersionTarget } from "./supersedes";

const SAVED_VERSION = "k2Version";
const HEX64 = /^[0-9a-f]{64}$/i;

/** The uploaded file as saved, carrying its version choice when one was made. */
export function withDraftVersion(
  uploaded: UploadedAttachment,
  version: VersionTarget | null | undefined,
): UploadedAttachment {
  if (version === undefined) return uploaded;
  return { ...uploaded, [SAVED_VERSION]: version } as UploadedAttachment;
}

/** Splits a saved file into the upload descriptor and its version choice. */
export function takeDraftVersion(saved: UploadedAttachment): {
  uploaded: UploadedAttachment;
  version?: VersionTarget | null;
} {
  if (!Object.hasOwn(saved, SAVED_VERSION)) return { uploaded: saved };
  const { [SAVED_VERSION]: value, ...uploaded } = saved as UploadedAttachment &
    Record<string, unknown>;
  const version = savedVersion(value);
  return version === undefined ? { uploaded } : { uploaded, version };
}

function savedVersion(value: unknown): VersionTarget | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const { messageId, url } = value as Record<string, unknown>;
  if (typeof messageId !== "string" || !HEX64.test(messageId)) return undefined;
  if (url === undefined) return { messageId };
  return typeof url === "string" ? { messageId, url } : undefined;
}
