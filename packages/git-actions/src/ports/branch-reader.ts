import type { GitActionScope } from '../models/git-action-scope.ts';
import type { GitBranches } from '../models/git-branches.ts';

export interface BranchReader {
  read(input: GitActionScope, signal?: AbortSignal): Promise<GitBranches>;
}
