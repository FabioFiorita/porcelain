import type { ExpectedFile } from '@porcelain/kernel/models';
import type { ChangeSelection, DiffSelection } from './change-diff.ts';
import type { ChangeStatusObservation } from './change-status.ts';

export type ReadDiffComparisonsInput = {
  expectedFiles: readonly ExpectedFile[];
  selections: readonly ChangeSelection[];
  status: ChangeStatusObservation;
};

export type ReadDiffComparisonsResult = DiffSelection;
