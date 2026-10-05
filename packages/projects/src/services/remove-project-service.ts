import { Effect, Context, Layer } from 'effect';
import {
  type RemoveProjectInput,
  type RemoveProjectResult,
} from '../models/remove-project.ts';
import { InventoryStore } from '../ports/inventory-store.ts';

export class RemoveProjectService extends Context.Service<
  RemoveProjectService,
  {
    readonly execute: (
      input: RemoveProjectInput,
    ) => Effect.Effect<RemoveProjectResult, never>;
  }
>()('@porcelain/projects/RemoveProjectService') {
  static readonly layer = Layer.effect(
    RemoveProjectService,
    Effect.gen(function* () {
      const inventoryCapability = yield* InventoryStore;

      return {
        execute: Effect.fn('RemoveProjectService.execute')(function* (
          input: RemoveProjectInput,
        ): Effect.fn.Return<RemoveProjectResult, never> {
          const { projectId } = input;
          if (!(yield* inventoryCapability.find({ projectId })))
            return { deleted: false };
          yield* inventoryCapability.remove({ projectId });
          return { deleted: true };
        }),
      };
    }),
  );
}
