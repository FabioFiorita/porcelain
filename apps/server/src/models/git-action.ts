import type {
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
    preparationId: string;
    action: GitActionIntent['action'];
    state: GitActionOutcome['state'] | 'running';
    acceptedAt: number;
    finishedAt?: number;
  };
