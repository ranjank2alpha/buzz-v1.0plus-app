import type { VersionFile } from "./types";

export type FileVersionChain = {
  /** The current version: nothing in this channel supersedes it. */
  latest: VersionFile;
  /** Every prior version behind `latest`, newest first. Empty when unversioned. */
  older: VersionFile[];
};

export function resolveLatestEventId(
  startId: string,
  supersededByEventId: Map<string, string>,
): string;

export function buildFileVersionChains(
  files: readonly VersionFile[] | null | undefined,
): FileVersionChain[];

export function buildLatestVersionIndex(
  files: readonly VersionFile[] | null | undefined,
): Map<string, string>;
