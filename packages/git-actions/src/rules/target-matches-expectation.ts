import type { FileChange } from '@porcelain/kernel/models';
import { expectationHolds } from '@porcelain/kernel/rules';
import type { FingerprintedFile } from '../models/fingerprinted-file.ts';

export function targetMatchesExpectation(
  expected: readonly FingerprintedFile[],
  changes: readonly FileChange[],
  wholeChangeList: boolean,
): boolean {
  const current = new Map(
    changes.map((change) => [change.path, change.fingerprint]),
  );
  return (
    expectationHolds(expected, current) &&
    (!wholeChangeList || current.size === expected.length)
  );
}
