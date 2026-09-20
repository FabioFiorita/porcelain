import type { InspectionReader } from '@porcelain/git/interfaces/inspection-factory';

/**
 * An inspection reader for a test that cares about one or two of its reads.
 *
 * What the test does not name throws, so a read it did not expect fails the
 * test instead of quietly answering nothing — which is the failure a stub
 * returning an empty result would hide.
 */
export function fakeInspection(
  reads: Partial<InspectionReader>,
): InspectionReader {
  return {
    readStatus: unexpected('readStatus'),
    readDiff: unexpected('readDiff'),
    readDiffs: unexpected('readDiffs'),
    readSubmoduleHeads: unexpected('readSubmoduleHeads'),
    readBranchDetails: unexpected('readBranchDetails'),
    readLines: unexpected('readLines'),
    ...reads,
  };
}

function unexpected(name: string) {
  return () => {
    throw new Error(`Unexpected ${name} in this test`);
  };
}
