import type { Effect } from 'effect';
import type {
  CommitDraftGeneration,
  CommitDraftRequest,
} from '../models/commit-draft.ts';

export interface CommitDraftSource {
  generate(
    input: CommitDraftRequest,
  ): Effect.Effect<CommitDraftGeneration, never, never>;
}
