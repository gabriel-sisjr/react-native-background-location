/**
 * Major version of the Expo SDK a project targets, read from the
 * `sdkVersion` Expo derives from the installed `expo` package at prebuild time
 * (`"54.0.0"` -> `54`). `undefined` for `UNVERSIONED`, missing or malformed
 * values, which callers must treat as "unknown", never as "old" or "new".
 */
export function getExpoSdkMajor(sdkVersion: unknown): number | undefined {
  if (typeof sdkVersion !== 'string') return undefined;
  const match = /^(\d+)\./.exec(sdkVersion);
  return match ? Number(match[1]) : undefined;
}
