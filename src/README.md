# src/

Client code. The wire contract and framework-agnostic client logic come from the
published **`@codeoid/protocol`** + **`@codeoid/core`** packages (extracted from the
Codeoid daemon repo — see [`../docs/mobile-app-design.md`](../docs/mobile-app-design.md) §4).
This app rebuilds only the React Native view layer + platform glue.

Planned layout (added as build phases land):

| Dir | Contents |
| --- | --- |
| `protocol/` | thin re-exports / adapters over `@codeoid/protocol` |
| `core/` | state bindings over the `@codeoid/core` reducers (upsert-by-messageId, delta patch, scrollback) |
| `lib/` | keychain token storage (`expo-secure-store`), `AppState`/`NetInfo` reconnect, the `SpeechProvider` local-voice interface |
| `components/` | transcript (FlashList v2 + streaming markdown), approval bar, session list, composer |

Routes live in [`../app/`](../app/) (expo-router).
