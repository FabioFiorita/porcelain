import type { GitActionReceipt } from '@porcelain/contracts/git-actions';
import type { GitChange } from '@porcelain/git/dtos/git-status';

/**
 * One changed path, as the list reports it.
 *
 * `comparisons` are every side of the change for that path — a staged edit and
 * an unstaged one are two comparisons of the same file — and the fingerprint
 * covers all of them together. Marking from half a change would otherwise be
 * possible: stage an edit, make another, and a fingerprint over the staged
 * side alone would call the file reviewed.
 */
export type FileChange = {
  path: string;
  fingerprint: string | null;
  comparisons: GitChange[];
};

/** What a listing observed, and the token a later read must present. */
export type ChangeList = {
  environmentId: string;
  worktreeId: string;
  statusToken: string;
  headOid: string | null;
  inProgress: 'merge' | 'rebase' | null;
  mergeHeadOid: string | null;
  /**
   * What the same status already printed. The remote name and stashes an
   * action needs are not here: they cost two more Git processes and only the
   * action UI reads them.
   */
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
