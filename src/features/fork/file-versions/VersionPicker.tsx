import { useEffect, useMemo } from "react";
import { Select } from "../../../shared/design-system/ui/Select";
import type { RelaySession } from "../../relay/session";
import type { DraftAttachment } from "../../messages/attachment-draft";
import {
  preselectedSupersedesCandidate,
  rankSupersedesCandidates,
} from "./ranking.mjs";
import { useChannelVersions } from "./store";
import type { VersionTarget } from "./supersedes";
import type { VersionFile } from "./types";
import styles from "./FileVersions.module.css";

/** Candidates shown; the best matches by filename, then the newest. */
const SHOWN = 8;
const NONE = "";

const day = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

const target = (file: VersionFile): VersionTarget => ({
  messageId: file.messageId,
  ...(file.url ? { url: file.url } : {}),
});

/**
 * Under a draft file: which earlier file in this channel it replaces. The
 * best match is chosen for the sender when one filename clearly wins; a tie
 * chooses nothing. The choice is sent as a `supersedes` tag and can't be
 * edited afterwards: deleting the message removes it.
 */
export function AttachmentVersionPicker({
  session,
  channelId,
  item,
  setVersion,
}: {
  session: Pick<RelaySession, "readPage">;
  channelId: string;
  item: DraftAttachment;
  setVersion(id: string, version: VersionTarget | null): void;
}) {
  const state = useChannelVersions(session, channelId, true);
  const name = item.uploaded?.name ?? item.file.name;
  const ranked = useMemo(
    () =>
      state.versions
        ? rankSupersedesCandidates(
            name,
            item.uploaded?.sha256,
            state.versions.files.filter((file) => file.kind === "file"),
          )
        : [],
    [state.versions, name, item.uploaded?.sha256],
  );
  const preselected = preselectedSupersedesCandidate(ranked);
  useEffect(() => {
    if (item.version === undefined && preselected)
      setVersion(item.id, target(preselected));
  }, [item.id, item.version, preselected, setVersion]);
  if (!ranked.length) return null;
  const shown = ranked.slice(0, SHOWN).map(({ file }) => file);
  const chosen = item.version
    ? shown.find(
        (file) =>
          file.messageId === item.version?.messageId &&
          (!item.version.url || file.url === item.version.url),
      )
    : undefined;
  return (
    <div className={styles.picker}>
      <Select
        label={`Earlier version of ${name}`}
        variant="compact"
        size="xs"
        appearance="link"
        value={chosen?.eventId ?? NONE}
        valueLabel={
          chosen ? `Replaces ${chosen.filename ?? "file"}` : "Not a new version"
        }
        groups={[
          {
            label: "Earlier version",
            options: [
              { value: NONE, label: "Not a new version" },
              ...shown.map((file) => ({
                value: file.eventId,
                label: `${file.filename ?? "File"} · ${day(file.uploadedAt)}`,
              })),
            ],
          },
        ]}
        onValueChange={(value) => {
          const file = shown.find((candidate) => candidate.eventId === value);
          setVersion(item.id, file ? target(file) : null);
        }}
      />
    </div>
  );
}
