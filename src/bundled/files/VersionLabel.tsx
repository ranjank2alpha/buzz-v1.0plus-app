import { useEffect } from "react";
import type { ComposerAccessoryProps } from "../../features/conversation/contracts";
import { earlierVersions } from "../../features/fork/file-versions/files";
import {
  useChannelVersions,
  versionStore,
} from "../../features/fork/file-versions/store";
import { Button } from "../../shared/design-system/ui/Button";
import { messageLink } from "./links";
import styles from "./Files.module.css";

/** Under a message with files: "Supersedes N earlier versions" on the newest
 * version, "Outdated: view latest" on an older one. Nothing otherwise. */
export function VersionLabel({
  session,
  channelId,
  message,
  open,
}: ComposerAccessoryProps) {
  const hasFiles = !!message?.attachments.length;
  const state = useChannelVersions(
    hasFiles ? session : undefined,
    hasFiles ? channelId : undefined,
  );
  const versions = state.versions;
  const files = message && versions?.byMessage.get(message.id);
  const missing = hasFiles && state.status === "ready" && !files;
  useEffect(() => {
    // A message the last load did not see, such as one just sent.
    if (missing) versionStore(session).refresh(channelId);
  }, [missing, session, channelId]);
  if (!message || !versions || !files?.length) return null;
  const lines = files.flatMap((file) => {
    const latestKey = versions.latest.get(file.eventId) ?? file.eventId;
    const prefix =
      files.length > 1 && file.filename ? `${file.filename}: ` : "";
    if (latestKey !== file.eventId) {
      const latest = versions.byKey.get(latestKey);
      if (!latest) return [];
      return [
        <span key={file.eventId} className={styles.label}>
          {prefix}Outdated
          <Button
            size="caption"
            variant="link"
            onClick={() =>
              open(messageLink(channelId, latest.messageId, latest.rootId))
            }
          >
            View latest
          </Button>
        </span>,
      ];
    }
    const count = earlierVersions(versions, file.eventId);
    if (!count) return [];
    return [
      <span key={file.eventId} className={styles.label}>
        {prefix}Supersedes {count} earlier{" "}
        {count === 1 ? "version" : "versions"}
      </span>,
    ];
  });
  return lines.length ? <div className={styles.labels}>{lines}</div> : null;
}
