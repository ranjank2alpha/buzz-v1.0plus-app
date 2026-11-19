import { useEffect, useSyncExternalStore } from "react";
import type { EventData } from "../../relay/events";
import type { RelaySession } from "../../relay/session";
import {
  channelFiles,
  channelVersions,
  type ChannelVersions,
  VERSION_READ_KINDS,
} from "./files";

/** The relay caps one filter at this many events. */
const PAGE_SIZE = 500;
/** Bounds a malformed or endless history; 100,000 events. */
const MAX_PAGES = 200;
/** A reload asked for sooner than this after the last one waits for it. */
const REFRESH_GAP_MS = 3_000;

export type ChannelVersionState = Readonly<{
  status: "idle" | "loading" | "ready" | "error";
  versions?: ChannelVersions;
  error?: string;
}>;

type Reader = Pick<RelaySession, "readPage">;

type Entry = {
  state: ChannelVersionState;
  listeners: Set<() => void>;
  controller?: AbortController | undefined;
  loadedAt: number;
  again: boolean;
  timer?: ReturnType<typeof setTimeout> | undefined;
};

const IDLE: ChannelVersionState = Object.freeze({ status: "idle" });

/** Pages a channel's whole history, newest first. */
export async function readChannelHistory(
  session: Reader,
  channelId: string,
  signal: AbortSignal,
) {
  const events = new Map<string, EventData>();
  let until: number | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { events: batch, relayCount } = await session.readPage(
      [
        {
          kinds: VERSION_READ_KINDS,
          "#h": [channelId],
          limit: PAGE_SIZE,
          ...(until === undefined ? {} : { until }),
        },
      ],
      { signal },
    );
    let added = 0;
    let oldest = Number.POSITIVE_INFINITY;
    for (const event of batch) {
      oldest = Math.min(oldest, event.created_at);
      if (events.has(event.id)) continue;
      events.set(event.id, event);
      added += 1;
    }
    if (relayCount < PAGE_SIZE || !batch.length) break;
    // `until` is inclusive. A page that adds nothing means more than a page
    // of events share one second; step past it.
    until = added ? oldest : (until ?? oldest) - 1;
  }
  return [...events.values()];
}

/** One per session: the channel file lists the composer picker, the version
 * label and the Files panel share. Each channel loads on first demand. */
export function createVersionStore(session: Reader) {
  const entries = new Map<string, Entry>();
  const entry = (channelId: string) => {
    let value = entries.get(channelId);
    if (!value) {
      value = { state: IDLE, listeners: new Set(), loadedAt: 0, again: false };
      entries.set(channelId, value);
    }
    return value;
  };
  const set = (value: Entry, state: ChannelVersionState) => {
    value.state = Object.freeze(state);
    for (const listener of value.listeners) listener();
  };
  async function load(channelId: string) {
    const value = entry(channelId);
    if (value.controller) {
      value.again = true;
      return;
    }
    const controller = new AbortController();
    value.controller = controller;
    value.again = false;
    set(value, {
      ...value.state,
      status: value.state.versions ? "ready" : "loading",
    });
    try {
      const events = await readChannelHistory(
        session,
        channelId,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      set(value, {
        status: "ready",
        versions: channelVersions(channelFiles(channelId, events)),
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      set(value, {
        ...value.state,
        status: value.state.versions ? "ready" : "error",
        error:
          error instanceof Error ? error.message : "Files could not be loaded.",
      });
    } finally {
      if (value.controller === controller) value.controller = undefined;
      value.loadedAt = Date.now();
      if (value.again && !controller.signal.aborted) refresh(channelId);
    }
  }
  function refresh(channelId: string) {
    const value = entry(channelId);
    if (value.timer) return;
    const wait = value.loadedAt + REFRESH_GAP_MS - Date.now();
    if (wait <= 0 || value.state.status === "idle") void load(channelId);
    else
      value.timer = setTimeout(() => {
        value.timer = undefined;
        void load(channelId);
      }, wait);
  }
  return {
    snapshot: (channelId: string) => entries.get(channelId)?.state ?? IDLE,
    subscribe(channelId: string, listener: () => void) {
      const value = entry(channelId);
      value.listeners.add(listener);
      return () => {
        value.listeners.delete(listener);
      };
    },
    /** Loads the channel once; later calls reuse the result. */
    ensure(channelId: string) {
      if (entry(channelId).state.status === "idle") void load(channelId);
    },
    /** Reloads soon, for a message the last load did not see. */
    refresh,
    dispose() {
      for (const value of entries.values()) {
        value.controller?.abort();
        clearTimeout(value.timer);
      }
      entries.clear();
    },
  };
}
export type VersionStore = ReturnType<typeof createVersionStore>;

const stores = new WeakMap<object, VersionStore>();

export function versionStore(session: Reader) {
  let store = stores.get(session);
  if (!store) {
    store = createVersionStore(session);
    stores.set(session, store);
  }
  return store;
}

/** The channel's versions, loading them on first use. `fresh` reloads a
 * channel loaded earlier, for a view that must see the latest messages. */
export function useChannelVersions(
  session: Reader | undefined,
  channelId: string | undefined,
  fresh = false,
): ChannelVersionState {
  const store = session ? versionStore(session) : undefined;
  const state = useSyncExternalStore(
    (listener) =>
      store && channelId ? store.subscribe(channelId, listener) : () => {},
    () => (store && channelId ? store.snapshot(channelId) : IDLE),
  );
  useEffect(() => {
    if (!store || !channelId) return;
    if (fresh && store.snapshot(channelId).status !== "idle")
      store.refresh(channelId);
    else store.ensure(channelId);
  }, [store, channelId, fresh]);
  return state;
}
