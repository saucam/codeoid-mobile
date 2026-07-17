# Contributing to codeoid-mobile

codeoid-mobile is the native iOS + Android (and React-Native-Web) client for the [Codeoid](https://github.com/highflame-ai/codeoid) daemon.
Clients are pure renderers — the daemon owns all state — so most product logic lives in the daemon repo; this repo is the phone rendering surface.

## Related repos

- [`highflame-ai/codeoid`](https://github.com/highflame-ai/codeoid) — the daemon + CLI + Solid web UI (source of `@codeoid/protocol` / `@codeoid/core`)
- [`highflame-ai/codeoid-ui`](https://github.com/highflame-ai/codeoid-ui) — the Rust (Ratatui) terminal client

## Signing off your work (DCO)

This project uses the [Developer Certificate of Origin](https://developercertificate.org/) (DCO) rather than a CLA — a lightweight, per-commit attestation that you wrote, or otherwise have the right to submit, the code you contribute.

Sign off every commit:

```bash
git commit -s -m "your message"
```

That appends a trailer derived from your Git identity:

```
Signed-off-by: Your Name <you@example.com>
```

By signing off you agree to the DCO (full text at <https://developercertificate.org/>). If a commit is missing the trailer, amend it with `git commit --amend -s` (or `git rebase --signoff` for a range) before pushing.
