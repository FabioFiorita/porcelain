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

  execute(): CollectAbsentWorktreesResult {
    const collected = expired(
      this.worktreePresence.list(),
      this.clock.now(),
      this.options.graceMs,
    );
    this.worktreePresence.remove({ worktreeIds: collected });
    return { collected };
  }
}
