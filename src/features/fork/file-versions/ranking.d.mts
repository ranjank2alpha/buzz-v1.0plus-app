import type { VersionFile } from "./types";

export const SUPERSEDES_MATCH_WINDOW_SECONDS: number;
export const SUPERSEDES_PRESELECT_SCORE: number;

export type RankedSupersedesCandidate = {
  file: VersionFile;
  /** 0–100; see `scoreFilenameSimilarity`. */
  score: number;
};

export function normalizeStem(stem: string): string;

export function scoreFilenameSimilarity(
  uploadFilename: string,
  candidateFilename: string,
): number;

export function rankSupersedesCandidates(
  uploadFilename: string | null | undefined,
  uploadSha256: string | null | undefined,
  files: readonly VersionFile[] | null | undefined,
  nowSeconds?: number,
): RankedSupersedesCandidate[];

export function preselectedSupersedesCandidate(
  ranked: readonly RankedSupersedesCandidate[],
): VersionFile | null;
