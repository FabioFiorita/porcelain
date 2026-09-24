import type { GitProcessResult } from '../../shared/run-git.ts';

export type GitProcessRunner = {
  execute(
    args: readonly string[],
    signal: AbortSignal,
    input?: string,
    options?: { indexFile?: string },
  ): Promise<GitProcessResult>;
};
