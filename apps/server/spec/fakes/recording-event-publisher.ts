import type { GitActionReceiptView } from '@porcelain/git-actions/models';
import type {
  EventPublisher,
  FilesChangedNotice,
  ProjectChangedNotice,
  WorktreeChangedNotice,
} from '../../src/ports/event-publisher.ts';

export class RecordingEventPublisher implements EventPublisher {
  private readonly files = new Map<string, readonly string[]>();
  private readonly worktrees = new Map<string, string>();

  inventoryChanged(): void {}

  projectChanged(_input: ProjectChangedNotice): void {}

  worktreeChanged(input: WorktreeChangedNotice): void {
    this.worktrees.set(input.worktreeId, input.change);
  }

  filesChanged(input: FilesChangedNotice): void {
    this.files.set(input.worktreeId, input.paths);
  }

  gitActionChanged(_input: GitActionReceiptView): void {}

  announcedFiles(worktreeId: string): readonly string[] | undefined {
    return this.files.get(worktreeId);
  }

  announcedChange(worktreeId: string): string | undefined {
    return this.worktrees.get(worktreeId);
  }
}
