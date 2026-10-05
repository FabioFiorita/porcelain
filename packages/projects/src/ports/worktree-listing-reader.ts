import type { Effect } from 'effect';
import type { ListableProject } from '../models/project.ts';
import type { WorktreeListing } from '../models/worktree-listing.ts';

export interface WorktreeListingReader {
  list(input: ListableProject): Effect.Effect<WorktreeListing>;
}
