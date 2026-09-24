import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import type {
  CheckWorktreeInput,
  CheckWorktreeResult,
} from '../models/check-worktree.ts';
import type { ListedWorktree } from '../models/listed-worktree.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';
import { worktreeIsWritable } from '../rules/worktree-is-writable.ts';

export class CheckWorktreeService {
  private readonly worktreeAccess: WorktreeAccessReader<ListedWorktree>;
  private readonly inventory: InventoryStore;

  constructor(
    worktreeAccess: WorktreeAccessReader<ListedWorktree>,
    inventory: InventoryStore,
  ) {
    this.worktreeAccess = worktreeAccess;
    this.inventory = inventory;
  }

  async execute(
    input: CheckWorktreeInput,
    signal?: AbortSignal,
  ): Promise<CheckWorktreeResult> {
    const check = await this.worktreeAccess.known(
      { worktreeId: input.worktreeId },
      signal,
    );
    if (check.kind === 'missing') throw new WorktreeNotFoundError();
    if (check.kind === 'unavailable') throw new WorktreeUnavailableError();
    const { worktree } = check;
    if (input.projectId !== undefined && worktree.projectId !== input.projectId)
      throw new WorktreeNotFoundError();
    if (
      input.purpose === 'writing' &&
      !worktreeIsWritable(
        worktree,
        this.inventory.find({ projectId: worktree.projectId }),
      )
    )
      throw new WorktreeUnavailableError();
    return worktree;
  }
}
