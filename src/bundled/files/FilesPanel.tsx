import { type ReactNode, useState } from "react";
import { useChannelIdentityNames } from "../../features/identity-names/react";
import type { FileVersionChain } from "../../features/fork/file-versions/chains.mjs";
import { useChannelVersions } from "../../features/fork/file-versions/store";
import type { VersionFile } from "../../features/fork/file-versions/types";
import type { RelaySession } from "../../features/relay/session";
import { Button } from "../../shared/design-system/ui/Button";
import { messageLink } from "./links";
import styles from "./Files.module.css";

const day = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** One row per file chain in the channel, newest first. A row goes to the
 * message that shared that version. */
export function FilesPanel({
  session,
  channelId,
  openLink,
}: {
  session: RelaySession;
  channelId: string;
  openLink(url: string): boolean;
}) {
  const state = useChannelVersions(session, channelId, true);
  const name = useChannelIdentityNames(session, channelId);
  if (!state.versions)
    return (
      <div className={styles.panel}>
        <p role="status" className={styles.meta}>
          {state.status === "error"
            ? (state.error ?? "Files could not be loaded.")
            : "Loading files…"}
        </p>
      </div>
    );
  const { chains } = state.versions;
  const row = (file: VersionFile) => (
    <div>
      <Button
        size="text"
        variant="link"
        onClick={() =>
          openLink(messageLink(channelId, file.messageId, file.rootId))
        }
      >
        {file.filename ?? file.url ?? "File"}
      </Button>
      <div className={styles.meta}>
        {name(file.uploadedBy, "Someone")} · {day(file.uploadedAt)}
        {file.kind === "link" ? " · Link" : ""}
      </div>
    </div>
  );
  return (
    <div className={styles.panel}>
      {chains.length ? (
        <ul className={styles.list} aria-label="Files">
          {chains.map((chain) => (
            <Chain key={chain.latest.eventId} chain={chain} row={row} />
          ))}
        </ul>
      ) : (
        <p className={styles.meta}>No files or links have been shared here.</p>
      )}
    </div>
  );
}

function Chain({
  chain,
  row,
}: {
  chain: FileVersionChain;
  row(file: VersionFile): ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const count = chain.older.length;
  return (
    <li>
      {row(chain.latest)}
      {count > 0 && (
        <>
          <Button
            size="caption"
            variant="link"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "Hide" : "Show"} {count} earlier{" "}
            {count === 1 ? "version" : "versions"}
          </Button>
          {open && (
            <ul className={styles.older}>
              {chain.older.map((file) => (
                <li key={file.eventId}>{row(file)}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}
