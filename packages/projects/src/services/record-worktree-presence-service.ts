import type { Clock } from '@porcelain/kernel/ports';
import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type { RecordWorktreePresenceInput } from '../models/record-worktree-presence.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';
import type { WorktreePresenceStore } from '../ports/worktree-presence-store.ts';
import { observed, sighted } from '../rules/worktree-presence.ts';

export class RecordWorktreePresenceService {
  private readonly inventory: InventoryStore;
  private readonly worktreePresence: WorktreePresenceStore;
  private readonly clock: Clock;

  constructor(
    inventory: InventoryStore,
    worktreePresence: WorktreePresenceStore,
    clock: Clock,
  ) {
    this.inventory = inventory;
    this.worktreePresence = worktreePresence;
    this.clock = clock;
  }

  execute(input: RecordWorktreePresenceInput): void {
    const { projectId, available, complete, worktrees } = input.worktrees;
    if (
      !this.inventory
        .read()
        .projects.some((project) => project.id === projectId)
    )
      throw new ProjectNotFoundError();
    if (!available) return;
    const rows = this.worktreePresence.read({ projectId });
    const presentIds = worktrees.map((worktree) => worktree.id);
    this.worktreePresence.save({
      rows: complete
        ? observed(rows, projectId, presentIds, this.clock.now())
        : sighted(rows, projectId, presentIds),
    });
  }
}
