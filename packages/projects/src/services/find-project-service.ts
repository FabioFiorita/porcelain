import { Effect, Context, Layer } from 'effect';
import {
  type FindProjectInput,
  type FindProjectResult,
} from '../models/find-project.ts';
import { InventoryStore } from '../ports/inventory-store.ts';

export class FindProjectService extends Context.Service<
  FindProjectService,
  {
    readonly execute: (
      input: FindProjectInput,
    ) => Effect.Effect<FindProjectResult, never>;
  }
>()('@porcelain/projects/FindProjectService') {
  static readonly layer = Layer.effect(
    FindProjectService,
    Effect.gen(function* () {
      const inventoryCapability = yield* InventoryStore;

      return {
        execute: Effect.fn('FindProjectService.execute')(function* (
          input: FindProjectInput,
        ): Effect.fn.Return<FindProjectResult, never> {
          const project = yield* inventoryCapability.find({
            projectId: input.projectId,
          });
          return project ? { kind: 'found', project } : { kind: 'missing' };
        }),
      };
    }),
  );
}
