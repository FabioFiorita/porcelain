import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { Clock } from '@porcelain/kernel/ports';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import type {
  CheckWorktreeInput,
  CheckWorktreeOptions,
  CheckWorktreeResult,
} from '../models/check-worktree.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';
import type { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { checkedWorktree } from '../rules/checked-worktree.ts';

export class CheckWorktreeService {
  private readonly catalog: WorktreeCatalogStore;
  private readonly inventory: InventoryStore;
  private readonly clock: Clock;
  private readonly options: CheckWorktreeOptions;

  constructor(
    catalog: WorktreeCatalogStore,
    inventory: InventoryStore,
    clock: Clock,
    options: CheckWorktreeOptions,
  ) {
    this.catalog = catalog;
    this.inventory = inventory;
    this.clock = clock;
    this.options = options;
  }

  execute(input: CheckWorktreeInput): CheckWorktreeResult {
    const entry = this.catalog.find({ worktreeId: input.worktreeId });
    const answer = checkedWorktree(
      input,
      entry,
      this.catalog.observations(),
      entry && input.requireAvailableProject
        ? this.inventory.find({ projectId: entry.worktree.projectId })
        : undefined,
      { now: this.clock.now(), staleAfterMs: this.options.staleAfterMs },
    );
    if (answer.kind === 'missing') throw new WorktreeNotFoundError();
    if (answer.kind === 'unavailable') throw new WorktreeUnavailableError();
    return answer;
  }
}
