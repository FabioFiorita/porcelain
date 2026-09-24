import type {
  AnnounceWorktreeChangeUseCasePort,
  WorktreeChange,
} from '../../src/ports/announce-worktree-change-use-case-port.ts';

export class RecordingWorktreeChanges implements AnnounceWorktreeChangeUseCasePort {
  private readonly changes = new Map<string, WorktreeChange>();

  async execute(input: WorktreeChange): Promise<void> {
    this.changes.set(input.worktreeId, input);
  }

  announced(worktreeId: string): WorktreeChange | undefined {
    return this.changes.get(worktreeId);
  }
}
