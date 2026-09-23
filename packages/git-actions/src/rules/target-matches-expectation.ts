import type { ExpectedFile } from '../models/expected-file.ts';

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
