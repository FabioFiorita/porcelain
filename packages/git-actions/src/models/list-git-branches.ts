import type { GitActionScope } from './git-action-scope.ts';
import type { GitBranches } from './git-branches.ts';

export type ListGitBranchesInput = GitActionScope;

export type ListGitBranchesResult = GitBranches;
