import type { GitActionReceipt } from '@porcelain/contracts/git-actions';
import type { GitChange } from '@porcelain/git/dtos/git-status';

export type FileChange = {
  path: string;
  fingerprint: string | null;
  comparisons: GitChange[];
};

export type ChangeList = {
  environmentId: string;
  worktreeId: string;
  statusToken: string;
  headOid: string | null;
  inProgress: 'merge' | 'rebase' | null;
  mergeHeadOid: string | null;
  branch: {
    name: string | null;
    upstream: string | null;
    ahead: number;
    behind: number;
  } | null;
  interrupted?: {
    requestId: string;
    action: GitActionReceipt['action'];
    gitState: string;
  };
  changes: FileChange[];
};
