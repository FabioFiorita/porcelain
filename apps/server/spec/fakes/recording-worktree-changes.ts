import { Effect } from 'effect';
import type {
  AnnounceWorktreeChangeUseCasePort,
  WorktreeChange,
} from '../../src/ports/announce-worktree-change-use-case-port.ts';

export class RecordingWorktreeChanges implements AnnounceWorktreeChangeUseCasePort {
  private readonly changes = new Map<string, WorktreeChange>();
  private readonly history: WorktreeChange[] = [];

  execute(input: WorktreeChange): Effect.Effect<void> {
    return Effect.sync(() => {
      this.changes.set(input.worktreeId, input);
      this.history.push(input);
    });
  }

  announced(worktreeId: string): WorktreeChange | undefined {
    return this.changes.get(worktreeId);
  }

  all(): readonly WorktreeChange[] {
    return this.history;
  }
}
