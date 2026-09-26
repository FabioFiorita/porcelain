import type {
  CommitDraftGeneration,
  CommitDraftRequest,
} from '../models/commit-draft.ts';

export interface CommitDraftSource {
  generate(
    input: CommitDraftRequest,
    signal?: AbortSignal,
  ): Promise<CommitDraftGeneration>;
}
