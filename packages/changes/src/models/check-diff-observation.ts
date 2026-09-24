import type { ExpectedFile } from '@porcelain/kernel/models';
import type { ChangeFingerprints } from './change-fingerprints.ts';

export type CheckDiffObservationInput = {
  expectedStatusToken: string;
  expectedFiles: readonly ExpectedFile[];
  statusToken: string;
  fingerprints: ChangeFingerprints;
  previousStamp: string | undefined;
};
