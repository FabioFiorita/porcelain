import type { Effect } from 'effect';
import type { CommitModel } from '../models/commit-draft.ts';

export interface CommitModelReader {
  list(): Effect.Effect<CommitModel[], never, never>;
}
