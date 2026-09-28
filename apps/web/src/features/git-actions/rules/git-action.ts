import type {
  GenerateCommitDraftRequest,
  GenerateCommitDraftResponse,
  ListCommitModelsResponse,
} from '@porcelain/contracts/git-actions';
import type {
  ListGitBranchesResponse,
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
export type CommitDraftInput = GenerateCommitDraftRequest;
export type CommitDraft = GenerateCommitDraftResponse;
export type CommitModel = ListCommitModelsResponse[number];
type BranchesResponse = ListGitBranchesResponse;
export type Receipt = RunGitActionResponse;
export type ActionInput = RunGitActionRequest['input'];
export type Expectation = RunGitActionRequest['expected'];
export type GitAction = ActionInput['action'];

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
  branches: (request: GitActionsRequest) => Promise<BranchesResponse>;
  dismissInterrupted: (
    request: GitActionsRequest & { requestId: string },
  ) => Promise<void>;
  receipt: (
    request: GitActionsRequest & { requestId: string },
  ) => Promise<Receipt>;
};

export type GitScope = { projectId: string; worktreeId: string };
