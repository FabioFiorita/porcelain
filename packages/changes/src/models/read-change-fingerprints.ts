import type { ChangeComparison } from '@porcelain/kernel/models';
import type { ChangeFingerprints } from './change-fingerprints.ts';

export type ReadChangeFingerprintsInput = {
  worktreeId: string;
  comparisons: readonly ChangeComparison[];
  paths: readonly string[] | undefined;
};

export type ReadChangeFingerprintsResult = ChangeFingerprints;

export type ReadChangeFingerprintsOptions = {
  maxDigestBytes: number;
  maxPathLength: number;
};
