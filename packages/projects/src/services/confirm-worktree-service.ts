import { Effect } from 'effect';
import { WorktreeChangedError } from '@porcelain/kernel/errors';
import type { ConfirmWorktreeInput } from '../models/check-worktree.ts';
import type { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { sameWorktree } from '../rules/same-worktree.ts';

export class ConfirmWorktreeService {
  private readonly catalog: WorktreeCatalogStore;

  constructor(catalog: WorktreeCatalogStore) {
    this.catalog = catalog;
  }

  execute(
    input: ConfirmWorktreeInput,
  ): Effect.Effect<void, WorktreeChangedError> {
    return Effect.gen({ self: this }, function* () {
      const current = this.catalog.find({ worktreeId: input.worktree.id });
      if (!sameWorktree(input.worktree, current?.worktree))
        return yield* Effect.fail(new WorktreeChangedError());
    });
  }
}
