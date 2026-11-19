/** The deep link that opens one message, in its thread when it is a reply. */
export function messageLink(
  channelId: string,
  messageId: string,
  rootId?: string | null,
) {
  return `buzz://message?${new URLSearchParams({
    channel: channelId,
    id: messageId,
    ...(rootId ? { thread: rootId } : {}),
  })}`;
}
