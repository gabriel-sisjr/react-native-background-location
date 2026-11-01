import * as fs from 'fs';
import * as path from 'path';
import type { LocationWarningType } from '../../types';

/**
 * Every member of `LocationWarningType`. Typing the object as
 * `Record<LocationWarningType, true>` makes `yarn typecheck` reject both a
 * missing member and a key that is not a member.
 */
const MEMBERS: Record<LocationWarningType, true> = {
  SERVICE_TIMEOUT: true,
  TASK_REMOVED: true,
  LOCATION_UNAVAILABLE: true,
  LOCATION_UPDATES_PAUSED: true,
  LOCATION_UPDATES_RESUMED: true,
  PERMISSION_REVOKED: true,
  PERMISSION_DOWNGRADED: true,
  MOTION_LOCATION_REDUCED: true,
  MOTION_LOCATION_RESTORED: true,
  MOTION_ACTIVITY_UNAVAILABLE: true,
  MOTION_PERMISSION_NOT_GRANTED: true,
};
const ALL_MEMBERS = Object.keys(MEMBERS) as LocationWarningType[];

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Recursively lists the files under `dir` whose name ends with `extension`. */
function collectFiles(dir: string, extension: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(fullPath, extension);
    }
    return entry.name.endsWith(extension) ? [fullPath] : [];
  });
}

interface NativeSource {
  file: string;
  contents: string;
}

const readSources = (files: string[]): NativeSource[] =>
  files.map((file) => ({
    file: path.relative(REPO_ROOT, file),
    contents: fs.readFileSync(file, 'utf8'),
  }));

const kotlinSources = readSources(
  collectFiles(path.join(REPO_ROOT, 'android', 'src', 'main'), '.kt')
);
const swiftSources = readSources(
  collectFiles(path.join(REPO_ROOT, 'ios'), '.swift')
);
const nativeSources = [...kotlinSources, ...swiftSources];

describe('LocationWarningType', () => {
  it('all 11 members are assignable (type level)', () => {
    const assignable: LocationWarningType[] = [
      'SERVICE_TIMEOUT',
      'TASK_REMOVED',
      'LOCATION_UNAVAILABLE',
      'LOCATION_UPDATES_PAUSED',
      'LOCATION_UPDATES_RESUMED',
      'PERMISSION_REVOKED',
      'PERMISSION_DOWNGRADED',
      'MOTION_LOCATION_REDUCED',
      'MOTION_LOCATION_RESTORED',
      'MOTION_ACTIVITY_UNAVAILABLE',
      'MOTION_PERMISSION_NOT_GRANTED',
    ];

    expect(assignable).toHaveLength(11);
    expect(ALL_MEMBERS).toHaveLength(11);
    expect([...assignable].sort()).toEqual([...ALL_MEMBERS].sort());
  });

  it('every member literal appears in the native sources', () => {
    expect(kotlinSources.length).toBeGreaterThan(0);
    expect(swiftSources.length).toBeGreaterThan(0);

    const missing = ALL_MEMBERS.filter(
      (member) =>
        !nativeSources.some(({ contents }) => contents.includes(`"${member}"`))
    );

    expect(missing).toEqual([]);
  });

  it('every "MOTION_[A-Z_]+" literal in android/src/main/**/*.kt and ios/**/*.swift is a member', () => {
    const members = new Set<string>(ALL_MEMBERS);
    const unknownLiterals: string[] = [];

    for (const { file, contents } of nativeSources) {
      for (const match of contents.matchAll(/"(MOTION_[A-Z_]+)"/g)) {
        const literal = match[1];
        if (literal !== undefined && !members.has(literal)) {
          unknownLiterals.push(`${file}: ${literal}`);
        }
      }
    }

    expect(unknownLiterals).toEqual([]);
  });
});
