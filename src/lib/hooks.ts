/**
 * React bindings over the framework-agnostic @codeoid/core primitives.
 * The store/client own the state; these hooks only subscribe and re-render.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ClientStatus } from "@codeoid/core";
import type {
  SessionInfo,
  SessionListResultMsg,
  SessionMessage,
} from "@codeoid/protocol";

import type { Connection } from "./connection";

/** Live transport status (idle / connecting / connected / reconnecting / failed). */
export function useConnectionStatus(conn: Connection): ClientStatus {
  return useSyncExternalStore(
    useCallback((onChange: () => void) => conn.client.onStatus(onChange), [conn]),
    () => conn.client.status,
  );
}

/**
 * The daemon's session list. Fetched on every `connected` transition (initial
 * connect and reconnects), then kept live from `session.status_change` /
 * `session.info_update` broadcasts. `refresh()` re-pulls on demand.
 */
export function useSessions(conn: Connection): {
  sessions: SessionInfo[] | null;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (conn.client.status.kind !== "connected") return;
    const id = conn.client.nextId();
    try {
      const result = await conn.client.request<SessionListResultMsg>(
        { type: "session.list", id },
        {
          waitForResult: (m) =>
            m.type === "session.list.result" && m.requestId === id ? m : undefined,
        },
      );
      setSessions(result.sessions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [conn]);

  // Re-pull on every `connected` transition (initial connect + reconnects).
  // onStatus fires the handler immediately on subscribe, covering the case
  // where the client connected before this hook mounted.
  useEffect(() => {
    let last: string | null = null;
    return conn.client.onStatus((s) => {
      if (s.kind === "connected" && last !== "connected") void refresh();
      last = s.kind;
    });
  }, [conn, refresh]);

  useEffect(
    () =>
      conn.client.onMessage((msg) => {
        if (msg.type === "session.status_change") {
          setSessions((prev) =>
            prev
              ? prev.map((s) => (s.id === msg.sessionId ? { ...s, status: msg.status } : s))
              : prev,
          );
        } else if (msg.type === "session.info_update") {
          setSessions((prev) => {
            if (!prev) return prev;
            const known = prev.some((s) => s.id === msg.session.id);
            return known
              ? prev.map((s) => (s.id === msg.session.id ? msg.session : s))
              : [...prev, msg.session];
          });
        }
      }),
    [conn],
  );

  return { sessions, error, refresh };
}

/**
 * A session's transcript, re-read on every store epoch bump (message upsert,
 * streaming delta, replay). Returns a fresh array per epoch so list views
 * see a new identity and re-render.
 */
export function useTranscript(conn: Connection, sessionId: string): SessionMessage[] {
  const epoch = useSyncExternalStore(
    useCallback(
      (onChange: () => void) =>
        conn.store.onChange((sid) => {
          if (sid === sessionId) onChange();
        }),
      [conn, sessionId],
    ),
    () => conn.store.epochOf(sessionId),
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- epoch is the change signal for the store's live array
  return useMemo(() => [...conn.store.messagesFor(sessionId)], [conn, sessionId, epoch]);
}
