import type { RelaySession } from "../relay/session";
import type { MessageAttention } from "../relay/unread";

/**
 * Whether an `@here` message should alert the viewer now. `@here` reaches
 * members who are online when it arrives; it never overrides a mute and is
 * never a mention. The notification path already drops messages older than
 * two minutes, which keeps it live-only.
 */
export function hereAlert(
  attention: MessageAttention,
  session: Pick<RelaySession, "sidebarPreferences" | "presence">,
  viewer: string,
  channelId: string,
  notifyWhileViewing: boolean,
): boolean | "wait" {
  if (attention.status === "unknown") return "wait";
  if (!attention.here) return false;
  const preferences = session.sidebarPreferences.snapshot();
  if (!preferences.cached && preferences.data?.muted.includes(channelId))
    return false;
  if (preferences.status !== "ready" && preferences.status !== "unsupported")
    return "wait";
  const presence = session.presence.status(viewer);
  if (presence === "away" || presence === "offline") return false;
  if (!notifyWhileViewing && attention.viewing) return false;
  return attention.unread || (notifyWhileViewing && attention.viewing);
}
