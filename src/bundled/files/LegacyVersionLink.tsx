import type { ChannelMessage } from "../../features/relay/contracts";
import styles from "./Files.module.css";

/** Builds before 0.5.14-1 linked versions after the fact with an empty
 * message. Nothing else sends a message with no text and no files. */
export function isLegacyVersionLink(message: ChannelMessage) {
  return (
    !message.content.trim() &&
    !message.attachments.length &&
    !message.forward &&
    !message.membership &&
    !message.huddle &&
    !message.diff
  );
}

export function LegacyVersionLink() {
  return (
    <span className={styles.legacy}>Linked two file versions (older Buzz)</span>
  );
}
