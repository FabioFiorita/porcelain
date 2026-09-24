import type { ExpectedFile } from '../models/change.ts';

export function expectationHolds(
  expected: readonly ExpectedFile[],
  current: ReadonlyMap<string, string | undefined>,
): boolean {
  return expected.every((file) => current.get(file.path) === file.fingerprint);
}
