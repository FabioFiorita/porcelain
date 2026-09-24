import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { Clock } from '@porcelain/kernel/ports';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import type {
  CheckRefreshedWorktreeResult,
  CheckWorktreeInput,
  CheckWorktreeOptions,
} from '../models/check-worktree.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';
import type { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { checkedWorktree } from '../rules/checked-worktree.ts';

export class CheckRefreshedWorktreeService {
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

  execute(input: CheckWorktreeInput): CheckRefreshedWorktreeResult {
    const entry = this.catalog.find({ worktreeId: input.worktreeId });
    const answer = checkedWorktree(
      input,
      entry,
      this.catalog.observations(),
      entry && input.purpose === 'writing'
        ? this.inventory.find({ projectId: entry.worktree.projectId })
        : undefined,
      { now: this.clock.now(), staleAfterMs: this.options.staleAfterMs },
    );
    if (answer.kind === 'found') return answer.worktree;
    if (answer.kind === 'missing') throw new WorktreeNotFoundError();
    throw new WorktreeUnavailableError();
  }
}
