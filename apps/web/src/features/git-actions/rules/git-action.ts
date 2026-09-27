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
export type BranchesResponse = ListGitBranchesResponse;
export type Receipt = RunGitActionResponse;
export type ActionInput = RunGitActionRequest['input'];
export type Expectation = RunGitActionRequest['expected'];
export type GitAction = ActionInput['action'];
export type { RunGitActionRequest };
