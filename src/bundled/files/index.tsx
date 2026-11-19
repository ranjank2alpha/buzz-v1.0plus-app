import type { Context } from "@deepseek-ai/cordis";
import { useSyncExternalStore } from "react";
import type { PanelProps } from "../../features/panels/service";
import { usePanelTabTitle } from "../../features/panels/PanelWorkspace";
import type { ChannelSummary } from "../../features/relay/contracts";
import type { RelaySession } from "../../features/relay/session";
import { buzzLinkTarget } from "../../features/navigation/buzz-links";
import { PaperclipIcon } from "../../shared/design-system/icons";
import { FilesPanel } from "./FilesPanel";
import { LegacyVersionLink, isLegacyVersionLink } from "./LegacyVersionLink";
import { VersionLabel } from "./VersionLabel";

export const inject = ["panels", "conversation", "relay", "navigation"];

function eligible(channel: ChannelSummary, session: RelaySession) {
  return !channel.cached && !!channel.members?.includes(session.viewer ?? "");
}

const tabIcon = <PaperclipIcon size="1rem" />;

export function apply(ctx: Context) {
  ctx.conversation.registerAccessory({
    id: "file-versions",
    title: "File versions",
    placement: "message",
    component: VersionLabel,
  });
  ctx.conversation.registerMessage({
    id: "legacy-version-link",
    title: "Version link",
    matches: isLegacyVersionLink,
    component: LegacyVersionLink,
  });
  function Panel({ channelContext }: PanelProps) {
    usePanelTabTitle("Files", tabIcon);
    const state = useSyncExternalStore(ctx.relay.subscribe, ctx.relay.snapshot);
    if (
      !channelContext ||
      state.status !== "ready" ||
      state.scope !== channelContext.scope
    )
      return (
        <p role="status">
          Files are unavailable while the connection recovers.
        </p>
      );
    const { origin, viewer } = state;
    const openLink = (url: string) => {
      const target =
        origin &&
        viewer &&
        buzzLinkTarget(url, { viewer, communityOrigin: origin });
      if (!target) return false;
      void ctx.navigation.open(target);
      return true;
    };
    return (
      <FilesPanel
        key={`${state.scope}:${state.generation}:${channelContext.channelId}`}
        session={state.session}
        channelId={channelContext.channelId}
        openLink={openLink}
      />
    );
  }
  ctx.panels.register({
    id: "files",
    title: "Files",
    matches: () => false,
    channelMenu: { label: "View files", eligible },
    component: Panel,
  });
}
