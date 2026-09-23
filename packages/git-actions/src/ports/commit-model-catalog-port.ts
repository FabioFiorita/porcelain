import type { CommitModel } from '../models/commit-draft.ts';

export interface CommitModelCatalogPort {
  models(signal: AbortSignal): Promise<CommitModel[]>;
}
