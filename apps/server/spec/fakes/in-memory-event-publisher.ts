import type { GitActionReceiptView } from '@porcelain/git-actions/models';
import type { EventPublisher } from '../../src/ports/event-publisher.ts';

export class InMemoryEventPublisher implements EventPublisher {
  private readonly files = new Map<string, readonly string[]>();
  private readonly worktrees = new Map<string, string>();

  inventoryChanged(): void {}

  projectChanged(_projectId: string, _change: 'preferences'): void {}

  worktreeChanged(
    worktreeId: string,
    change: 'review' | 'reviewed' | 'comments' | 'git',
  ): void {
    this.worktrees.set(worktreeId, change);
  }

  filesChanged(worktreeId: string, paths: readonly string[]): void {
    this.files.set(worktreeId, paths);
  }

  gitActionChanged(_receipt: GitActionReceiptView): void {}

  announcedFiles(worktreeId: string): readonly string[] | undefined {
    return this.files.get(worktreeId);
  }

  announcedChange(worktreeId: string): string | undefined {
    return this.worktrees.get(worktreeId);
  }
}
