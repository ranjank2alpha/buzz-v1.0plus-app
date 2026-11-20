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

/** Cap on the full channel history offered below the ranked suggestions. */
const MAX_OTHERS = 50;
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

  // Always offer a manual choice. The heuristic floats likely parents to the
  // top as "Suggested", but every earlier file in the channel stays selectable
  // below, so a weak or missing match never hides the control.
  const notSelf = (file: VersionFile) =>
    !(item.uploaded?.sha256 && file.sha256 === item.uploaded.sha256);
  const allFiles = (state.versions?.files ?? []).filter(
    (file) => file.kind === "file" && notSelf(file),
  );
  if (!allFiles.length) return null;

  const suggested = ranked.map(({ file }) => file).filter(notSelf);
  const suggestedIds = new Set(suggested.map((file) => file.eventId));
  const others = allFiles
    .filter((file) => !suggestedIds.has(file.eventId))
    .sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0))
    .slice(0, MAX_OTHERS);

  const chosen = item.version
    ? allFiles.find(
        (file) =>
          file.messageId === item.version?.messageId &&
          (!item.version.url || file.url === item.version.url),
      )
    : undefined;

  const fileOption = (file: VersionFile) => ({
    value: file.eventId,
    label: `${file.filename ?? "File"} · ${day(file.uploadedAt)}`,
  });
  const none = { value: NONE, label: "Not a new version" };
  const groups = suggested.length
    ? [
        { label: "Suggested", options: [none, ...suggested.map(fileOption)] },
        ...(others.length
          ? [
              {
                label: "Other files in this channel",
                options: others.map(fileOption),
              },
            ]
          : []),
      ]
    : [{ label: "Earlier version", options: [none, ...others.map(fileOption)] }];

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
        groups={groups}
        onValueChange={(value) => {
          const file = allFiles.find((candidate) => candidate.eventId === value);
          setVersion(item.id, file ? target(file) : null);
        }}
      />
    </div>
  );
}
