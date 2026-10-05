import { type Effect, Context } from 'effect';
import { type CommitModel } from '../models/commit-draft.ts';

export interface CommitModelReader {
  list(): Effect.Effect<CommitModel[], never, never>;
}

export const CommitModelReader = Context.Service<
  '@porcelain/git-actions/CommitModelReader',
  CommitModelReader
>('@porcelain/git-actions/CommitModelReader');
