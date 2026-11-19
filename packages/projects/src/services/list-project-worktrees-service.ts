import { Effect, Context, Layer } from 'effect';
import {
  type ListProjectWorktreesInput,
  type ListProjectWorktreesResult,
} from '../models/list-project-worktrees.ts';
import { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import { WorktreeListingReader } from '../ports/worktree-listing-reader.ts';
import { repositoryMoved } from '../rules/repository-moved.ts';
import { unavailableWorktrees } from '../rules/unavailable-worktrees.ts';
import { carryWorktreeActivity } from '../rules/worktree-activity.ts';

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
          const previous = worktreeCatalogCapability
            .lastSeen({ projectId: listing.projectId })
            .filter((worktree) => !repositoryMoved(input.project, worktree));
          const moved =
            listing.kind !== 'unavailable' &&
            repositoryMoved(input.project, listing);
          if (listing.kind === 'listed' && !moved) {
            const complete = listing.unidentified === 0;
            const worktrees = carryWorktreeActivity(
              listing.worktrees,
              previous,
            );
            return {
              projectId: listing.projectId,
              available: true,
              complete,
              worktrees: complete
                ? worktrees
                : [
                    ...worktrees,
                    ...previous.filter(
                      (known) =>
                        !worktrees.some((worktree) => worktree.id === known.id),
                    ),
                  ],
            };
          }
          const observation = worktreeCatalogCapability
            .listObservations()
            .find(
              (entry) =>
                entry.id === listing.projectId &&
                !repositoryMoved(input.project, entry),
            );
          if (
            listing.kind === 'inconclusive' &&
            !moved &&
            observation?.available
          )
            return {
              projectId: listing.projectId,
              available: true,
              complete: false,
              worktrees: previous,
            };
          return {
            projectId: listing.projectId,
            available: false,
            unavailableReason: moved
              ? 'moved'
              : listing.kind === 'unavailable'
                ? listing.reason
                : (observation?.unavailableReason ?? 'git-failed'),
            complete: false,
            worktrees: unavailableWorktrees(previous),
          };
        }),
      };
    }),
  );
}
