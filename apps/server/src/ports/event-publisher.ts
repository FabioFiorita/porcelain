import type { GitActionReceiptView } from '@porcelain/git-actions/models';

export type JobName =
  | 'startup'
  | 'collect-absent-worktrees'
  | 'flush-device-activity'
  | 'refresh-inventory'
  | 'watch-worktrees';

export interface EventPublisher {
  inventoryChanged(): void;
  projectChanged(projectId: string, change: 'preferences'): void;
  worktreeChanged(
    worktreeId: string,
    change: 'review' | 'reviewed' | 'comments' | 'git',
  ): void;
  filesChanged(worktreeId: string, paths: readonly string[]): void;
  gitActionChanged(receipt: GitActionReceiptView): void;
  gitActionFailed(receipt: GitActionReceiptView, error: unknown): void;
  jobFailed(job: JobName, error: unknown): void;
}
