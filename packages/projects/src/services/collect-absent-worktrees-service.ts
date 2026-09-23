import type { CollectAbsentWorktreesResult } from '../models/inventory-operations.ts';
import { presenceCutoff } from '../rules/presence-cutoff.ts';
import type { Clock } from '../ports/clock.ts';
import type { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';

export class CollectAbsentWorktreesService {
  private readonly worktreePresenceStore: WorktreePresenceStore;
  private readonly clock: Clock;

  constructor(worktreePresenceStore: WorktreePresenceStore, clock: Clock) {
    this.worktreePresenceStore = worktreePresenceStore;
    this.clock = clock;
  }

  execute(input: Record<never, never>): CollectAbsentWorktreesResult {
    void input;
    const expired = this.worktreePresenceStore.expired(
      presenceCutoff(this.clock.now()),
    );
    this.worktreePresenceStore.collect(expired);
    return { collected: expired };
  }
}
