# codeoid-mobile

Native **iOS + Android** (and web, via React Native Web) client for the [Codeoid](https://github.com/saucam/codeoid) daemon — a self-hosted, identity-native control plane for AI coding agents.

> **Status: early scaffold / design phase — not yet functional.** This repo currently holds the design and project skeleton; the app is built in phases per [`docs/mobile-app-design.md`](docs/mobile-app-design.md).

## What it is

Codeoid runs as a daemon on your own machine; its clients are pure renderers that attach to it. This is the third first-class client (alongside the Solid web UI in the daemon repo and the Rust TUI in [`codeoid-ui`](https://github.com/saucam/codeoid-ui)) — built for the phone, and designed to become the home of the **conductor** (supervise a fleet of agents by voice, from your pocket).

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

This is a scaffold — dependencies are pinned to the SDK 57 family but not yet installed/validated. When building begins:

```bash
npm install
npx expo install --fix   # reconcile RN / react / expo-* versions to the SDK
npx expo start           # then press i / a / w
```

## Related repos

- [`saucam/codeoid`](https://github.com/saucam/codeoid) — the daemon + CLI + Solid web UI (the source of `@codeoid/protocol` / `@codeoid/core`)
- [`saucam/codeoid-ui`](https://github.com/saucam/codeoid-ui) — the Rust (Ratatui) terminal client

## License

[Apache-2.0](LICENSE).
