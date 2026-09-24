import type { ExpectedFile, TrackedComparison } from '@porcelain/kernel/models';
import type { ChangeSelection } from './change-diff.ts';
import type { ChangeStatusObservation } from './change-status.ts';

export type DiffComparisonsInput = {
  expectedFiles: readonly ExpectedFile[];
  selections: readonly ChangeSelection[];
  status: ChangeStatusObservation;
};

export type DiffComparisons =
  | { kind: 'selected'; comparisons: TrackedComparison[]; paths: string[] }
  | { kind: 'unnamed-selection' }
  | { kind: 'selection-mismatch' }
  | { kind: 'worktree-changed' };
