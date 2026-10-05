import { Effect } from 'effect';
import type { ListableProject } from '../../src/models/project.ts';
import type { WorktreeListing } from '../../src/models/worktree-listing.ts';
import type { WorktreeListingReader } from '../../src/ports/worktree-listing-reader.ts';

export class ScriptedWorktreeListingReader implements WorktreeListingReader {
  private readonly listings = new Map<string, WorktreeListing>();

  answer(listing: WorktreeListing): void {
    this.listings.set(listing.projectId, listing);
  }

  list(input: ListableProject): Effect.Effect<WorktreeListing> {
    return Effect.sync(() => {
      return (
        this.listings.get(input.id) ?? {
          kind: 'unavailable',
          projectId: input.id,
        }
      );
    });
  }
}
