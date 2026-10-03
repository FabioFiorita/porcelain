import type { Clock } from '@porcelain/kernel/ports';
import type {
  CollectAbsentWorktreesOptions,
  RecordedWorktreesResult,
} from '../models/collect-absent-worktrees.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';
import type { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';
import { expired, recordedWorktrees } from '../rules/worktree-presence.ts';

export class ListExpiredWorktreesService {
  private readonly worktreePresence: WorktreePresenceStore;
  private readonly inventory: InventoryStore;
  private readonly clock: Clock;
  private readonly options: CollectAbsentWorktreesOptions;

  constructor(
    worktreePresence: WorktreePresenceStore,
    inventory: InventoryStore,
    clock: Clock,
    options: CollectAbsentWorktreesOptions,
  ) {
    this.worktreePresence = worktreePresence;
    this.inventory = inventory;
    this.clock = clock;
    this.options = options;
  }

  execute(): RecordedWorktreesResult {
    const rows = this.worktreePresence.list();
    const expiredIds = new Set(
      expired(rows, this.clock.now(), this.options.graceMs),
    );
    return {
      worktrees: recordedWorktrees(
        rows.filter((row) => expiredIds.has(row.worktreeId)),
        this.inventory.read().projects,
      ),
    };
  }
}
