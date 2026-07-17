# codeoid-mobile

Native **iOS + Android** (and web, via React Native Web) client for the [Codeoid](https://github.com/highflame-ai/codeoid) daemon — a self-hosted, identity-native control plane for AI coding agents.

> **Status: P1 — connect, auth, attach.** Daemon-URL entry → ZeroID API-key sign-in → live session list → streaming transcript (plain-text rows). Built in phases per [`docs/mobile-app-design.md`](docs/mobile-app-design.md) §10; next up: rich transcript + approvals + push (P2).

## What it is

Codeoid runs as a daemon on your own machine; its clients are pure renderers that attach to it. This is the third first-class client (alongside the Solid web UI in the daemon repo and the Rust TUI in [`codeoid-ui`](https://github.com/highflame-ai/codeoid-ui)) — built for the phone, and designed to become the home of the **conductor** (supervise a fleet of agents by voice, from your pocket).

What sets it apart from other "control your coding agent from your phone" apps:

- **Identity-native** — every message carries a ZeroID/WIMSE identity + delegation chain; the app surfaces *who/which agent* did *what*, with provenance.
- **Local-first voice** — on-device speech (no audio shipped to the cloud), the same guarantee across web and mobile.
- **Self-hosted-first** — you connect straight to *your* daemon URL; a relay is used only for push notifications.
- **Conductor-ready** — the IA is built so a single assistant session can orchestrate the fleet as that capability lands.

## Stack

- **Expo (SDK 57) + React Native 0.86** (New Architecture) + **TypeScript**.
- Consumes the framework-agnostic wire contract + client logic from `@codeoid/protocol` and `@codeoid/core` (extracted from the daemon repo — see design doc §4).
- One codebase targets iOS, Android, and web.

## Getting started

```bash
npm install
npx expo start           # then press i / a / w
```

On the connect screen, enter your daemon URL (e.g. `http://192.168.1.x:7400`) and a
ZeroID API key (`zid_sk_…`). The key is stored in the device Keychain/Keystore and
exchanged for a short-lived JWT via the daemon's same-origin `/oauth2/token` proxy;
the JWT is re-minted on every reconnect. Google OAuth sign-in lands in P3.

Note: `metro.config.js` carries a resolver fallback because `@codeoid/protocol` /
`@codeoid/core` ship raw TypeScript source with TS-ESM style `.js` relative imports,
which Metro does not redirect to `.ts` inside `node_modules` on its own.

## Related repos

- [`highflame-ai/codeoid`](https://github.com/highflame-ai/codeoid) — the daemon + CLI + Solid web UI (the source of `@codeoid/protocol` / `@codeoid/core`)
- [`highflame-ai/codeoid-ui`](https://github.com/highflame-ai/codeoid-ui) — the Rust (Ratatui) terminal client

## License

[Apache-2.0](LICENSE).
