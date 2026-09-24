import type { GitActionReceiptView } from '@porcelain/git-actions/models';

export interface EventPublisher {
  inventoryChanged(): void;
  projectChanged(projectId: string, change: 'preferences'): void;
  worktreeChanged(
    worktreeId: string,
    change: 'review' | 'reviewed' | 'comments' | 'git',
  ): void;
  filesChanged(worktreeId: string, paths: readonly string[]): void;
  gitActionChanged(receipt: GitActionReceiptView): void;
}
