import { Effect } from 'effect';
import type { RecordedWorktreesResult } from '../models/collect-absent-worktrees.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';
import type { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';
import { recordedWorktrees } from '../rules/worktree-presence.ts';

export class ListRecordedWorktreesService {
  private readonly worktreePresence: WorktreePresenceStore;
  private readonly inventory: InventoryStore;

  constructor(
    worktreePresence: WorktreePresenceStore,
    inventory: InventoryStore,
  ) {
    this.worktreePresence = worktreePresence;
    this.inventory = inventory;
  }

  execute(): Effect.Effect<RecordedWorktreesResult, never> {
    return Effect.sync(() => {
      return {
        worktrees: recordedWorktrees(
          this.worktreePresence.list(),
          this.inventory.read().projects,
        ),
      };
    });
  }
}
