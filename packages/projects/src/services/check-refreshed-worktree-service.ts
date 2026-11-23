import { Effect, Context, Layer } from 'effect';
import type { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import {
  type CheckRefreshedWorktreeResult,
  type CheckWorktreeInput,
} from '../models/check-worktree.ts';
import { InventoryStore } from '../ports/inventory-store.ts';
import { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { lookupCheckedWorktree } from './lookup-checked-worktree.ts';

export class CheckRefreshedWorktreeService extends Context.Service<
  CheckRefreshedWorktreeService,
  {
    readonly execute: (
      input: CheckWorktreeInput,
    ) => Effect.Effect<
      CheckRefreshedWorktreeResult,
      WorktreeNotFoundError | WorktreeUnavailableError
    >;
  }
>()('@porcelain/projects/CheckRefreshedWorktreeService') {
  static readonly layer = Layer.effect(
    CheckRefreshedWorktreeService,
    Effect.gen(function* () {
      const catalogCapability = yield* WorktreeCatalogStore;
      const inventoryCapability = yield* InventoryStore;

      return {
        execute: Effect.fn('CheckRefreshedWorktreeService.execute')(function* (
          input: CheckWorktreeInput,
        ): Effect.fn.Return<
          CheckRefreshedWorktreeResult,
          WorktreeNotFoundError | WorktreeUnavailableError
        > {
          const answer = yield* lookupCheckedWorktree(
            input,
            catalogCapability,
            inventoryCapability,
          );
          if (answer.kind === 'found') return answer.worktree;
          return yield* new WorktreeUnavailableError();
        }),
      };
    }),
  );
}
