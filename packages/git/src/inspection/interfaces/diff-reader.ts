import type { GitDiffResult } from '../dtos/git-diff.ts';
import type { GitOrdinaryChange } from '../dtos/git-status.ts';

export type DiffReader = {
  readDiff(
    change: GitOrdinaryChange,
    signal?: AbortSignal,
  ): Promise<GitDiffResult>;
  readDiffs(
    changes: readonly GitOrdinaryChange[],
    signal?: AbortSignal,
  ): Promise<GitDiffResult[]>;
};
