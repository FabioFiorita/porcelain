import type { ExpectedFile, TrackedComparison } from '@porcelain/kernel/models';
import type { ChangeSelection } from './change-diff.ts';
import type { ChangeStatusObservation } from './change-status.ts';

export type DiffSelectionInput = {
  expectedFiles: readonly ExpectedFile[];
  selections: readonly ChangeSelection[];
  status: ChangeStatusObservation;
};

export type DiffSelection = {
  comparisons: TrackedComparison[];
  paths: string[];
};

export type DiffSelectionProblem =
  | { kind: 'unnamed-selection' }
  | { kind: 'selection-mismatch' }
  | { kind: 'worktree-changed' };
