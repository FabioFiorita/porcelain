import { CheckWorktreeOptions } from '../ports/check-worktree-options.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import type { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import type { WorktreeUnavailableError } from '../errors/worktree-unavailable-error.ts';
import {
  type CheckWorktreeInput,
  type CheckWorktreeResult,
} from '../models/check-worktree.ts';
import { InventoryStore } from '../ports/inventory-store.ts';
import { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { lookupCheckedWorktree } from './lookup-checked-worktree.ts';

export class CheckWorktreeService extends Context.Service<
  CheckWorktreeService,
  {
    readonly execute: (
      input: CheckWorktreeInput,
    ) => Effect.Effect<
      CheckWorktreeResult,
      WorktreeNotFoundError | WorktreeUnavailableError
    >;
  }
>()('@porcelain/projects/CheckWorktreeService') {
  static readonly layer = Layer.effect(
    CheckWorktreeService,
    Effect.gen(function* () {
      const catalogCapability = yield* WorktreeCatalogStore;
      const inventoryCapability = yield* InventoryStore;
      const clockCapability = yield* Clock.Clock;
      const optionsCapability = yield* CheckWorktreeOptions;

      return {
        execute: Effect.fn('CheckWorktreeService.execute')(function* (
          input: CheckWorktreeInput,
        ): Effect.fn.Return<
          CheckWorktreeResult,
          WorktreeNotFoundError | WorktreeUnavailableError
        > {
          return yield* lookupCheckedWorktree(
            input,
            catalogCapability,
            inventoryCapability,
            clockCapability.currentTimeMillis.pipe(
              Effect.map((time) => ({
                now: DateTime.formatIso(DateTime.makeUnsafe(time)),
                staleAfterMs: optionsCapability.staleAfterMs,
              })),
            ),
          );
        }),
      };
    }),
  );
}
