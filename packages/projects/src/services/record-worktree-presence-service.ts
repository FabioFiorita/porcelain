import type { RecordWorktreePresenceInput } from '../models/inventory-operations.ts';
import type { Clock } from '../ports/clock.ts';
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
    if (!available || !complete) return;
    if (
      !this.inventoryStore
        .read()
        .projects.some((project) => project.id === projectId)
    )
      return;
    this.worktreePresenceStore.observe(
      projectId,
      worktrees.map((worktree) => worktree.id),
      this.clock.now(),
    );
  }
}
