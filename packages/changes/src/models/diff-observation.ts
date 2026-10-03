import type { ExpectedFile } from '@porcelain/kernel/models';
import type { ChangeFingerprints } from './change-fingerprints.ts';

export type DiffObservation = {
  expectedStatusToken: string;
  expectedFiles: readonly ExpectedFile[];
  statusToken: string;
  fingerprints: ChangeFingerprints;
  previousStamp: string | undefined;
};

export type ObservationProblem = { kind: 'worktree-changed' };
