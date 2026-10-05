import { Effect, Context, Layer } from 'effect';
import {
  type ListProjectWorktreesInput,
  type ListProjectWorktreesResult,
} from '../models/list-project-worktrees.ts';
import { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { WorktreeListingReader } from '../ports/worktree-listing-reader.ts';
import { repositoryMoved } from '../rules/repository-moved.ts';
import { unavailableWorktrees } from '../rules/unavailable-worktrees.ts';

export class ListProjectWorktreesService extends Context.Service<
  ListProjectWorktreesService,
  {
    readonly execute: (
      input: ListProjectWorktreesInput,
    ) => Effect.Effect<ListProjectWorktreesResult, never>;
  }
>()('@porcelain/projects/ListProjectWorktreesService') {
  static readonly layer = Layer.effect(
    ListProjectWorktreesService,
    Effect.gen(function* () {
      const worktreeListingCapability = yield* WorktreeListingReader;
      const worktreeCatalogCapability = yield* WorktreeCatalogStore;

      return {
        execute: Effect.fn('ListProjectWorktreesService.execute')(function* (
          input: ListProjectWorktreesInput,
        ): Effect.fn.Return<ListProjectWorktreesResult, never> {
          const listing = yield* worktreeListingCapability.list(input.project);
          if (
            listing.kind === 'listed' &&
            !repositoryMoved(input.project, listing)
          )
            return {
              projectId: listing.projectId,
              available: true,
              complete: listing.unidentified === 0,
              worktrees: listing.worktrees,
            };
          return {
            projectId: listing.projectId,
            available: false,
            complete: false,
            worktrees: unavailableWorktrees(
              worktreeCatalogCapability.lastSeen({
                projectId: listing.projectId,
              }),
            ),
          };
        }),
      };
    }),
  );
}
