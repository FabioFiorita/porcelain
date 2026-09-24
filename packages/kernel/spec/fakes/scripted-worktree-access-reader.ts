import type {
  Worktree,
  WorktreeCheck,
  WorktreeKey,
} from '../../src/models/worktree.ts';
import type { WorktreeAccessReader } from '../../src/ports/worktree-access-reader.ts';

export class ScriptedWorktreeAccessReader<
  Found extends Worktree = Worktree,
> implements WorktreeAccessReader<Found> {
  private readonly checks: ReadonlyMap<string, WorktreeCheck<Found>>;

  constructor(
    worktrees: {
      found?: readonly Found[] | undefined;
      unreadable?: readonly string[] | undefined;
    } = {},
  ) {
    this.checks = new Map<string, WorktreeCheck<Found>>([
      ...(worktrees.unreadable ?? []).map(
        (worktreeId): [string, WorktreeCheck<Found>] => [
          worktreeId,
          { kind: 'unavailable' },
        ],
      ),
      ...(worktrees.found ?? []).map(
        (worktree): [string, WorktreeCheck<Found>] => [
          worktree.id,
          { kind: 'found', worktree },
        ],
      ),
    ]);
  }

  async known(input: WorktreeKey): Promise<WorktreeCheck<Found>> {
    return this.checks.get(input.worktreeId) ?? { kind: 'missing' };
  }
}
