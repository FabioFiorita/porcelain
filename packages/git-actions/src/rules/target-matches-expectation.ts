import type { ExpectedFile } from '@porcelain/kernel/models';

export function targetMatchesExpectation(
  expected: readonly ExpectedFile[],
  actual: ReadonlyMap<string, string | undefined>,
  wholeChangeList: boolean,
): boolean {
  return (
    expected.every((file) => actual.get(file.path) === file.fingerprint) &&
    (!wholeChangeList || actual.size === expected.length)
  );
}
