import type {
  GenerateCommitDraftRequest,
  GenerateCommitDraftResponse,
  ListCommitModelsResponse,
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
type CommitDraftInput = GenerateCommitDraftRequest;
type CommitDraft = GenerateCommitDraftResponse;
type CommitModel = ListCommitModelsResponse[number];
type Receipt = RunGitActionResponse;

type GitActionsRequest = {
  projectId: string;
  worktreeId: string;
  signal: AbortSignal;
};

export type GitActionsPort = {
  models: (
    request: Pick<GitActionsRequest, 'signal'>,
  ) => Promise<CommitModel[]>;
  draft: (
    request: GitActionsRequest & { input: CommitDraftInput },
  ) => Promise<CommitDraft>;
  run: (
    request: GitActionsRequest & { input: RunGitActionRequest },
  ) => Promise<Receipt>;
  dismissInterrupted: (
    request: GitActionsRequest & { requestId: string },
  ) => Promise<void>;
  receipt: (
    request: GitActionsRequest & { requestId: string },
  ) => Promise<Receipt>;
};
