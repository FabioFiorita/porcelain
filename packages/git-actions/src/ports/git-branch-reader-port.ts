import type { GitBranches } from '../models/git-branches.ts';
import type { GitActionScope } from '../models/git-action.ts';

export interface GitBranchReaderPort {
  read(
    scope: GitActionScope,
    signal: AbortSignal,
  ): Promise<GitBranches | undefined>;
}
