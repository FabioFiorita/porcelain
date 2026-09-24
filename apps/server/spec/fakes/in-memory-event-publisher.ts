import type { GitActionReceiptView } from '@porcelain/git-actions/models';
import type { EventPublisher } from '../../src/ports/event-publisher.ts';

export class InMemoryEventPublisher implements EventPublisher {
  readonly announcedFiles = new Map<string, number>();
  readonly worktreeChanges = new Map<string, string>();
  inventoryAnnouncements = 0;

  inventoryChanged(): void {
    this.inventoryAnnouncements += 1;
  }

  projectChanged(_projectId: string, _change: 'preferences'): void {}

  worktreeChanged(
    worktreeId: string,
    change: 'review' | 'reviewed' | 'comments' | 'git',
  ): void {
    this.worktreeChanges.set(worktreeId, change);
  }

  filesChanged(worktreeId: string, _paths: readonly string[]): void {
    this.announcedFiles.set(
      worktreeId,
      (this.announcedFiles.get(worktreeId) ?? 0) + 1,
    );
  }

  gitActionChanged(_receipt: GitActionReceiptView): void {}
}
