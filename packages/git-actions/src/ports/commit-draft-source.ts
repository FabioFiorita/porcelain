import { type Effect, Context } from 'effect';
import {
  type CommitDraftGeneration,
  type CommitDraftRequest,
} from '../models/commit-draft.ts';

export interface CommitDraftSource {
  generate(
    input: CommitDraftRequest,
  ): Effect.Effect<CommitDraftGeneration, never, never>;
}

export const CommitDraftSource = Context.Service<
  '@porcelain/git-actions/CommitDraftSource',
  CommitDraftSource
>('@porcelain/git-actions/CommitDraftSource');
