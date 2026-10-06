import { Effect, Context, Layer } from 'effect';
import {
  type ListKnownWorktreesInput,
  type ListKnownWorktreesResult,
} from '../models/list-known-worktrees.ts';
import { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { unavailableWorktrees } from '../rules/unavailable-worktrees.ts';

export class ListKnownWorktreesService extends Context.Service<
  ListKnownWorktreesService,
  {
    readonly execute: (
      input: ListKnownWorktreesInput,
    ) => Effect.Effect<ListKnownWorktreesResult, never>;
  }
>()('@porcelain/projects/ListKnownWorktreesService') {
  static readonly layer = Layer.effect(
    ListKnownWorktreesService,
    Effect.gen(function* () {
      const worktreeCatalogCapability = yield* WorktreeCatalogStore;

      return {
        execute: Effect.fn('ListKnownWorktreesService.execute')(function* (
          input: ListKnownWorktreesInput,
        ): Effect.fn.Return<ListKnownWorktreesResult, never> {
          return yield* Effect.sync<ListKnownWorktreesResult>(() => {
            return {
              listings: input.projects.map((project) => {
                const worktrees = worktreeCatalogCapability.lastSeen({
                  projectId: project.id,
                });
                return {
                  projectId: project.id,
                  available: project.available,
                  worktrees: project.available
                    ? worktrees
                    : unavailableWorktrees(worktrees),
                };
              }),
            };
          });
        }),
      };
    }),
  );
}
