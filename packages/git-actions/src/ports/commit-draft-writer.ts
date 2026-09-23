import type {
  CommitDraftGeneration,
  CommitDraftRequest,
} from '../models/commit-draft.ts';

export interface CommitDraftWriter {
  write(
    request: CommitDraftRequest,
    signal?: AbortSignal,
  ): Promise<CommitDraftGeneration>;
}
