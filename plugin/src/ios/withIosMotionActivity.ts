import {
  WarningAggregator,
  withPodfile,
  type ConfigPlugin,
} from 'expo/config-plugins';

const WARNING_SCOPE = 'withIosMotionActivity';

/**
 * A line that already sets the flag, anywhere in the Podfile. When it is
 * present the Podfile is left as it is, which keeps the mod idempotent.
 */
const MOTION_ACTIVITY_FLAG_PATTERN =
  /^\s*\$BackgroundLocationMotionActivity\s*=\s*true\s*$/m;

/**
 * The first top-level `target '<name>' do` line. The flag is set before it,
 * so the global is already defined whenever CocoaPods evaluates
 * `BackgroundLocation.podspec`.
 */
const FIRST_TARGET_PATTERN = /^target\s+['"][^'"]+['"]\s+do\s*$/m;

/**
 * The text inserted before the first target: a comment, the Ruby global read
 * by `BackgroundLocation.podspec`, and a blank line.
 */
export const MOTION_ACTIVITY_PODFILE_SNIPPET =
  '# Motion activity (CoreMotion) for @gabriel-sisjr/react-native-background-location, added by its config plugin.\n' +
  '$BackgroundLocationMotionActivity = true\n' +
  '\n';

/**
 * Outcome of {@link addMotionActivityFlag}:
 * - `added`: the snippet was inserted before the first target;
 * - `present`: the Podfile already sets the flag, nothing changed;
 * - `no-anchor`: no `target '<name>' do` line was found, nothing changed.
 */
export type MotionActivityFlagStatus = 'added' | 'present' | 'no-anchor';

/**
 * Pure helper behind {@link withIosMotionActivity}: returns the Podfile
 * contents with `$BackgroundLocationMotionActivity = true` set before the
 * first target, and what happened. Never throws.
 */
export function addMotionActivityFlag(contents: string): {
  contents: string;
  status: MotionActivityFlagStatus;
} {
  if (MOTION_ACTIVITY_FLAG_PATTERN.test(contents)) {
    return { contents, status: 'present' };
  }

  const anchor = FIRST_TARGET_PATTERN.exec(contents);
  if (!anchor) {
    return { contents, status: 'no-anchor' };
  }

  return {
    contents:
      contents.slice(0, anchor.index) +
      MOTION_ACTIVITY_PODFILE_SNIPPET +
      contents.slice(anchor.index),
    status: 'added',
  };
}

/**
 * Turns on the iOS compile-time opt-in for motion activity.
 *
 * `BackgroundLocation.podspec` compiles the CoreMotion code (and links the
 * CoreMotion framework) only when the Podfile sets the Ruby global
 * `$BackgroundLocationMotionActivity = true` before any target. Registered
 * by `withBackgroundLocation` only when the `motionActivity` prop is present.
 *
 * When the Podfile has no `target '<name>' do` line, the file is left
 * unchanged and a prebuild warning explains the manual fix. The app still
 * builds; at runtime iOS then reports `MOTION_ACTIVITY_UNAVAILABLE` and
 * location tracking continues at full accuracy.
 *
 * The mod is idempotent. It never removes the line: dropping the prop later
 * requires `expo prebuild --clean`.
 */
export const withIosMotionActivity: ConfigPlugin = (config) => {
  return withPodfile(config, (cfg) => {
    const result = addMotionActivityFlag(cfg.modResults.contents);
    if (result.status === 'no-anchor') {
      WarningAggregator.addWarningIOS(
        WARNING_SCOPE,
        "No `target '<name>' do` line was found in ios/Podfile, so " +
          '`$BackgroundLocationMotionActivity = true` was not added. Add that ' +
          'line above the first target and run `pod install`. Until then, ' +
          'iOS reports MOTION_ACTIVITY_UNAVAILABLE and location tracking ' +
          'continues at full accuracy.'
      );
      return cfg;
    }
    cfg.modResults.contents = result.contents;
    return cfg;
  });
};
