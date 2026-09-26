import type { GitLimits } from '../../shared/dtos/git-limits.ts';
import type { GitProcessResult } from '../../shared/commands/run-git.ts';

export interface GitProcessRunner {
  readonly limits: GitLimits;
  execute(
    args: readonly string[],
    signal: AbortSignal,
    input?: string,
    options?: { indexFile?: string },
  ): Promise<GitProcessResult>;
}
