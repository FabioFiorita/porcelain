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

  inventoryChanged(): Effect.Effect<void> {
    return Effect.void;
  }

  projectChanged(_input: ProjectChangedNotice): Effect.Effect<void> {
    return Effect.void;
  }

  worktreeChanged(input: WorktreeChangedNotice): Effect.Effect<void> {
    return Effect.sync(() => {
      this.worktrees.set(input.worktreeId, input.change);
    });
  }

  filesChanged(input: FilesChangedNotice): Effect.Effect<void> {
    return Effect.sync(() => {
      this.files.set(input.worktreeId, input.paths);
    });
  }

  gitActionChanged(_input: GitActionReceiptView): Effect.Effect<void> {
    return Effect.void;
  }

  announcedFiles(worktreeId: string): readonly string[] | undefined {
    return this.files.get(worktreeId);
  }

  announcedChange(worktreeId: string): string | undefined {
    return this.worktrees.get(worktreeId);
  }
}
import { Effect } from 'effect';
