import type { GitProcessResult } from '../dtos/git-process-result.ts';

export interface GitProcessRunner {
  execute(
    args: string[],
    signal: AbortSignal,
    input?: string,
    options?: { indexFile?: string },
  ): Promise<GitProcessResult>;
}
