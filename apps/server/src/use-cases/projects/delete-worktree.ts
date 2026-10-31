import { Context, Effect, Layer } from 'effect';
import type {
  DeleteWorktreeRequest,
  DeleteWorktreeResponse,
} from '@porcelain/contracts/projects';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { WorktreeCleanupRefusedError } from '@porcelain/git-actions/errors';
import { DeleteWorktreeService } from '@porcelain/git-actions/services';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import { InventoryScan } from '../../ports/inventory-scan.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
export class DeleteWorktreeUseCase extends Context.Service<
  DeleteWorktreeUseCase,
  {
    readonly execute: (
      input: WorktreeParams & DeleteWorktreeRequest,
    ) => Effect.Effect<
      DeleteWorktreeResponse,
      WorktreeAccessFailure | WorktreeCleanupRefusedError
    >;
  }
>()('@porcelain/server/DeleteWorktreeUseCase') {
  static readonly layer = Layer.effect(
    DeleteWorktreeUseCase,
    Effect.gen(function* () {
      const access = yield* WorktreeAccess;
      const remove = yield* DeleteWorktreeService;
      const inventory = yield* InventoryScan;
      const events = yield* EventPublisher;
      return {
        execute: Effect.fn('DeleteWorktreeUseCase.execute')(function* (input) {
          const result = yield* access
            .write(input.worktreeId, (worktree) =>
              remove.execute({ ...input, worktree }),
            )
            .pipe(
              Effect.onError(() =>
                input.confirmation
                  ? Effect.andThen(
                      inventory.execute().pipe(Effect.ignore),
                      events.inventoryChanged(),
                    )
                  : Effect.void,
              ),
            );
          if (result.deleted) {
            yield* inventory.execute();
            yield* events.inventoryChanged();
          }
          return result;
        }),
      };
    }),
  );
}
