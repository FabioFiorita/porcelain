import type { GitActionReceiptView } from '@porcelain/git-actions/models';

export type ProjectChangedNotice = {
  projectId: string;
  change: 'preferences';
};

export type WorktreeChangedNotice = {
  worktreeId: string;
  change: 'review' | 'reviewed' | 'comments' | 'git';
};

export type FilesChangedNotice = {
  worktreeId: string;
  paths: readonly string[];
};

export interface EventPublisher {
  inventoryChanged(): void;
  projectChanged(input: ProjectChangedNotice): void;
  worktreeChanged(input: WorktreeChangedNotice): void;
  filesChanged(input: FilesChangedNotice): void;
  gitActionChanged(input: GitActionReceiptView): void;
}
