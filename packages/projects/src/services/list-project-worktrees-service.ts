import { Effect } from 'effect';
import type {
  ListProjectWorktreesInput,
  ListProjectWorktreesResult,
} from '../models/list-project-worktrees.ts';
import type { WorktreeCatalogStore } from '../ports/worktree-catalog-store.ts';
import type { WorktreeListingReader } from '../ports/worktree-listing-reader.ts';
import { repositoryMoved } from '../rules/repository-moved.ts';
import { unavailableWorktrees } from '../rules/unavailable-worktrees.ts';

export class ListProjectWorktreesService {
  private readonly worktreeListing: WorktreeListingReader;
  private readonly worktreeCatalog: WorktreeCatalogStore;

  constructor(
    worktreeListing: WorktreeListingReader,
    worktreeCatalog: WorktreeCatalogStore,
  ) {
    this.worktreeListing = worktreeListing;
    this.worktreeCatalog = worktreeCatalog;
  }

  execute(
    input: ListProjectWorktreesInput,
  ): Effect.Effect<ListProjectWorktreesResult, never> {
    return Effect.gen({ self: this }, function* () {
      const listing = yield* this.worktreeListing.list(input.project);
      if (listing.kind === 'listed' && !repositoryMoved(input.project, listing))
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
          this.worktreeCatalog.lastSeen({ projectId: listing.projectId }),
        ),
      };
    });
  }
}
