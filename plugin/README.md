# @gabriel-sisjr/react-native-background-location — Expo Config Plugin

Contributor-facing notes. End-user documentation lands in Phase 6 at
`website/docs/guides/expo-config-plugin.md` — that guide does not exist yet.

## Status

Phase 1 scaffolding only. `withBackgroundLocation` is a no-op stub. Phases 2-4
will add the real `withAndroidManifest` / `withInfoPlist` / options-validation
modifiers; see `docs/plans/C2-expo-config-plugin.md` for the phased plan.

## Layout

| Path                   | Role                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| `app.plugin.js`        | Repo-root entry shim; `require()`s `./plugin/build`.                |
| `plugin/src/`          | TypeScript sources. Not published to npm.                           |
| `plugin/build/`        | Compiled JS + `.d.ts` consumed by `app.plugin.js`. Published.       |
| `plugin/tsconfig.json` | Standalone Node-target tsconfig. Does not extend the root tsconfig. |

## Scripts

- `yarn build:plugin` — one-shot compile of `plugin/src` into `plugin/build`.
- `yarn watch:plugin` — incremental rebuild during plugin development.

## Further reading

- `docs/plans/C2-expo-config-plugin.md` — full phased implementation plan.
- `website/docs/guides/expo-config-plugin.md` — user guide (coming in Phase 6).
