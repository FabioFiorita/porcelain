import type { CommitGroup, CommitModel } from '../../models/commit-draft.ts';
export interface CommitGenerator {
  models(signal: AbortSignal): Promise<CommitModel[]>;
  generate(
    model: string,
    prompt: string,
    signal: AbortSignal,
  ): Promise<CommitGroup[]>;
}
