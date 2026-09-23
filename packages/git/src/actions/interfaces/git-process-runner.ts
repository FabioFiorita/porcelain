import type { GitProcessResult } from '../../shared/run-git.ts';

export interface GitProcessRunner {
  execute(
    args: readonly string[],
    signal: AbortSignal,
    input?: string,
    options?: { indexFile?: string },
  ): Promise<GitProcessResult>;
}
