import { Effect } from 'effect';
import { InvalidPackageVersionError } from './errors/invalid-package-version-error.ts';

type ParsedVersion = { numbers: number[]; prerelease: string[] | undefined };

const versionPattern =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

const parseVersion = Effect.fn('Installer.parseVersion')(function* (
  value: string,
) {
  const matched = versionPattern.exec(value);
  if (!matched)
    return yield* Effect.fail(
      new InvalidPackageVersionError({ version: value }),
    );
  return {
    numbers: [Number(matched[1]), Number(matched[2]), Number(matched[3])],
    prerelease: matched[4]?.split('.'),
  } satisfies ParsedVersion;
});

function comparePrerelease(left: string, right: string): number {
  const leftNumber = /^\d+$/.test(left) ? Number(left) : undefined;
  const rightNumber = /^\d+$/.test(right) ? Number(right) : undefined;
  if (leftNumber !== undefined && rightNumber !== undefined)
    return Math.sign(leftNumber - rightNumber);
  if (leftNumber !== undefined) return -1;
  if (rightNumber !== undefined) return 1;
  return left < right ? -1 : 1;
}

export const compareVersions = Effect.fn('Installer.compareVersions')(
  function* (left: string, right: string) {
    const a = yield* parseVersion(left);
    const b = yield* parseVersion(right);
    for (let index = 0; index < a.numbers.length; index++) {
      const difference = (a.numbers[index] ?? 0) - (b.numbers[index] ?? 0);
      if (difference !== 0) return Math.sign(difference);
    }
    if (!a.prerelease && !b.prerelease) return 0;
    if (!a.prerelease) return 1;
    if (!b.prerelease) return -1;
    const length = Math.max(a.prerelease.length, b.prerelease.length);
    for (let index = 0; index < length; index++) {
      const av = a.prerelease[index];
      const bv = b.prerelease[index];
      if (av === undefined) return -1;
      if (bv === undefined) return 1;
      if (av !== bv) return comparePrerelease(av, bv);
    }
    return 0;
  },
);

export function isVersion(value: string): boolean {
  return versionPattern.test(value);
}

export const isDowngrade = Effect.fn('Installer.isDowngrade')(
  (candidate: string, installed: string) =>
    compareVersions(candidate, installed).pipe(
      Effect.map((comparison) => comparison < 0),
    ),
);
