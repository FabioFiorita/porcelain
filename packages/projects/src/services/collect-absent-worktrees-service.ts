import type { Clock } from '@porcelain/kernel/ports';
import type { CollectAbsentWorktreesResult } from '../models/inventory-operations.ts';
import { presenceCutoff } from '../rules/presence-cutoff.ts';
import type { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';

export class CollectAbsentWorktreesService {
  private readonly worktreePresenceStore: WorktreePresenceStore;
  private readonly clock: Clock;

  constructor(worktreePresenceStore: WorktreePresenceStore, clock: Clock) {
    this.worktreePresenceStore = worktreePresenceStore;
    this.clock = clock;
  }

  execute(): CollectAbsentWorktreesResult {
    const expired = this.worktreePresenceStore.expired(
      presenceCutoff(this.clock.now()),
    );
    this.worktreePresenceStore.collect(expired);
    return { collected: expired };
  }
}
