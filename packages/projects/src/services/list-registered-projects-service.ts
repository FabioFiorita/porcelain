import { Effect, Context, Layer } from 'effect';
import { type ListRegisteredProjectsResult } from '../models/list-registered-projects.ts';
import { InventoryStore } from '../ports/inventory-store.ts';

export class ListRegisteredProjectsService extends Context.Service<
  ListRegisteredProjectsService,
  { readonly execute: () => Effect.Effect<ListRegisteredProjectsResult, never> }
>()('@porcelain/projects/ListRegisteredProjectsService') {
  static readonly layer = Layer.effect(
    ListRegisteredProjectsService,
    Effect.gen(function* () {
      const inventoryCapability = yield* InventoryStore;

      return {
        execute: Effect.fn('ListRegisteredProjectsService.execute')(
          function* (): Effect.fn.Return<ListRegisteredProjectsResult, never> {
            return yield* inventoryCapability.read();
          },
        ),
      };
    }),
  );
}
