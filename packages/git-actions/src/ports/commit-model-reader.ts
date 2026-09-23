import type { CommitModel } from '../models/commit-draft.ts';

export interface CommitModelReader {
  list(signal?: AbortSignal): Promise<CommitModel[]>;
}
