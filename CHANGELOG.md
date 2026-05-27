# Changelog

## [1.0.0-rc] - 2026-05-27

> **First release candidate for the 1.x line.** From `1.0.0` forward, the library follows strict semver: breaking changes ship only on a major version bump. Three surfaces are explicitly frozen for the 1.x line: (1) the public TypeScript surface (named exports from `src/index.tsx`), (2) the TurboModule Codegen spec (`src/NativeBackgroundLocation.ts`), and (3) the native event names emitted via `NativeEventEmitter` (`onLocationUpdate`, `onLocationError`, `onLocationWarning`, `onNotificationAction`, `onGeofenceTransition`). No native (Android/iOS) code changes and no public TypeScript API changes since `0.17.0` this release candidate exists to declare API stability, not to introduce behavior.

### Changed

- README rewritten for the 1.0 launch: leaner top-level navigation, clearer install/setup path, and consolidated examples. No content was removed in a way that affects behavior; the deep-dive material remains addressable via [documentation](https://gabriel-sisjr.github.io/react-native-background-location) referenced from the README.
- `package.json` version bumped from `0.17.0` to `1.0.0-rc`. No dependency, peer-dependency, or build-config changes.

### Notes

- **No public API or native behavior changed since `0.17.0`.** This RC is a stability declaration only -- consumers on `0.17.0` can upgrade with zero code changes.
- For migration context from earlier pre-1.0 versions, see the breaking-change history already documented in this file: `0.17.0` (iOS default `LocationActivityType` changed from `.automotiveNavigation` to `.other`; auto-resume in `didPauseLocationUpdates`), `0.14.0` (default export removed from `src/index.tsx`; named exports only), and `0.12.0` (`PermissionState` restructured to the granular shape; flat `notification*` fields on `TrackingOptions` consolidated into `notificationOptions`).
- The 1.x line will continue to maintain backward compatibility within the major; any breaking change requires a `2.0.0` bump.

## [0.17.0] - 2026-05-24

> ⚠️ **Behavioral change (iOS default activity type):** apps relying on the previous `.automotiveNavigation` default may observe pause/auto-resume timing differences. See the [Migrating from v0.16.0 to v0.17.0](README.md#migrating-from-v0160-to-v0170) section in the README. No API or type changes.

### Added

- **`LocationActivityType` enum** exposed on the public API with five values: `OTHER`, `AUTOMOTIVE_NAVIGATION`, `FITNESS`, `OTHER_NAVIGATION`, `AIRBORNE`. Maps to iOS `CLLocationManager.activityType`. Has no effect on Android — the option crosses the bridge as a string and is silently ignored by the Android native layer.
- **`TrackingOptions.activityType`** optional field that controls iOS motion classification. Defaults to `LocationActivityType.OTHER`.
- **iOS auto-resume on `didPauseLocationUpdates`** — when the system pauses location updates during an active trip (non-`foregroundOnly`), the library now immediately resumes them while still emitting the existing `LOCATION_UPDATES_PAUSED` warning for observability.
- Example app: new activity-type chip selector reusing the existing preset UX (no new dependencies).
- `ios/LocationActivityType.swift` — new mapping helper between the wire-string enum values and `CLActivityType`. Unknown strings funnel through `guardLogger` and fall back to `.other`.

### Changed

- **Default iOS activity type changed from `.automotiveNavigation` to `.other`.** This fixes [#44](https://github.com/gabriel-sisjr/react-native-background-location/issues/44), where iOS would stop emitting location updates 2–3 minutes after the device became stationary because `.automotiveNavigation` made the motion classifier aggressively pause the stream once the user appeared to stop driving. Consumers building turn-by-turn navigation apps should opt back in explicitly with `{ activityType: LocationActivityType.AUTOMOTIVE_NAVIGATION }`.
- `TrackingOptions.updateInterval`, `fastestInterval`, `maxWaitTime`, and `waitForAccurateLocation` are now annotated `@platform Android` in JSDoc. Their iOS behavior is unchanged (still accepted by the bridge, still ignored at the native layer — iOS does not expose comparable knobs and uses `distanceFilter` + `accuracy` only).
- Internal: `src/hooks/useBackgroundLocation.ts` now consumes the canonical `toTrackingOptionsSpec` mapper instead of duplicating the conversion inline. Prevents future option fields from silently being dropped by the hook entry point.

### Fixed

- **iOS:** background tracking no longer stops within 2–3 minutes of the device becoming stationary ([#44](https://github.com/gabriel-sisjr/react-native-background-location/issues/44)). Root cause was the hardcoded `.automotiveNavigation` activity type combined with no auto-resume on `didPauseLocationUpdates`. Both halves of the fix ship in this release: the default activity type is now `.other`, and any system-initiated pause is reversed immediately while the trip is still active.

### Notes

- **API-compatible release.** No public TypeScript types were removed and no method signatures changed. Existing call sites that omit `activityType` continue to compile and run, but the runtime default behavior changes from `.automotiveNavigation` to `.other` — see the migration note in `README.md`.
- The auto-resume in `didPauseLocationUpdates` cannot be disabled; the `LOCATION_UPDATES_PAUSED` warning event continues to be emitted for observability.

## [0.16.0] - 2026-05-17

### Added

- **iOS native nil-guard** (Workstream A — defense-in-depth complement to the v0.15.1 fix for issue [#39](https://github.com/gabriel-sisjr/react-native-background-location/issues/39)): `LocationManagerWrapper.swift` exposes a new `startTracking(tripId:rawOptions:)` entry point that funnels untrusted options through a guarded factory `TrackingOptions.from(rawOptions:methodName:)`. Degenerate input (nil, non-dictionary, missing keys, wrong-type values) is silently coerced to safe defaults. Emits one `[BackgroundLocation] <methodName> received <reason>; falling back to defaults` line via the internal `guardLogger` seam (`ios/GuardLogger.swift`). Never throws, never rejects the Promise, never emits a JS event.
- **`ios/GuardLogger.swift`** — internal logger seam (`internal var guardLogger: (String) -> Void`). Default is `NSLog`. Test seam for upcoming Workstream B XCTests.

### Changed

- **`ios/BackgroundLocation.mm`** is now a thin TurboModule pass-through (architectural option A4). All input-validation logic moved into Swift. Helper renamed `optionsDictionaryFrom:` → `transportDictFromCodegenSpec:` to reflect its transport-only role.

### Fixed

- **RR-DX-6** — Removed the phantom `<TestableReference>` block in `example/ios/BackgroundLocationExample.xcodeproj/xcshareddata/xcschemes/BackgroundLocationExample.xcscheme` that pointed to a non-existent `BackgroundLocationExampleTests` target. The scheme now passes `xmllint` and `xcodebuild -list`. (The real XCTest target lands with Workstream B.)

### Notes

- **No public API changes.** TypeScript exports from `src/index.tsx` and the TurboModule Codegen spec (`src/NativeBackgroundLocation.ts`) are byte-stable vs v0.15.1.
- **No Android changes.** The Android Kotlin module is unchanged from v0.15.1.
- The v0.15.1 TS-layer normalization (`src/utils/trackingOptionsMapper.ts`) is preserved as the first line of defense.
- Workstream B (XCTest target), Workstream C (CI matrix), Workstream D (CI quick-wins), and Workstream E (Jest hardening) are tracked separately and remain deferred.

## [0.15.1] - 2026-05-06

> **Hotfix** -- resolves a deterministic iOS crash on `startTracking()` when no `options` argument is provided ([#39](https://github.com/gabriel-sisjr/react-native-background-location/issues/39)). No behavior change for callers who already pass an options object. No native (Android/iOS) source change in this release; the fix is contained in the TypeScript bridge layer.

### Fixed

- **(iOS)** Deterministic `EXC_BAD_ACCESS (code=1, address=0x0)` crash when calling `startTracking()`, `startTracking('trip-id')`, or `startTracking('trip-id', undefined)` ([#39](https://github.com/gabriel-sisjr/react-native-background-location/issues/39)). Root cause: the TurboModule ObjC++ bridge declares `options` as a non-nullable C++ reference (`JS::NativeBackgroundLocation::TrackingOptionsSpec &options`). When the JS caller omits `options`, React Native's `RCTTurboModule.mm` skipped the `RCTCxxConvert` step and passed `nil` directly into the `NSInvocation` slot, leaving the ObjC++ method with a reference whose `this == NULL`. The first method invocation on that reference (`options.accuracy()`) dereferenced `0x0` at `BackgroundLocationSpec.h:155` and triggered a Mach-level signal that cannot be caught by `@try/@catch`. The TypeScript layer now normalizes `undefined`/`null` to `{}` before crossing the bridge, guaranteeing a non-nil `NSDictionary` reaches the ObjC++ entry point and the C++ struct is constructed via the standard `RCTCxxConvert` path. See `docs/analysis/issue-39-ios-crash.md` for the full empirical analysis.

### Changed

- `toTrackingOptionsSpec` (`@internal`, `src/utils/trackingOptionsMapper.ts`): return type tightened from `TrackingOptionsSpec | undefined` to non-optional `TrackingOptionsSpec`; input widened from `options?: TrackingOptions` to `options?: TrackingOptions | null` to also accept explicit `null`. When the input is `null`/`undefined` (or the no-arg form), the helper now returns `{}` instead of `undefined`. **Non-breaking**: the only caller is `src/index.tsx` and the public `startTracking` signature is unchanged.

### Internal

- `src/__tests__/utils/trackingOptionsMapper.test.ts` -- 9 new unit tests covering the issue-#39 contract: `undefined` input returns `{}`, `null` input returns `{}`, no-arg invocation returns `{}`, empty `{}` input still returns `{}` (backward compat), fully populated options round-trip correctly, `LocationAccuracy` enum-to-string conversion, `notificationOptions` JSON-stringification, `notificationOptions` left undefined when omitted, and `distanceFilter: 0` preserved (truthiness-trap guard).
- `src/__tests__/index.test.ts` -- 4 pre-existing assertions updated from `undefined` to `{}` for the second argument passed to `BackgroundLocationModule.startTracking`. Total suite: 482/482 passing across 16 suites.

Thanks to [@qb1ty](https://github.com/qb1ty) for the detailed reproduction snippet and for empirically validating the `startTracking({})` workaround on the affected toolchain.

## [0.15.0] - 2026-04-27

> **Non-breaking change** -- the `requestPermissions` closure returned by `useLocationPermissions` now accepts an optional `RequestPermissionsOptions` argument. Existing zero-arg callers continue to work unchanged.

### Added

- `PermissionRationale` public type -- localized strings (`title`, `message`, `buttonPositive`, `buttonNegative`, `buttonNeutral`) for an Android system permission dialog. Reusable shape designed to be shared by future sibling fields (`foregroundRationale`, `notificationRationale`).
- `RequestPermissionsOptions` public type -- options envelope accepted by `requestPermissions`, currently exposing the optional `backgroundRationale` field.
- `backgroundRationale` parameter on `useLocationPermissions().requestPermissions()` -- threads localized copy into the Android background-location system dialog (`PermissionsAndroid.request(ACCESS_BACKGROUND_LOCATION, ...)`, API 29+). Silently ignored on iOS, on Android < 29, on the foreground-only flow (`requestMultiple`), and on the `POST_NOTIFICATIONS` request.
- `src/utils/resolveRationale.ts` -- `@internal` resolver that merges a partial `PermissionRationale` over the library's English defaults on a per-field basis. Each field is read explicitly (no key iteration); empty strings, whitespace-only strings, `undefined`, and `null` all fall back to the default. Re-exported from `src/utils/index.ts` (the defaults constant and the resolved interface remain module-private).
- `BACKGROUND_RATIONALE_OPTIONS` showcase in `example/src/App.tsx` -- module-scoped `RequestPermissionsOptions` constant with Portuguese strings, wired into the "Grant Permissions" button to demonstrate the localized flow.
- 21 new tests covering the rationale flow: 9 unit tests for `resolveRationale` (MR-1..MR-9, including default fallback, full override, partial override, empty-string fallback, whitespace-only fallback, mixed inputs, and trim-then-truthy semantics) and 12 hook integration tests (RP-1..RP-12, including the zero-arg path, `undefined`/`{}`/`{ backgroundRationale: undefined }`/`{ backgroundRationale: {} }` defaults, full Portuguese override, partial override, empty/whitespace fallback, Android API < 29 skip path, foreground-denial skip path, and iOS skip path).

### Changed

- `useLocationPermissions().requestPermissions` signature widened from `() => Promise<boolean>` to `(options?: RequestPermissionsOptions) => Promise<boolean>`. **Non-breaking**: every existing zero-arg invocation type-checks and behaves identically. The hardcoded English literal block in `src/hooks/useLocationPermissions.ts` is now sourced from `resolveRationale(options?.backgroundRationale)`.
- `useGeofencePermissions` (alias of `useLocationPermissions` at `src/hooks/index.ts`) inherits the new option for free with no extra code.

## [0.14.0] - 2026-04-15

> **Breaking change** -- the public TypeScript API surface was cleaned up. The `BackgroundLocation` default export has been removed. No native (Android/iOS) behavior changed. Consumers must update their imports (see migration guide below and `BREAKING_CHANGES.md`).
>
> **Cross-project notice:** This library is consumed by **GereFrotaApp-Motoristas**. Bumping the library version there requires migrating all `import BackgroundLocation from ...` statements to named imports before the build will pass.

### BREAKING CHANGES

- **Removed default export** from `src/index.tsx`. The 6 tracking methods (`startTracking`, `stopTracking`, `isTracking`, `getLocations`, `clearTrip`, `updateNotification`) are now published exclusively as top-level named exports. Consumers using `import BackgroundLocation from '@gabriel-sisjr/react-native-background-location'` followed by `BackgroundLocation.<method>()` must migrate to `import { <method> } from '@gabriel-sisjr/react-native-background-location'`.

### Changed

- `src/index.tsx` is now a lean public-API facade that composes helpers from `src/utils/` and `src/errors/`. All `@internal` helpers have been extracted (see Added section).
- `example/src/App.tsx`, `src/__tests__/index.test.ts`, and `src/__tests__/integration/ios-tracking.test.ts` updated to use named imports.

### Added

- `src/utils/isNativeModuleAvailable.ts` -- `@internal` non-throwing probe for the TurboModule (returns `false` when running in a simulator without the module linked).
- `src/utils/trackingOptionsMapper.ts` -- `@internal` `toTrackingOptionsSpec()` helper that converts TypeScript enums to Codegen-compatible string values before crossing the TurboModule bridge. Previously inlined in `src/index.tsx`.
- `src/utils/geofenceValidation.ts` -- `@internal` `validateGeofenceRegion()` runtime validation (identifier, radius, coordinates, metadata shape).
- `src/utils/geofenceSerialization.ts` -- `@internal` `prepareGeofenceRegion()` and `serializeGeofenceRegion()` JSON serialization helpers (the TurboModule spec accepts strings because Codegen does not support typed object arrays).
- `src/utils/index.ts` -- barrel re-exporting all utils.
- `src/errors/GeofenceError.ts` -- `GeofenceError` class (moved from `src/index.tsx`). Still re-exported via `src/index.tsx` so `import { GeofenceError } from '@gabriel-sisjr/react-native-background-location'` continues to work.
- `src/errors/index.ts` -- barrel.

### Refactor

- Extracted all `@internal` helpers from `src/index.tsx` into `src/utils/`. `src/index.tsx` no longer contains inline enum-to-string conversion, module probing, geofence validation, or geofence serialization logic.
- Moved `GeofenceError` from `src/index.tsx` into a dedicated `src/errors/` folder. Public re-export preserved to avoid breaking type imports.
- Existing `src/utils/moduleCheck.ts` (`assertNativeModuleAvailable`) and `src/utils/objectUtils.ts` (`extractDefinedProperties`) are unchanged.

### Migration Guide

If upgrading from `0.13.x`:

```typescript
// Before (0.13.x and earlier)
import BackgroundLocation from '@gabriel-sisjr/react-native-background-location';

await BackgroundLocation.startTracking('trip-123');
await BackgroundLocation.updateNotification('Title', 'Text');
const status = await BackgroundLocation.isTracking();
const locations = await BackgroundLocation.getLocations('trip-123');
await BackgroundLocation.clearTrip('trip-123');
await BackgroundLocation.stopTracking();

// After (0.14.0)
import {
  startTracking,
  stopTracking,
  isTracking,
  getLocations,
  clearTrip,
  updateNotification,
} from '@gabriel-sisjr/react-native-background-location';

await startTracking('trip-123');
await updateNotification('Title', 'Text');
const status = await isTracking();
const locations = await getLocations('trip-123');
await clearTrip('trip-123');
await stopTracking();
```

No runtime behavior changed -- the method signatures and return types are identical. This is strictly an import-shape refactor. Run `yarn typecheck` after migration; any remaining default-import site will surface as a TypeScript error.

See `BREAKING_CHANGES.md` for the full migration guide including rationale and a find-and-replace recipe.

## [0.13.0] - 2026-03-30

> **Non-breaking change** -- the public TypeScript API is unchanged. This release is an internal Android refactor and bug fix only.

### Changed

- Migrated all Android event broadcasting from `LocalBroadcastManager` to Kotlin `SharedFlow` singletons. Location updates, geofence transitions, and notification actions now flow through type-safe `SharedFlow` channels instead of `Intent`-based broadcasts.
- `BackgroundLocationModule.kt` collects events from SharedFlow singletons via coroutine Jobs scoped to `moduleScope` (Dispatchers.Main), replacing the former `BroadcastReceiver` registration/unregistration pattern.
- Renamed "Broadcaster" to "Emitter" across the entire codebase (`LocationEventBroadcaster` -> `LocationEventEmitter`, `GeofenceEventBroadcaster` -> `GeofenceEventEmitter`) for consistency with the new SharedFlow-based architecture.
- Clarified documentation references to system `BroadcastReceiver` (`NotificationActionReceiver`, `BootCompletedReceiver`) vs. the removed internal `LocalBroadcastManager` mechanism.
- `LocationEventEmitter.kt` emits location events (update, error, warning) via `LocationEventFlow` instead of `LocalBroadcastManager.sendBroadcast()`.
- `GeofenceEventEmitter.kt` emits geofence transition events via `GeofenceEventFlow` instead of `LocalBroadcastManager.sendBroadcast()`.
- `NotificationActionReceiver.kt` emits directly via `NotificationActionFlow` instead of routing through `LocationEventEmitter`.
- `useLocationUpdates` hook: replaced periodic `setInterval` DB polling with one-time mount hydration and automatic `AppState`-based re-hydration on foreground resume. Exposed `refreshLocations()` method for on-demand DB sync.

### Added

- `LocationEventFlow.kt` -- `sealed interface LocationEvent` (Update, Error, Warning) + `LocationEventFlow` singleton with `MutableSharedFlow<LocationEvent>` (replay=0, buffer=64, DROP_OLDEST). Type-safe replacement for location broadcast intents.
- `GeofenceEventFlow.kt` -- `sealed interface GeofenceEvent` (Transition) + `GeofenceEventFlow` singleton with `MutableSharedFlow<GeofenceEvent>`. Type-safe replacement for geofence broadcast intents.
- `NotificationActionFlow.kt` -- `sealed interface NotificationActionEvent` (ActionClicked) + `NotificationActionFlow` singleton with `MutableSharedFlow<NotificationActionEvent>`. Decouples notification actions from `LocationEventEmitter` routing.
- `LocationExtensions.kt` shared utility extracting `isMockLocation()` extension function, replacing duplicated implementations across provider files.
- Unit tests for all three SharedFlow singletons (`LocationEventFlow`, `GeofenceEventFlow`, `NotificationActionFlow`) with Turbine.
- Unit tests for `RecoveryWorker` verifying the `isRunning` guard behavior.
- Unit tests for `FusedLocationProvider` and `AndroidLocationProvider` verifying duplicate-callback prevention.
- Test dependencies: `kotlinx-coroutines-test`, `turbine`, and `mockk` for SharedFlow and provider testing.

### Removed

- `androidx.localbroadcastmanager:localbroadcastmanager:1.1.0` dependency from `android/build.gradle`.
- `LocationEventEmitter.createIntentFilter()` method and `@Deprecated` annotation.
- `LocationEventEmitter` `ACTION_*` constants: `ACTION_LOCATION_UPDATE`, `ACTION_LOCATION_ERROR`, `ACTION_LOCATION_WARNING`, `ACTION_NOTIFICATION_ACTION`.
- `LocationEventEmitter` `EXTRA_*` constants: `EXTRA_TRIP_ID`, `EXTRA_LOCATION_DATA`, `EXTRA_ERROR_TYPE`, `EXTRA_ERROR_MESSAGE`, `EXTRA_ACTION_ID`.
- `LocationEventEmitter` `import android.content.IntentFilter`.
- `GeofenceEventEmitter.createIntentFilter()` method and `@Deprecated` annotation.
- `GeofenceEventEmitter.intentToWritableMap()` method (dead code, zero callers after SharedFlow migration).
- `GeofenceEventEmitter` `ACTION_GEOFENCE_TRANSITION` constant.
- `GeofenceEventEmitter` all `EXTRA_*` constants (7 total).
- `GeofenceEventEmitter` `isoFormatter` property.
- `GeofenceEventEmitter` 9 orphaned imports (`IntentFilter`, `Intent`, `Bundle`, `WritableNativeMap`, `Arguments`, `SimpleDateFormat`, `Locale`, `TimeZone`, `Date`).
- Deprecated synchronous `getTrackingState()` dead code.
- Stale "broadcast" terminology in `LocationService.kt` (7 locations), `BackgroundLocationModule.kt` (1 location), `GeofenceManager.kt` (1 location) -- updated to "emit"/"event".
- Interval-based DB polling logic and its associated timer cleanup from `useLocationUpdates`.

### Fixed

- **(Android)** Duplicate location events delivered to JavaScript when `LocationService.onStartCommand()` was called multiple times via recovery paths. Each location update now produces exactly one event. This was a pre-existing bug masked by the old polling mechanism, not a regression. iOS is not affected.
- **(Android)** `FusedLocationProvider` and `AndroidLocationProvider` now call `removeLocationUpdates()` before registering new callbacks/listeners in `requestLocationUpdates()`, preventing callback accumulation (provider-level deduplication).
- **(Android)** `BackgroundLocationModule.onHostResume()` and `RecoveryWorker.doWork()` now check `LocationService.isRunning` before triggering recovery, preventing redundant `onStartCommand()` calls (caller-level guards).
- Kotlin compiler deprecation warning for `Location.isFromMockProvider` in `LocationService.kt` and `LocationEventEmitter.kt`. Both files now use `LocationExtensions.isMockLocation()` which calls `Location.isMock` on API 31+ and falls back to the deprecated property on API 24-30.
- Kotlin compiler deprecation warning for synchronous `storage.getTrackingState()` in `LocationService.onStartCommand()`. Replaced with `runBlocking { storage.getTrackingStateAsync() }` -- safe because this code path only executes on system-initiated service restarts (rare recovery scenario).
- Removed dead `JELLY_BEAN_MR2` API level guard in `LocationEventEmitter.locationToBundle()` (library minSdk is 24, making the guard always true).

## [0.12.0] - 2026-03-28

### BREAKING CHANGES

- **Granular PermissionState**: `PermissionState` restructured from flat `{ hasPermission, status, canRequestAgain }` to nested `{ hasAllPermissions, location: { status, canRequestAgain }, notification: { status } }`. All consumers destructuring the old shape must update.
- **Unified NotificationOptions**: 11 flat `notification*` fields on `TrackingOptions` (`notificationTitle`, `notificationText`, `notificationIcon`, etc.) consolidated into a single `notificationOptions: NotificationOptions` object. The flat fields are removed.
- **iOS notification permission**: `useLocationPermissions` now requests `UNUserNotificationCenter` authorization as step 3 on iOS, making notification permission part of the standard permission flow.

### Added

- iOS notification permission request in `useLocationPermissions` hook (step 3 after WhenInUse and Always authorization)
- `NotificationPermissionStatus` enum (`GRANTED`, `DENIED`, `UNDETERMINED`)
- `LocationPermissionState` type with `status` and `canRequestAgain` fields
- `NotificationPermissionState` type with `status` field
- `NotificationOptions` unified interface for both tracking foreground service and geofencing notifications
- Room Database schema reset to v1 with `fallbackToDestructiveMigration()` -- clean schema with no migration chain (all legacy migrations deleted)

### Changed

- `PermissionState` restructured from flat shape to granular `{ hasAllPermissions, location, notification }` shape
- `TrackingOptions` notification fields (`notificationTitle`, `notificationText`, `notificationIcon`, `notificationLargeIcon`, `notificationColor`, `notificationChannelId`, `notificationChannelName`, `notificationPriority`, `notificationActions`, `notificationSubText`, `notificationShowTimestamp`) consolidated into `notificationOptions: NotificationOptions` object
- Android `requestPermissions()` now returns `true` when location permission is granted even if `POST_NOTIFICATIONS` is denied (notification permission is non-blocking)
- `NotificationOptions` interface is now shared between tracking foreground service and geofence notification configuration

### Fixed

- Android 13+ (API 33+) `POST_NOTIFICATIONS` permission dialog never appearing -- the native `requestNotificationPermission()` was a status-check stub that never triggered the system dialog. `useLocationPermissions` now uses `PermissionsAndroid.request(POST_NOTIFICATIONS)` on API 33+ to properly show the permission popup, falling back to the native module on older SDKs where notification permission is auto-granted.
- `GeofenceNotificationConfig` type mismatch warnings in Kotlin (9 occurrences) -- notification config properties now use correct types
- Gradle syntax deprecation warnings (~18 occurrences) -- updated `build.gradle` to use non-deprecated API patterns

## [0.11.0] - 2026-03-25

### Added

- `configureGeofenceNotifications(options)` -- global notification configuration for geofence transitions
- `getGeofenceNotificationConfig()` -- retrieve current notification configuration
- `NotificationOptions` interface -- unified notification configuration type for the library
- `GEOFENCE_TEMPLATE_VARS` constant -- template variable reference for autocomplete
- Template variable support in notification title and text: `{{identifier}}`, `{{transitionType}}`, `{{latitude}}`, `{{longitude}}`, `{{radius}}`, `{{timestamp}}`, `{{metadata.KEY}}`
- iOS geofence transition notifications via `UNUserNotificationCenter` (previously iOS showed no notifications)
- `notificationOptions` on `UseGeofencingOptions` for hook-based configuration
- `notificationOptions` field on `GeofenceRegion` for per-geofence notification overrides
  - Set to a `NotificationOptions` object to customize notification content for a specific geofence
  - Set to `false` as shorthand for `{ enabled: false }` to suppress notifications for a specific geofence
  - Omit (or set to `undefined`) to inherit the global configuration
- `transitionOverrides` field on `NotificationOptions` for per-transition-type notification customization
  - Supports `ENTER`, `EXIT`, and `DWELL` keys, each accepting a partial `NotificationOptions` object
  - Works at both the per-geofence level and the global level (`configureGeofenceNotifications()`)
- Notification resolution chain: per-geofence transition override -> per-geofence config -> global transition override -> global config -> built-in defaults
- Mixed batch support: `addGeofences()` accepts geofences with different notification configurations in a single call
- Example app: notification presets demo in `GeofencingScreen` with 5 selectable presets (Default, Custom Templates, Per-Transition, Silent, High Priority), live JSON config preview, and per-geofence preset badges
- **Android**: Location heartbeat in `GeofenceManager` -- a lightweight `FusedLocationProviderClient` request (`PRIORITY_BALANCED_POWER_ACCURACY`, 15-min interval, 5-min fastest) that keeps the GPS pipeline active when geofences are registered but `LocationService` is not running. Solves the known Android limitation where `GeofencingClient` is passive and misses transitions on devices with few location-requesting apps. Battery impact: ~2-4%/day. Automatically managed:
  - Starts when geofences are added and tracking is not active
  - Stops when `LocationService` starts (redundant with active tracking)
  - Restarts when `LocationService` stops if geofences remain
  - Stops when all geofences are removed
  - Restored after device boot via `BootCompletedReceiver` -> `restoreGeofences`
- **Android**: `setNotificationResponsiveness(5000)` on `Geofence.Builder` for faster geofence transition notifications (reduced from system default ~5 minutes to 5 seconds)

### Improved

- **Hook reference stability**: All hooks (`useGeofencing`, `useGeofenceEvents`, `useLocationUpdates`, `useBackgroundLocation`, `useLocationTracking`, `useLocationPermissions`) now internalize reference stabilization via `useRef` pattern. Consumers no longer need to wrap options or callbacks with `useMemo`/`useCallback` — inline objects and functions work correctly without causing unnecessary effect re-runs or listener re-subscriptions.
- **Memoized hook return values**: All hooks now return `useMemo`-wrapped objects, preventing unnecessary re-renders in consumer components that rely on referential equality.
- **Polling optimization**: `useLocationUpdates` 5-second status polling now skips `setState` calls when values are unchanged, eliminating periodic unnecessary re-renders.
- **Metadata serialization fix**: `GeofenceRegion.metadata` is no longer double-serialized when passed through `addGeofence()`/`addGeofences()`. Previously, Android would crash (`java.lang.String cannot be converted to JSONObject`) and iOS would silently drop the metadata. Template variables like `{{metadata.fieldName}}` now resolve correctly on both platforms.

### Changed

- (Android): Geofence notification text changed from hardcoded English ("Entered geofence" / "Geofence: {id}") to template-based defaults ("{{transitionType}} zone: {{identifier}}" / "Transition detected"). Customize via `configureGeofenceNotifications()`.
- **Android**: Room Database migration v5 -> v6 -- adds `notificationConfig TEXT` column to the geofence table for persisting per-geofence notification configuration
- **iOS**: Core Data model version v3 -- adds optional `notificationConfig` attribute for per-geofence notification persistence

## [0.10.0] - 2026-03-21

### Added

- **Full iOS Support**: Complete native implementation using Swift and CLLocationManager
  - Background location tracking with `CLLocationManager` and `allowsBackgroundLocationUpdates`
  - Core Data persistence with batched async writes (matches Android Room DB behavior)
  - Two-step permission flow: WhenInUse → Always authorization via `requestAlwaysAuthorization()`
  - Significant location monitoring for crash recovery and app wake-up
  - `RecoveryManager` with stop token pattern and 5 recoveries/hour limit
  - `LocationManagerWrapper` orchestrating CLLocationManager lifecycle
  - `LocationManagerDelegate` handling all delegate callbacks
  - `CoreDataStack` for persistent storage setup and management
  - `TrackingOptions.swift` and `LocationAccuracy.swift` mapping TypeScript options to iOS native values
  - `activityType` support for battery optimization (automotive, fitness, other navigation)
  - `pausesLocationUpdatesAutomatically` for system-managed battery savings

- **Cross-Platform Permission Hooks**: `useLocationPermissions` now works on both platforms
  - iOS uses native `checkLocationPermission()` and `requestLocationPermission()` TurboModule methods
  - New `WHEN_IN_USE` permission status for iOS (maps to `hasPermission = true`)
  - Android continues using `PermissionsAndroid` API as before

- **New TurboModule Methods**:
  - `checkLocationPermission()` - Returns current permission status from native layer
  - `requestLocationPermission()` - Requests location permission through native CLLocationManager (iOS)

- **iOS Warning Events**: Platform-specific warnings via `onLocationWarning`
  - `PERMISSION_REVOKED` - User revoked location permission while tracking
  - `PERMISSION_DOWNGRADED` - User downgraded from Always to WhenInUse

### Changed

- `useLocationPermissions` hook is now fully cross-platform (was Android-only)
- `LocationPermissionStatus` enum now includes `WHEN_IN_USE` value
- Documentation updated across all guides to reflect dual-platform support

### iOS-Specific Behavior

- No foreground notification on iOS; the system shows a blue status bar indicator
- Notification-related `TrackingOptions` fields are silently ignored on iOS
- `activityType` in `TrackingOptions` is iOS-only (ignored on Android)
- Crash recovery uses significant location monitoring instead of WorkManager
- Persistence uses Core Data (SQLite) instead of Room Database
- Distance filter uses `CLLocationManager.distanceFilter` property

### Requirements

- React Native 0.70 or higher
- Android API 24+ (Android 7.0 Nougat)
- iOS 13+ (iPhone and iPad)
- Xcode 15+ (for building iOS)
- Google Play Services Location 21.3.0 (Android)

## [0.9.0] - 2026-03-19

### Added

- 🎨 **Notification Visual Customization** (Phase 1): Core appearance options for the foreground service notification
  - `notificationSmallIcon` (string) - Custom drawable resource name for small icon, with fallback to system default
  - `notificationColor` (string) - Hex color for notification accent color (e.g., "#FF5722")
  - `notificationShowTimestamp` (boolean) - Show/hide timestamp on notification

- 🔄 **Dynamic Notification Updates** (Phase 2): Update notification content while tracking is active
  - New `updateNotification(title, text)` method on the public API and TurboModule spec
  - Updates notification content in-place using `NotificationManager.notify()`
  - Dynamic updates are transient (not persisted to DB, won't survive service restart)

- 🔘 **Notification Action Buttons** (Phase 3): Interactive buttons on the tracking notification
  - New `NotificationAction` interface: `{ id: string; label: string }`
  - New `NotificationActionEvent` interface: `{ tripId: string; actionId: string }`
  - `notificationActions` field in `TrackingOptions` (max 3 actions)
  - New `onNotificationAction` callback in `useLocationUpdates` hook
  - Flow: PendingIntent → NotificationActionReceiver → LocalBroadcast → RCTDeviceEventEmitter → JS
  - JSON serialization workaround for Codegen (typed object arrays not supported)
  - New `NotificationActionReceiver` manifest-registered BroadcastReceiver

- 🖼️ **Extended Notification Customization** (Phase 4): Additional appearance options
  - `notificationLargeIcon` (string) - Drawable resource decoded with BitmapFactory for large icon
  - `notificationSubtext` (string) - Subtext below notification content
  - `notificationChannelId` (string) - Custom notification channel ID (default still "background_location_channel")

- 🎯 **Static Notification Defaults**: Configure default icons and colors without runtime options
  - AndroidManifest `<meta-data>` support (same pattern as Firebase)
    - `com.backgroundlocation.default_notification_icon` — default small icon
    - `com.backgroundlocation.default_notification_large_icon` — default large icon
    - `com.backgroundlocation.default_notification_color` — default accent color
  - Convention-based drawable resolution (`bg_location_notification_icon` in `res/drawable/`)
  - Resolution chain: Runtime → Manifest → Convention → System default
  - Applies to all notification contexts including minimal notification (Android 12+ deadline) and crash recovery
  - New `NotificationDefaults.kt` utility with cached resolution

- 🗄️ **Database Migrations**: Room Database schema versioning v1 → v4
  - Migration v1→v2 (Phase 1): Visual customization fields
  - Migration v2→v3 (Phase 3): Notification action fields
  - Migration v3→v4 (Phase 4): Extended customization fields
  - All new fields persisted in `TrackingStateEntity` for crash recovery

### Changed

- 🔧 **TrackingOptions**: Extended with 6 new notification parameters
  - Added `notificationSmallIcon?: string` for custom small icon drawable
  - Added `notificationColor?: string` for notification accent color
  - Added `notificationShowTimestamp?: boolean` for timestamp visibility
  - Added `notificationLargeIcon?: string` for large icon drawable
  - Added `notificationSubtext?: string` for notification subtext
  - Added `notificationChannelId?: string` for custom channel ID
  - Added `notificationActions?: NotificationAction[]` for action buttons (max 3)

- 🔧 **TurboModule Spec**: Extended with new fields and method
  - Added all new notification fields to the spec
  - Added `updateNotification(title: string, text: string)` method

- 🔧 **LocationService**: Enhanced notification creation
  - Large icon support with `BitmapFactory` drawable decoding
  - Subtext support below notification content
  - Custom notification channel ID support
  - Action buttons with `PendingIntent` for each action
  - In-place notification content updates via `updateNotificationContent()`
  - Bundle serialization for notification actions

- 🔧 **LocationEventBroadcaster**: New notification action broadcasting
  - Added `ACTION_NOTIFICATION_ACTION` constant
  - Added `broadcastNotificationAction()` method

- 🔧 **Hooks**: Extended for new notification features
  - `useBackgroundLocation`: TrackingOptions → TrackingOptionsSpec conversion for new fields
  - `useLocationUpdates`: Added `onNotificationAction` event listener

- 🔧 **LocationService**: Notification icon/color resolution now uses `NotificationDefaults` utility
  - `createMinimalNotification()` respects static defaults instead of hardcoded system icon
  - `createNotification()` uses full resolution chain for icon, large icon, and color
- 🔧 **RecoveryWorker**: Recovery notification now uses `NotificationDefaults` for icon resolution

### Technical Details

**File Changes (TypeScript):**

- `src/types/tracking.ts`: Added `NotificationAction`, `NotificationActionEvent` interfaces, 6 new `TrackingOptions` fields
- `src/types/hooks.ts`: Added `onNotificationAction` callback to hook options
- `src/types/index.ts`: New type exports for `NotificationAction` and `NotificationActionEvent`
- `src/NativeBackgroundLocation.ts`: New spec fields + `updateNotification` method
- `src/index.tsx`: Public API: `updateNotification`, JSON serialization of actions, new type exports
- `src/hooks/useBackgroundLocation.ts`: TrackingOptions → TrackingOptionsSpec conversion for new fields
- `src/hooks/useLocationUpdates.ts`: `onNotificationAction` event listener

**File Changes (Kotlin):**

- `android/src/main/java/com/backgroundlocation/TrackingOptions.kt`: 6 new fields
- `android/src/main/java/com/backgroundlocation/BackgroundLocationModule.kt`: Parse new fields, `handleNotificationAction`, `updateNotification` override
- `android/src/main/java/com/backgroundlocation/LocationService.kt`: `createNotification` updates (largeIcon, subtext, channelId, actions with PendingIntent), `updateNotificationContent`, Bundle serialization
- `android/src/main/java/com/backgroundlocation/LocationEventBroadcaster.kt`: `ACTION_NOTIFICATION_ACTION` + `broadcastNotificationAction`
- `android/src/main/java/com/backgroundlocation/NotificationActionReceiver.kt`: New manifest-registered BroadcastReceiver
- `android/src/main/AndroidManifest.xml`: Register `NotificationActionReceiver`
- `android/src/main/java/com/backgroundlocation/LocationStorage.kt`: Save/restore all new fields
- `android/src/main/java/com/backgroundlocation/database/TrackingStateEntity.kt`: 6 new columns
- `android/src/main/java/com/backgroundlocation/database/LocationDatabase.kt`: Version 1→4
- `android/src/main/java/com/backgroundlocation/database/Migrations.kt`: `MIGRATION_1_2`, `MIGRATION_2_3`, `MIGRATION_3_4`
- `NotificationDefaults.kt` - NEW: Singleton utility for resolving notification icon/color from manifest metadata, convention drawables, and system defaults with caching
- `LocationService.kt` - Refactored icon/color resolution to use NotificationDefaults in createMinimalNotification() and createNotification()
- `RecoveryWorker.kt` - Refactored icon resolution to use NotificationDefaults in createRecoveryNotification()

**File Changes (Tests):**

- `src/__tests__/index.test.ts`: 11 new tests (visual options, updateNotification, actions serialization, extended options)

**Architecture:**

- Four-phase implementation for incremental delivery
- JSON serialization workaround for Codegen limitation with typed object arrays
- PendingIntent-based action flow through manifest-registered BroadcastReceiver
- Transient dynamic updates (not persisted) for performance
- All persistent fields stored in Room DB for crash recovery continuity

### Migration Guide

If upgrading from 0.8.0:

**No Breaking Changes** - All existing code continues to work without modifications. All new fields are optional with defaults preserving existing behavior.

**New Features Available:**

```typescript
// Notification visual customization
await BackgroundLocation.startTracking('trip-123', {
  notificationSmallIcon: 'ic_delivery',
  notificationColor: '#FF5722',
  notificationShowTimestamp: true,
  notificationLargeIcon: 'ic_large_logo',
  notificationSubtext: '2.5km remaining',
  notificationChannelId: 'delivery_tracking',
  notificationActions: [
    { id: 'stop', label: 'Stop' },
    { id: 'pause', label: 'Pause' },
  ],
});

// Dynamic notification update
await BackgroundLocation.updateNotification(
  'Delivery #1234',
  'Arriving in 5 minutes'
);

// Listen for action button presses
useLocationUpdates({
  onNotificationAction: (event) => {
    if (event.actionId === 'stop') stopTracking();
  },
});

// Or configure defaults statically in AndroidManifest.xml (no runtime code needed):
// <meta-data android:name="com.backgroundlocation.default_notification_icon"
//            android:resource="@drawable/ic_notification" />
```

### Requirements

- React Native 0.70 or higher
- Android API 24+ (Android 7.0 Nougat)
- Google Play Services Location 21.3.0
- Kotlin 2.0.21
- Room Database v4 schema

## [0.8.0] - 2025-12-22

### Added

- 📏 **Distance Filter**: Minimum distance between location updates (Android)
  - `distanceFilter` option in `TrackingOptions` (in meters)
  - Uses `setMinUpdateDistanceMeters()` for FusedLocationProvider
  - Uses `minDistance` parameter for AndroidLocationProvider
  - Default: 0 (no distance filter - all updates delivered)

- ⏱️ **Callback Throttling**: Control callback execution frequency
  - `onUpdateInterval` option in `TrackingOptions` and `UseLocationUpdatesOptions`
  - Throttles `onLocationUpdate` callback to execute at minimum intervals (e.g., every 30 seconds)
  - Locations are still collected and stored at `updateInterval` rate
  - Callback fires on the first location that arrives after the interval has elapsed
  - Ideal for periodic server sync without overwhelming network requests

- 🔄 **startTracking Overload**: Cleaner API for options-only calls
  - `startTracking(options?: TrackingOptions)` - new signature
  - `startTracking(tripId?: string, options?: TrackingOptions)` - backward compatible
  - Automatically detects if first argument is options object or tripId

### Changed

- 🔧 **LocationProvider Interface**: Added `distanceFilter` parameter
  - Updated `requestLocationUpdates()` signature in all providers
  - Both FusedLocationProvider and AndroidLocationProvider support distance filtering

- 📱 **TrackingOptions**: Extended with new parameters
  - Added `distanceFilter?: number` for Android distance filtering
  - Added `onUpdateInterval?: number` for callback throttling

### Technical Details

**File Changes:**

- `android/src/main/java/com/backgroundlocation/TrackingOptions.kt`: Added distanceFilter
- `android/src/main/java/com/backgroundlocation/provider/LocationProvider.kt`: Updated interface
- `android/src/main/java/com/backgroundlocation/provider/FusedLocationProvider.kt`: Distance filter support
- `android/src/main/java/com/backgroundlocation/provider/AndroidLocationProvider.kt`: Distance filter support
- `android/src/main/java/com/backgroundlocation/LocationService.kt`: Pass distanceFilter to providers
- `android/src/main/java/com/backgroundlocation/BackgroundLocationModule.kt`: Parse distanceFilter option
- `src/types/tracking.ts`: Added distanceFilter and onUpdateInterval types
- `src/types/hooks.ts`: Added onUpdateInterval to UseLocationUpdatesOptions
- `src/hooks/useLocationUpdates.ts`: Implemented callback throttling
- `src/index.tsx`: Added startTracking overload with distanceFilter support
- `src/NativeBackgroundLocation.ts`: Added distanceFilter to TurboModule spec

### Migration Guide

If upgrading from 0.7.0:

**No Breaking Changes** - All existing code continues to work without modifications.

**New Features Available:**

```typescript
// Distance filter - only update if moved 50+ meters
await BackgroundLocation.startTracking('my-trip', {
  distanceFilter: 50,
  updateInterval: 5000,
});

// Cleaner API - no need to pass undefined for tripId
await BackgroundLocation.startTracking({
  distanceFilter: 100,
  notificationTitle: 'Tracking',
});

// Callback throttling - callback executes every ~30 seconds
// Locations are still collected at updateInterval rate, but onLocationUpdate
// fires only when 30+ seconds have passed since the last callback execution
useLocationUpdates({
  onLocationUpdate: (location) => syncToServer(location),
  onUpdateInterval: 30000, // minimum 30 seconds between callback executions
});
```

### Requirements

- React Native 0.70 or higher
- Android API 24+ (Android 7.0 Nougat)
- Google Play Services Location 21.3.0
- Kotlin 2.0.21

## [0.7.0] - 2025-12-20

### Added

- 🤖 **Android 14/15 Compliance**: Full compatibility with latest Android versions
  - `FOREGROUND_SERVICE_TYPE_LOCATION` declaration for Android 14+ (API 34)
  - `onTimeout()` callback handling for Android 15+ (~6 hour service limit)
  - Auto-restart service with saved state when timeout reached
  - `onTaskRemoved()` handling for app swipe from recents

- ⚠️ **Warning Event System**: New event types for service lifecycle
  - `LocationWarningEvent` type for warning notifications
  - `LocationWarningType` enum: `SERVICE_TIMEOUT`, `TASK_REMOVED`, `LOCATION_UNAVAILABLE`
  - `onLocationWarning` callback in `useLocationUpdates` hook
  - `lastWarning` state in hook results

- 🏗️ **Provider Abstraction Layer**: Extensible location provider system
  - `LocationProvider` interface for location updates
  - `FusedLocationProvider` - Google Play Services implementation
  - `AndroidLocationProvider` - Fallback for devices without Play Services
  - `LocationProviderFactory` for automatic provider selection
  - `LocationProcessor` interface for filtering and processing

- 📚 **Production Documentation**: Comprehensive production guides
  - `docs/production/BATTERY_OPTIMIZATION.md` - Battery efficiency guide
  - `docs/production/CRASH_RECOVERY.md` - Recovery mechanisms documentation
  - `docs/production/GOOGLE_PLAY_COMPLIANCE.md` - Play Store requirements

- 🗄️ **Database Migrations**: Room Database schema versioning
  - Version 2 schema with migrations support
  - Automatic migration from version 1 to 2

### Changed

- 🔧 **LocationService**: Major architectural improvements
  - Immediate `startForeground()` call within 5-10 second Android requirement
  - Enhanced restart handling with crash loop protection
  - Improved notification channel management

- 🔧 **BackgroundLocationModule**: Enhanced event broadcasting
  - Uses `LocationEventBroadcaster` for IPC via LocalBroadcastManager
  - Better separation of concerns for event handling

- 📱 **Example App**: Updated for Android 15 compatibility
  - Updated AndroidManifest.xml with proper service declarations
  - Foreground service type declarations

### Requirements

- React Native 0.70 or higher
- Android API 24+ (Android 7.0 Nougat)
- Google Play Services Location 21.3.0
- Kotlin 2.0.21
- Supports Android 15 (API 35, targetSDK 36)

## [0.6.0] - 2025-11-16

### Added

- 🔄 **Crash Recovery & Data Persistence**: Robust recovery system for tracking sessions
  - Automatic tracking session recovery after app crash or restart
  - Persistent storage of `TrackingOptions` for complete state restoration
  - Service auto-recovery using `START_STICKY` for system-initiated restarts
  - Graceful handling of permission revocations during recovery
  - Automatic cleanup of corrupted state to prevent recovery loops
  - Complete recovery documentation and testing guide
  - Recovery works across app crashes, system process termination, and device reboots

- 🗄️ **Room Database Integration**: Modern persistence layer
  - Room Database 2.6.1 with KSP for all data persistence
  - Location data stored with SQLite backend and indexed queries
  - Tracking state stored in single-row table for efficiency
  - Better performance and scalability for large datasets
  - Thread-safe coroutine-based operations
  - No JSON parsing or serialization overhead

- 📚 **Comprehensive Documentation**:
  - Complete crash recovery architecture guide in `docs/development/CRASH_RECOVERY.md`
  - Manual testing guide with 8 detailed scenarios in `docs/development/TEST_RECOVERY.md`
  - Technical implementation documentation in `docs/development/IMPLEMENTATION_RECOVERY.md`
  - Performance metrics and best practices
  - Troubleshooting guide for common recovery scenarios

### Changed

- 🔧 **LocationStorage**: Complete refactoring to use Room Database exclusively
  - Maintains same public API for backward compatibility
  - All data stored in SQLite via Room (locations and tracking state)
  - `saveTrackingState()` now accepts optional `TrackingOptions` parameter
  - `getTrackingState()` returns `TrackingState` with stored options
  - Automatic cleanup of options when tracking stops
  - Asynchronous operations with coroutines for better performance
  - Zero JSON parsing or serialization

- 🔧 **BackgroundLocationModule**: Enhanced initialization with recovery
  - Added `recoverTrackingSession()` called during module init
  - Validates permissions before attempting recovery
  - Restarts LocationService with saved tripId and options
  - Handles recovery failures gracefully with state cleanup

- 🔧 **LocationService**: Improved service restart capability
  - Enhanced `onStartCommand()` to handle null intent (system restart)
  - Automatic recovery of tripId and options from storage
  - Already uses `START_STICKY` for automatic system restart
  - Graceful degradation when recovery data unavailable

### Technical Details

**Architecture Changes:**

- New persistence layer using Room Database exclusively
- Room Database handles all data with SQLite backend and indexed queries
- Locations stored in `locations` table with tripId index
- Tracking state stored in single-row `tracking_state` table
- Thread-safe operations using Kotlin Coroutines
- TrackingState data class now includes `options: TrackingOptions?`
- Module initialization triggers automatic recovery check
- Service can self-recover from storage when restarted by system

**Recovery Flow:**

1. App crashes or is killed by system
2. User reopens app (or system restarts service via START_STICKY)
3. `BackgroundLocationModule.init()` calls `recoverTrackingSession()`
4. Checks for active tracking state in Room Database
5. Validates location permissions still granted
6. Restarts `LocationService` with saved tripId and TrackingOptions
7. Tracking continues seamlessly from previous state

**Error Handling:**

- Permission revocation during recovery clears tracking state
- Corrupted recovery data triggers automatic cleanup
- Best-effort recovery with graceful fallback to clean state

**File Changes:**

- `android/build.gradle`: Added Room 2.6.1 with KSP dependencies
- `android/src/main/java/com/backgroundlocation/database/LocationEntity.kt`: Room entity for locations (new)
- `android/src/main/java/com/backgroundlocation/database/LocationDao.kt`: DAO for location operations (new)
- `android/src/main/java/com/backgroundlocation/database/TrackingStateEntity.kt`: Room entity for tracking state (new)
- `android/src/main/java/com/backgroundlocation/database/TrackingStateDao.kt`: DAO for tracking state operations (new)
- `android/src/main/java/com/backgroundlocation/database/LocationDatabase.kt`: Room database singleton with both tables (new)
- `android/src/main/java/com/backgroundlocation/LocationStorage.kt`: Refactored to use Room exclusively
- `android/src/main/java/com/backgroundlocation/BackgroundLocationModule.kt`: Added recovery logic
- `android/src/main/java/com/backgroundlocation/LocationService.kt`: Improved restart handling
- `docs/development/CRASH_RECOVERY.md`: Complete recovery documentation (new)
- `docs/development/TEST_RECOVERY.md`: Manual testing guide (new)
- `docs/development/IMPLEMENTATION_RECOVERY.md`: Technical implementation details (new)

### Migration Guide

If upgrading from 0.5.0:

**No Breaking Changes** - All existing code continues to work without modifications.

**Important Note:**

- Previous versions stored data in memory only
- After update, any in-progress tracking sessions will need to be restarted
- This is expected behavior and not a bug

**New Features Available:**

```typescript
// Everything continues to work as before
const { startTracking, stopTracking, getLocations } = useBackgroundLocation();

// Crash recovery is now automatic
await startTracking('my-trip', {
  updateInterval: 5000,
  accuracy: LocationAccuracy.HIGH_ACCURACY,
});

// If app crashes and restarts, tracking resumes automatically
// All locations are now persisted to database
```

**Performance Improvements:**

- Better performance with large datasets (1000+ location points)
- Faster queries with indexed Room Database
- Reduced memory usage with coroutine-based operations
- No JSON parsing overhead - direct SQLite storage

**Best Practices:**

- Crash recovery is automatic - no configuration needed
- Data is now persisted to SQLite database
- Use `clearTrip()` to remove old trip data when no longer needed

### Requirements

- React Native 0.70 or higher
- Android API 24+ (Android 7.0 Nougat)
- Google Play Services Location 21.3.0
- Kotlin 2.0.21
- KSP (Kotlin Symbol Processing) for Room code generation

## [0.5.0] - 2025-11-14

### Added

- 📍 **Extended Location Properties**: Full support for all location data from play-services-location:21.3.0
  - `accuracy` - Horizontal accuracy in meters
  - `altitude` - Altitude in meters above sea level
  - `speed` - Speed in meters per second
  - `bearing` - Bearing in degrees (0-360)
  - `verticalAccuracyMeters` - Vertical accuracy in meters (Android API 26+)
  - `speedAccuracyMetersPerSecond` - Speed accuracy in meters per second (Android API 26+)
  - `bearingAccuracyDegrees` - Bearing accuracy in degrees (Android API 26+)
  - `elapsedRealtimeNanos` - Elapsed realtime in nanoseconds since system boot
  - `provider` - Location provider (gps, network, passive, etc.)
  - `isFromMockProvider` - Whether the location is from a mock provider (Android API 18+)
  - All properties are optional and only included when available from the location provider

- 🛠️ **Utility Functions**: New utility module for object manipulation
  - `extractDefinedProperties()` - Generic function to extract all defined properties from objects
  - Located in `src/utils/objectUtils.ts` for reusability across the codebase
  - Automatically handles optional properties without manual field listing

- 📱 **Enhanced Example App**: Updated example app to demonstrate extended location properties
  - Displays all available location properties in real-time
  - Shows formatted values (speed in km/h, elapsed time in ms, etc.)
  - Visual separation between required and optional properties
  - Demonstrates proper usage of extended location data

### Changed

- 🔧 **TypeScript Interfaces**: Extended `Coords` and `LocationUpdateEvent` interfaces
  - Added 10 new optional properties with full JSDoc documentation
  - Maintains backward compatibility (all new fields are optional)
  - Type-safe access to all location data from play-services-location API

- 🔄 **Hook Implementation**: Enhanced `useLocationUpdates` hook
  - Automatically extracts and includes all available location properties
  - Uses generic utility function for property extraction
  - No manual field mapping required for future property additions

- 📦 **Native Android Module**: Extended LocationService and LocationStorage
  - `LocationService.handleLocation()` now extracts all available location data
  - `LocationService.sendLocationUpdateEvent()` includes all properties in events
  - `LocationStorage.saveLocation()` stores all available properties
  - `LocationStorage.getLocations()` returns all stored properties
  - Proper handling of API-level specific properties (Android 18+, 26+)

### Technical Details

**File Changes:**

- `android/src/main/java/com/backgroundlocation/LocationService.kt`: Extended to extract and emit all location properties
- `android/src/main/java/com/backgroundlocation/LocationStorage.kt`: Extended to save and retrieve all location properties
- `src/types/tracking.ts`: Added optional properties to `Coords` and `LocationUpdateEvent` interfaces
- `src/hooks/useLocationUpdates.ts`: Enhanced to map all properties using `extractDefinedProperties`
- `src/utils/objectUtils.ts`: New utility module for generic property extraction
- `example/src/App.tsx`: Updated to display all location properties
- `example/src/styles.ts`: Added styles for additional properties display

**Architecture:**

- Generic property extraction eliminates manual field mapping
- Future-proof design automatically includes new properties
- Type-safe access to all location data
- Backward compatible (existing code continues to work)
- Proper handling of optional and API-level specific properties

### Migration Guide

If upgrading from 0.4.0:

**No Breaking Changes** - All existing code continues to work without modifications.

**New Features Available:**

```typescript
// Existing code still works
const { locations } = useLocationUpdates();
locations.forEach((location) => {
  console.log(location.latitude);
  console.log(location.longitude);
  console.log(location.timestamp);
});

// New properties are now available (when provided by location provider)
locations.forEach((location) => {
  if (location.accuracy !== undefined) {
    console.log(`Accuracy: ${location.accuracy} meters`);
  }
  if (location.speed !== undefined) {
    console.log(`Speed: ${location.speed} m/s`);
  }
  if (location.altitude !== undefined) {
    console.log(`Altitude: ${location.altitude} meters`);
  }
  // ... and more properties
});
```

**Best Practices:**

- Always check for `undefined` before using optional properties
- Properties may not be available on all devices or Android versions
- Some properties require specific Android API levels (18+, 26+)

## [0.4.0] - 2025-11-05

### Added

- ⚙️ **Configurable Tracking Options**: Full customization of location tracking parameters
  - `TrackingOptions` interface for comprehensive configuration
  - Customizable update intervals (`updateInterval`, `fastestInterval`, `maxWaitTime`)
  - Location accuracy levels (`LocationAccuracy` enum)
  - Notification customization (`notificationTitle`, `notificationText`, `notificationChannelName`, `notificationPriority`)
  - `waitForAccurateLocation` option for precise GPS tracking
  - Support for configuration options in `startTracking()` method and `useBackgroundLocation` hook

- 📊 **Location Accuracy Enums**: Type-safe location accuracy levels
  - `LocationAccuracy.HIGH_ACCURACY` - Highest accuracy using GPS and sensors
  - `LocationAccuracy.BALANCED_POWER_ACCURACY` - Balanced accuracy and power consumption
  - `LocationAccuracy.LOW_POWER` - Low power consumption using network-based location
  - `LocationAccuracy.NO_POWER` - No power consumption, passive updates
  - `LocationAccuracy.PASSIVE` - Receives location updates from other apps

- 🔔 **Notification Priority Enums**: Type-safe notification priority levels
  - `NotificationPriority.LOW` - Low priority (default)
  - `NotificationPriority.DEFAULT` - Default priority
  - `NotificationPriority.HIGH` - High priority
  - `NotificationPriority.MAX` - Maximum priority

- 🗑️ **Clear Locations Method**: Added `clearLocations()` method to `useLocationUpdates` hook
  - Allows clearing all locations for the current trip
  - Prevents immediate reloading of data after clear operation
  - Works seamlessly with auto-update functionality

- 📱 **Configuration Presets**: Example app includes predefined configuration presets
  - **High Accuracy**: Optimized for navigation (2s interval, GPS)
  - **Balanced**: Good balance between accuracy and battery (10s interval)
  - **Low Power**: Optimized for battery efficiency (30s interval, network-based)
  - **Default**: Standard configuration (5s interval)

- 🔋 **Battery Optimization**: Built-in battery efficiency features
  - Configurable accuracy levels (`LOW_POWER`, `BALANCED_POWER_ACCURACY`) for reduced battery consumption
  - Adjustable update intervals (`updateInterval`, `fastestInterval`, `maxWaitTime`) to minimize location requests
  - Smart location updates that only request when necessary
  - Foreground service optimization for efficient background operation
  - Configuration presets for common battery-conscious use cases

### Changed

- 🔧 **API Enhancement**: `startTracking()` now accepts optional `TrackingOptions` parameter
  - `startTracking(tripId?: string, options?: TrackingOptions): Promise<string>`
  - Backwards compatible with existing code (options are optional)
  - Default values applied when options not provided

- 📚 **Documentation Updates**: Comprehensive documentation for new features
  - Updated README.md with configuration examples and enums documentation
  - Enhanced hooks.md with TrackingOptions examples
  - Updated QUICKSTART.md with configuration examples
  - Added configuration presets documentation

### Fixed

- 🐛 Fixed inline styles warnings in RouteMap component
- 🐛 Fixed enum export/import issues for proper TypeScript support
- 🐛 Improved type safety for TrackingOptions across the codebase

## [0.3.0] - 2025-01-26

### Added

- 🎯 **Real-time Location Updates**: New `useLocationUpdates` hook for automatic location watching
  - Real-time event-driven location updates via native events
  - Automatic subscription to `onLocationUpdate` events from Android background service
  - Access to last location received in real-time
  - Optional filtering by specific tripId
  - Callback support for each new location
  - Automatic loading of existing locations on mount
  - Complete TypeScript support with full type definitions
  - Automatic cleanup of event listeners on unmount
  - Graceful handling when native module unavailable

- 📡 **Android Event System**: Native event emission infrastructure
  - LocationService emits `onLocationUpdate` events via DeviceEventManagerModule
  - Events sent whenever new GPS location is collected
  - Non-blocking async event emission
  - Context-aware event system with React Native bridge

- 📚 **Enhanced Documentation**:
  - Complete real-time updates guide in `docs/getting-started/REAL_TIME_UPDATES.md`
  - Usage examples demonstrating manual vs automatic modes
  - Best practices for combining hooks
  - FAQ section with common questions
  - Updated example app with toggle for manual/automatic modes

- 🎨 **Improved Example App**:
  - Added toggle switch to demonstrate manual vs automatic update modes
  - Real-time visualization of last location
  - Visual indicators for active mode
  - Conditional UI elements based on update mode

### Changed

- 📦 **Version Bump**: Updated to 0.3.0 following semantic versioning (minor release for new features)
- 🔄 **Event System**: Android LocationService now emits native events for real-time updates
- 📱 **Module Integration**: BackgroundLocationModule now provides ReactContext to LocationService

### Technical Details

**File Changes:**

- `android/src/main/java/com/backgroundlocation/LocationService.kt`: Added event emission
- `android/src/main/java/com/backgroundlocation/BackgroundLocationModule.kt`: Added context setup
- `src/hooks/useLocationUpdates.ts`: New hook for real-time updates
- `src/types.ts`: Added `LocationUpdateEvent`, `UseLocationUpdatesOptions`, `UseLocationUpdatesResult`
- `src/hooks/index.ts`: Exported new hook and types
- `src/index.tsx`: Exported new hook and types
- `example/src/App.tsx`: Enhanced with toggle demonstration

**Architecture:**

- Event-driven updates (no polling required)
- Non-blocking event emission
- Automatic subscription/unsubscription
- Memory efficient with minimal overhead
- Compatible with existing imperative API

### Migration Guide

If upgrading from 0.2.0:

**No Breaking Changes** - All existing APIs remain fully supported.

**New Feature - Real-time Updates:**

```typescript
// Option 1: Manual refresh (existing)
import { useBackgroundLocation } from '@gabriel-sisjr/react-native-background-location';
const { locations, refreshLocations } = useBackgroundLocation();
// ... call refreshLocations() periodically

// Option 2: Automatic updates (NEW)
import { useLocationUpdates } from '@gabriel-sisjr/react-native-background-location';
const { locations } = useLocationUpdates();
// ... locations update automatically in real-time

// Option 3: Combine both (recommended)
const control = useBackgroundLocation(); // For start/stop
const updates = useLocationUpdates(); // For real-time data
```

### Requirements

- React Native 0.70 or higher
- Android API 21+ (Android 5.0 Lollipop)
- Google Play Services Location 21.3.0

### Known Limitations

- iOS event emitters not yet implemented (iOS support planned)
- Events only processed when app is in foreground
- Real-time updates currently Android-only

## [0.2.0] - 2025-10-26

### Added

- ⚛️ **React Hooks API**: Production-ready hooks for easier integration and better DX
  - `useBackgroundLocation`: Full-featured hook for managing background location tracking with auto-start, callbacks, and comprehensive error handling
  - `useLocationTracking`: Lightweight hook for monitoring tracking status with real-time updates
  - `useLocationPermissions`: Complete permission management hook for Android (including Android 10+ background location permissions)
  - Full TypeScript support with detailed type definitions
  - Automatic cleanup on unmount
  - React best practices with proper dependency management

- 🤖 **Automated CI/CD Pipeline**: Complete GitHub Actions workflow automation
  - **CI Workflow**: Validates code quality on every PR (lint, typecheck, unit tests, Android/iOS builds)
  - **Publish Workflow**: Automated production releases from `main` branch to npm
  - **Pre-release Workflow**: Automated beta releases from `develop` branch (tagged as `@beta`)
  - Semantic versioning support with automatic version detection
  - Supply chain security with npm provenance
  - Automated GitHub Releases with generated release notes
  - Branch protection and required status checks

- 🧪 **Comprehensive Test Suite**: Achieved 98.91% code coverage
  - 62 tests for `useBackgroundLocation` hook covering all scenarios
  - 25 tests for `useLocationTracking` hook with edge cases
  - 9 tests for `useLocationPermissions` hook
  - Integration tests for main module exports
  - Total: 96 passing tests across 4 test suites
  - Platform-specific behavior tests (Android/iOS)

- 📚 **Enhanced Documentation**:
  - Complete React Hooks guide in `docs/getting-started/hooks.md`
  - Comprehensive CI/CD guide in `docs/development/CICD.md`
  - Testing guide in `docs/development/TESTING.md`
  - Updated documentation structure with clear navigation
  - Consolidated documentation following project conventions

### Changed

- 📦 **Version Bump**: Updated to 0.2.0 following semantic versioning (minor release for new features)
- 🔧 **Test Infrastructure**:
  - Fixed TypeScript errors with `Platform.Version` mocks using `Object.defineProperty`
  - Improved test setup with minimal mocks for better reliability
  - Enhanced error handling tests for all hooks
- 📝 **Documentation Structure**: Reorganized CI/CD docs into `docs/development/` for consistency
- 🌍 **Documentation Language**: Consolidated to English-only for multilingual team

### Fixed

- 🐛 TypeScript read-only property errors in test files
- 🐛 ESLint warnings in test configurations
- 🐛 Test coverage configuration for proper threshold handling

### Migration Guide

If upgrading from 0.1.0:

**No Breaking Changes** - All existing imperative APIs remain unchanged and fully supported.

**New Recommended Approach** - Use hooks for new code:

```typescript
// Old (imperative) -- NOTE: the default-export form shown in the original
// 0.2.0 release notes was later removed in the 0.14.0 entry above.
// Use named imports instead.
import { startTracking } from '@gabriel-sisjr/react-native-background-location';
await startTracking('trip-123');

// New (recommended)
import { useBackgroundLocation } from '@gabriel-sisjr/react-native-background-location';
const { startTracking } = useBackgroundLocation({
  onLocationUpdate: (location) => console.log(location),
});
```

### Branch Strategy

Starting with 0.2.0, the project follows a two-branch strategy:

- **`main`**: Production-ready releases (stable versions)
- **`develop`**: Latest development code (beta releases available via `npm install @gabriel-sisjr/react-native-background-location@beta`)

## [0.1.0] - 2025-10-26

### Added

- ✨ Initial release of @gabriel-sisjr/react-native-background-location
- 🚀 Background location tracking using TurboModules (New Architecture)
- 📱 Full Android support with Kotlin implementation
- 🔐 Session-based tracking with trip IDs
- 💾 Persistent location storage using SharedPreferences
- 🔔 Foreground service with notification for reliable background tracking
- 📍 High-accuracy location updates (configurable intervals)
- 🎯 Complete TypeScript API with full type definitions
- 📚 Comprehensive documentation and usage examples
- 🧪 Functional example app demonstrating all features
- 🛡️ Permission checking and error handling
- 🔄 Idempotent API operations

### API Methods

- `startTracking(tripId?: string): Promise<string>` - Start location tracking
- `stopTracking(): Promise<void>` - Stop location tracking
- `isTracking(): Promise<TrackingStatus>` - Check tracking status
- `getLocations(tripId: string): Promise<Coords[]>` - Retrieve locations
- `clearTrip(tripId: string): Promise<void>` - Clear trip data

### Features

- **Background Tracking**: Continues collecting location when app is minimized
- **Foreground Service**: Uses Android foreground service for reliability
- **Auto Trip ID**: Generates UUID if trip ID not provided
- **Persistent Storage**: Locations survive app restarts
- **Permission Management**: Checks for all required permissions
- **Graceful Fallbacks**: Safe behavior when native module unavailable
- **TypeScript First**: Full type safety and IntelliSense support

### Requirements

- React Native 0.70 or higher
- Android API 21+ (Android 5.0 Lollipop)
- Google Play Services Location 21.3.0

### Known Limitations

- iOS support not yet implemented (Android only)
- Location update intervals are not yet configurable
- No event emitters for real-time location updates
- Storage limited to SharedPreferences (consider SQLite for large datasets)

[0.15.1]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.15.1
[0.15.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.15.0
[0.14.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.14.0
[0.13.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.13.0
[0.12.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.12.0
[0.11.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.11.0
[0.10.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.10.0
[0.9.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.9.0
[0.8.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.8.0
[0.7.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.7.0
[0.6.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.6.0
[0.5.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.5.0
[0.4.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.4.0
[0.3.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.3.0
[0.2.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.2.0
[0.1.0]: https://github.com/gabriel-sisjr/react-native-background-location/releases/tag/v0.1.0
