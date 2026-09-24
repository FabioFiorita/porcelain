import type { Clock } from '@porcelain/kernel/ports';
import type { RecordWorktreePresenceInput } from '../models/inventory-operations.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';
import type { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';

export class RecordWorktreePresenceService {
  private readonly inventoryStore: InventoryStore;
  private readonly worktreePresenceStore: WorktreePresenceStore;
  private readonly clock: Clock;

  constructor(
    inventoryStore: InventoryStore,
    worktreePresenceStore: WorktreePresenceStore,
    clock: Clock,
  ) {
    this.inventoryStore = inventoryStore;
    this.worktreePresenceStore = worktreePresenceStore;
    this.clock = clock;
  }

  execute(input: RecordWorktreePresenceInput): void {
    const { projectId, available, complete, worktrees } = input.worktrees;
    if (!available) return;
    if (
      !this.inventoryStore
        .read()
        .projects.some((project) => project.id === projectId)
    )
      return;
    const presentIds = worktrees.map((worktree) => worktree.id);
    if (complete)
      this.worktreePresenceStore.observe(
        projectId,
        presentIds,
        this.clock.now(),
      );
    else this.worktreePresenceStore.record(projectId, presentIds);
  }
}
