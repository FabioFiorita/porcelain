import type {
  GenerateCommitDraftRequest,
  GenerateCommitDraftResponse,
  ListCommitModelsResponse,
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
export type CommitDraftInput = GenerateCommitDraftRequest;
export type CommitDraft = GenerateCommitDraftResponse;
export type CommitModel = ListCommitModelsResponse[number];
export type Receipt = RunGitActionResponse;
export type ActionInput = RunGitActionRequest['input'];
export type Expectation = RunGitActionRequest['expected'];
export type GitAction = ActionInput['action'];

export type GitScope = { projectId: string; worktreeId: string };

export function fileName(path: string) {
  return path.split('/').at(-1) ?? path;
}
