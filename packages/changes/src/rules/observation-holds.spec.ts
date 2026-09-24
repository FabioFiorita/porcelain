import { describe, expect, it } from 'vitest';
import { observationHolds } from './observation-holds.ts';
import { fileChange, modified } from '../../spec/fakes/comparisons.ts';

const token = 't'.repeat(64);
const fingerprint = 'f'.repeat(64);
const observation = {
  changes: [
    fileChange('a.md', [modified('unstaged', 'a.md')], fingerprint),
    fileChange('b.md', [modified('unstaged', 'b.md')]),
  ],
  stamp: 'stamp-1',
};
const input = {
  expectedStatusToken: token,
  expectedFiles: [
    { path: 'a.md', fingerprint },
    { path: 'b.md', fingerprint: undefined },
  ],
  statusToken: token,
  fingerprints: observation,
  previousStamp: undefined,
};

describe('observationHolds', () => {
  it('holds for an observation that matches what the reviewer saw, including unfingerprinted files', () => {
    expect(observationHolds(input)).toBe(true);
  });

  it('does not hold when the status token differs', () => {
    expect(observationHolds({ ...input, statusToken: 'u'.repeat(64) })).toBe(
      false,
    );
  });

  it('does not hold when a fingerprint differs', () => {
    expect(
      observationHolds({
        ...input,
        expectedFiles: [{ path: 'a.md', fingerprint: 'e'.repeat(64) }],
      }),
    ).toBe(false);
  });

  it('does not hold when a stated file lost its fingerprint', () => {
    expect(
      observationHolds({
        ...input,
        expectedFiles: [{ path: 'b.md', fingerprint }],
      }),
    ).toBe(false);
  });

  it('does not hold when the files were touched since the earlier observation', () => {
    expect(observationHolds({ ...input, previousStamp: 'stamp-0' })).toBe(
      false,
    );
  });

  it('holds with an unchanged stamp on the second observation', () => {
    expect(observationHolds({ ...input, previousStamp: 'stamp-1' })).toBe(true);
  });
});
