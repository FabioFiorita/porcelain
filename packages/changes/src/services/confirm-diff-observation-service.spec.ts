import { describe, expect, it } from 'vitest';
import { WorktreeChangedError } from '@porcelain/kernel/errors';
import { fileChange, modified } from '../../spec/fakes/comparisons.ts';
import { ConfirmDiffObservationService } from './confirm-diff-observation-service.ts';

const token = 't'.repeat(64);
const fingerprint = 'f'.repeat(64);
const observation = {
  expectedStatusToken: token,
  expectedFiles: [{ path: 'a.md', fingerprint }],
  statusToken: token,
  fingerprints: {
    changes: [fileChange('a.md', [modified('unstaged', 'a.md')], fingerprint)],
    stamp: 'stamp-1',
  },
  previousStamp: undefined,
};
const service = new ConfirmDiffObservationService();

describe('ConfirmDiffObservationService', () => {
  it('accepts an observation that matches what the reviewer saw', () => {
    expect(() => service.execute(observation)).not.toThrow();
  });

  it('refuses an observation whose status token moved', () => {
    expect(() =>
      service.execute({ ...observation, statusToken: 'u'.repeat(64) }),
    ).toThrow(WorktreeChangedError);
  });

  it('refuses an observation taken after the files moved since the previous one', () => {
    expect(() =>
      service.execute({ ...observation, previousStamp: 'stamp-0' }),
    ).toThrow(WorktreeChangedError);
  });
});
