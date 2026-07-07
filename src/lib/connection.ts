/**
 * The app-wide daemon connection singleton (design doc §4).
 *
 * One `CodeoidClient` (reconnecting WS transport) + one `MessageStore`
 * (transcript accumulation) + one `ResumeCursors` (incremental re-attach)
 * per daemon connection. Every daemon broadcast is routed through
 * `store.ingest()` regardless of which screen is mounted, so transcripts
 * keep accumulating while the user is on the session list.
 *
 * Native resume wiring: the core client's focus/online listeners are
 * browser-only, so React Native `AppState` (foreground) and NetInfo
 * (connectivity regained) call `reconnectNow()` instead. A zombie socket
 * that survived suspension without a close event is caught by the client's
 * own liveness heartbeat within one cadence (~20s).
 */
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";
import { CodeoidClient, MessageStore, ResumeCursors } from "@codeoid/core";
import { CAPABILITIES } from "@codeoid/protocol";

import { exchangeApiKey } from "./auth";

export const CLIENT_NAME = "codeoid-mobile/0.0.1";

export interface Connection {
  daemonUrl: string;
  client: CodeoidClient;
  store: MessageStore;
  cursors: ResumeCursors;
}

let current: Connection | null = null;
let teardown: (() => void) | null = null;

function wsUrlFor(daemonUrl: string): string {
  // http(s) origin → ws(s) endpoint at the origin root.
  return daemonUrl.replace(/^http/i, "ws");
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Open (replacing any previous) connection: exchange the API key for a JWT,
 * connect the WS, and wire native resume signals. Resolves once `auth.ok`
 * lands; a connect that can't complete within `connectTimeoutMs` tears the
 * client down and rejects so the sign-in screen can surface the failure.
 */
export async function openConnection(opts: {
  daemonUrl: string;
  apiKey: string;
  connectTimeoutMs?: number;
}): Promise<Connection> {
  closeConnection();

  const token = await exchangeApiKey(opts.daemonUrl, opts.apiKey);
  const client = new CodeoidClient({
    url: wsUrlFor(opts.daemonUrl),
    token,
    // Re-exchange on every reconnect — JWTs are short-lived and the daemon
    // closes 4003 on an expired token.
    getToken: () => exchangeApiKey(opts.daemonUrl, opts.apiKey),
    capabilities: [
      CAPABILITIES.PARTS,
      CAPABILITIES.CHUNKED_REPLAY,
      CAPABILITIES.SEQ_RESUME,
      CAPABILITIES.SEND_IDEMPOTENCY,
    ],
    clientName: CLIENT_NAME,
  });

  const store = new MessageStore();
  const cursors = new ResumeCursors();
  client.onMessage((msg) => {
    store.ingest(msg, cursors);
  });

  const appStateSub = AppState.addEventListener("change", (state) => {
    if (state === "active") client.reconnectNow();
  });
  const netInfoUnsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) client.reconnectNow();
  });
  teardown = () => {
    appStateSub.remove();
    netInfoUnsub();
    client.shutdown();
  };
  current = { daemonUrl: opts.daemonUrl, client, store, cursors };

  try {
    await withTimeout(
      client.connect(),
      opts.connectTimeoutMs ?? 30_000,
      "daemon WebSocket connect timed out",
    );
  } catch (err) {
    closeConnection();
    throw err;
  }
  return current;
}

export function getConnection(): Connection | null {
  return current;
}

/** Shut down the transport and drop all connection state (sign-out). */
export function closeConnection(): void {
  teardown?.();
  teardown = null;
  current = null;
}

/**
 * Idempotency key for `session.send` (`send.idempotency` capability) —
 * minted ONCE per user action so a retry after ambiguous delivery can't
 * turn one prompt into two billed turns.
 */
export function mintClientMsgId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
