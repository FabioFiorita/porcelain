import type { ChangeComparison, WorktreeSide } from '../models/change.ts';
import type { ChangeDiffContent } from '../models/change-diff.ts';
import type {
  ChangeBranchStatus,
  ChangeStatusObservation,
} from '../models/status-observation.ts';

export type ObservedSides = {
  sides: Map<string, WorktreeSide>;
  stamps: Map<string, string>;
};

export interface ChangeInspectionReader {
  readonly missingFingerprint: null;
  readStatus(signal?: AbortSignal): Promise<{
    environmentId: string;
    status: Omit<
      ChangeStatusObservation,
      'inProgress' | 'mergeHeadOid' | 'branch'
    > & {
      inProgress: 'merge' | 'rebase' | null;
      mergeHeadOid: string | null;
      branch: ChangeBranchStatus | null;
    };
  }>;
  observeSides(
    changes: readonly ChangeComparison[],
    signal?: AbortSignal,
  ): Promise<ObservedSides>;
  readDiffs(
    changes: readonly Extract<
      ChangeComparison,
      { scope: 'staged' | 'unstaged' }
    >[],
    signal?: AbortSignal,
  ): Promise<ChangeDiffContent[]>;
  stampIndex(): Promise<string | null>;
  confirmReachable(worktreeId: string, signal?: AbortSignal): Promise<void>;
}
