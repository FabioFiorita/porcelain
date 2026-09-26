import type { WorktreeKeys } from '@porcelain/kernel/models';
import type { Clock } from '@porcelain/kernel/ports';
import type {
  CollectAbsentWorktreesOptions,
  CollectAbsentWorktreesResult,
} from '../models/collect-absent-worktrees.ts';
import type { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';
import { expired } from '../rules/worktree-presence.ts';

export class CollectAbsentWorktreesService {
  private readonly worktreePresence: WorktreePresenceStore;
  private readonly clock: Clock;
  private readonly options: CollectAbsentWorktreesOptions;

  constructor(
    worktreePresence: WorktreePresenceStore,
    clock: Clock,
    options: CollectAbsentWorktreesOptions,
  ) {
    this.worktreePresence = worktreePresence;
    this.clock = clock;
    this.options = options;
  }

  execute(input: WorktreeKeys): CollectAbsentWorktreesResult {
    const named = new Set(input.worktreeIds);
    const collected = expired(
      this.worktreePresence.list().filter((row) => named.has(row.worktreeId)),
      this.clock.now(),
      this.options.graceMs,
    );
    this.worktreePresence.remove({ worktreeIds: collected });
    return { collected };
  }
}
