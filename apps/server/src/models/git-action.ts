import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionOutcome,
  GitActionPreview,
} from '@porcelain/git/dtos/git-action';
export type GitActionScope = { projectId: string; worktreeId: string };
export type GitActionPreparation = GitActionScope & {
  id: string;
  expiresAt: number;
  intent: GitActionIntent;
  fingerprint: string;
  preview: GitActionPreview;
};
export type GitActionReceipt = GitActionScope &
  Omit<GitActionOutcome, 'state'> & {
    requestId: string;
    intent?: GitActionIntent;
    expected?: GitActionExpectation;
    requestFingerprint?: string;
    action: GitActionIntent['action'];
    state: GitActionOutcome['state'] | 'running';
    progress?: string[];
    acceptedAt: number;
    finishedAt?: number;
    dismissedAt?: number;
  };
