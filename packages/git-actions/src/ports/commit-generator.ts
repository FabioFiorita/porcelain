import type { CommitGroup } from '../models/commit-draft.ts';

export interface CommitGeneratorPort {
  generate(
    model: string,
    prompt: string,
    signal: AbortSignal,
  ): Promise<CommitGroup[]>;
}
