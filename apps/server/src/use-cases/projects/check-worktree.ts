import { InventoryRefresh } from '../../ports/inventory-refresh.ts';
import { Effect, Context, Layer } from 'effect';
import { type WorktreeNotFoundError } from '@porcelain/kernel/errors';
import {
  type WorktreeUnavailableError,
  type ProjectNotFoundError,
} from '@porcelain/projects/errors';
import {
  type CheckWorktreeInput,
  type ListedWorktree,
} from '@porcelain/projects/models';
import {
  CheckRefreshedWorktreeService,
  CheckWorktreeService,
} from '@porcelain/projects/services';

export class CheckWorktreeUseCase extends Context.Service<
  CheckWorktreeUseCase,
  {
    readonly execute: (
      input: CheckWorktreeInput,
    ) => Effect.Effect<
      ListedWorktree,
      WorktreeNotFoundError | WorktreeUnavailableError | ProjectNotFoundError
    >;
  }
>()('@porcelain/server/CheckWorktreeUseCase') {
  static readonly layer = Layer.effect(
    CheckWorktreeUseCase,
    Effect.gen(function* () {
      const checkWorktreeCapability = yield* CheckWorktreeService;
      const checkRefreshedWorktreeCapability =
        yield* CheckRefreshedWorktreeService;
      const refreshInventoryCapability = yield* InventoryRefresh;

      return {
        execute: Effect.fn('CheckWorktreeUseCase.execute')(function* (
          input: CheckWorktreeInput,
        ): Effect.fn.Return<
          ListedWorktree,
          | WorktreeNotFoundError
          | WorktreeUnavailableError
          | ProjectNotFoundError
        > {
          const checked = yield* checkWorktreeCapability.execute(input);
          if (checked.kind === 'found') return checked.worktree;
          yield* refreshInventoryCapability.execute();
          return yield* checkRefreshedWorktreeCapability.execute(input);
        }),
      };
    }),
  );
}
