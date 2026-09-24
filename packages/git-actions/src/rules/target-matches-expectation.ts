import type { FileChange } from '@porcelain/kernel/models';
import type { FingerprintedFile } from '../models/fingerprinted-file.ts';

export function targetMatchesExpectation(
  expected: readonly FingerprintedFile[],
  changes: readonly FileChange[],
  wholeChangeList: boolean,
): boolean {
  const actual = new Map(
    changes.map((change) => [change.path, change.fingerprint]),
  );
  return (
    expected.every((file) => actual.get(file.path) === file.fingerprint) &&
    (!wholeChangeList || actual.size === expected.length)
  );
}
