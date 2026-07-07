/**
 * Daemon discovery + ZeroID API-key auth (design doc §5).
 *
 * React Native port of the daemon web UI's `lib/auth.ts` resolve flow:
 *
 *   1. `GET /health` + `GET /config` on the daemon origin — reachability,
 *      version, and the daemon's configured ZeroID URL.
 *   2. POST `grant_type=api_key` (a `zid_sk_…` key) to the daemon's
 *      same-origin `/oauth2/token` proxy → short-lived JWT.
 *   3. The durable credential (daemon URL + API key) lives in the device
 *      Keychain/Keystore via expo-secure-store; the JWT itself is held only
 *      in memory and re-minted on every reconnect.
 *
 * Google OAuth (design doc P3) is gated on codeoid #42 — P1 is API-key only.
 */
import * as SecureStore from "expo-secure-store";

const KEY_DAEMON_URL = "codeoid.daemonUrl";
const KEY_API_KEY = "codeoid.apiKey";

/**
 * Scopes requested on every api_key → JWT exchange. ZeroID propagates these
 * into the JWT's `scopes` claim, which the daemon enforces per protocol verb —
 * omitting them yields a scope-less JWT where every verb is denied. Mirrors
 * the web UI's operator set minus the conductor scopes (P5).
 */
export const DEFAULT_MOBILE_SCOPES = [
  "session:list",
  "session:create",
  "session:attach",
  "session:watch",
  "session:send",
  "session:interrupt",
  "session:approve",
  "session:destroy",
  "fs:read",
].join(" ");

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly kind: "invalid" | "unreachable" | "exchange_failed",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Normalize user input to a bare origin: scheme + host[:port], no path. */
export function normalizeDaemonUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new AuthError("enter a daemon URL", "invalid");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new AuthError(`"${trimmed}" is not a valid URL`, "invalid");
  }
  return `${url.protocol}//${url.host}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    throw new AuthError(`cannot reach ${url}`, "unreachable", err);
  } finally {
    clearTimeout(timer);
  }
}

export interface DaemonInfo {
  /** Normalized daemon origin. */
  daemonUrl: string;
  /** Daemon version from /health, when reported. */
  version: string | null;
  /** ZeroID base URL from /config (informational — the exchange goes through
   * the daemon's same-origin proxy, so mobile never hits ZeroID directly). */
  zeroidUrl: string | null;
}

/** Probe a daemon origin: /health must answer; /config is best-effort. */
export async function discoverDaemon(rawUrl: string, timeoutMs = 8_000): Promise<DaemonInfo> {
  const daemonUrl = normalizeDaemonUrl(rawUrl);

  const health = await fetchWithTimeout(`${daemonUrl}/health`, {}, timeoutMs);
  if (!health.ok) {
    throw new AuthError(
      `daemon /health answered ${health.status} — is this a codeoid daemon?`,
      "unreachable",
    );
  }
  const healthBody = (await health.json().catch(() => ({}))) as { version?: unknown };

  let zeroidUrl: string | null = null;
  try {
    const config = await fetchWithTimeout(`${daemonUrl}/config`, {}, timeoutMs);
    if (config.ok) {
      const body = (await config.json()) as { zeroid_url?: unknown };
      if (typeof body.zeroid_url === "string") zeroidUrl = body.zeroid_url;
    }
  } catch {
    // /config is optional — the token proxy is same-origin regardless.
  }

  return {
    daemonUrl,
    version: typeof healthBody.version === "string" ? healthBody.version : null,
    zeroidUrl,
  };
}

/**
 * Exchange a ZeroID API key for a short-lived JWT via the daemon's
 * same-origin `/oauth2/token` proxy. Called on sign-in and again on every
 * reconnect (`CodeoidClient.getToken`) so an expired JWT never wedges the
 * socket.
 */
export async function exchangeApiKey(
  daemonUrl: string,
  apiKey: string,
  scope: string = DEFAULT_MOBILE_SCOPES,
  timeoutMs = 15_000,
): Promise<string> {
  const key = apiKey.trim();
  if (!key.startsWith("zid_sk_")) {
    throw new AuthError(
      `api key must start with "zid_sk_" — got "${key.slice(0, 8)}…"`,
      "invalid",
    );
  }

  const res = await fetchWithTimeout(
    `${daemonUrl}/oauth2/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "api_key", api_key: key, scope }).toString(),
    },
    timeoutMs,
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AuthError(
      `ZeroID rejected the API key (${res.status}): ${body.slice(0, 200) || res.statusText}`,
      "exchange_failed",
    );
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err) {
    throw new AuthError("token endpoint returned non-JSON", "exchange_failed", err);
  }
  const token = (payload as { access_token?: unknown }).access_token;
  if (typeof token !== "string" || token.length === 0) {
    throw new AuthError("token response missing access_token", "exchange_failed");
  }
  return token;
}

// ── Credential persistence (Keychain / Keystore) ────────────────────────────

export interface StoredCredentials {
  daemonUrl: string;
  apiKey: string;
}

export async function saveCredentials(creds: StoredCredentials): Promise<void> {
  await SecureStore.setItemAsync(KEY_DAEMON_URL, creds.daemonUrl);
  await SecureStore.setItemAsync(KEY_API_KEY, creds.apiKey);
}

export async function loadCredentials(): Promise<StoredCredentials | null> {
  const [daemonUrl, apiKey] = await Promise.all([
    SecureStore.getItemAsync(KEY_DAEMON_URL),
    SecureStore.getItemAsync(KEY_API_KEY),
  ]);
  if (!daemonUrl || !apiKey) return null;
  return { daemonUrl, apiKey };
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_DAEMON_URL);
  await SecureStore.deleteItemAsync(KEY_API_KEY);
}
