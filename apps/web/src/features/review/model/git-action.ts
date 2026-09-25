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

export type Operation = {
  requestId: string;
  projectId: string;
  worktreeId: string;
  request: RunGitActionRequest;
  receipt?: Receipt;
};

import {
  gitActionScopeSchema,
  runGitActionRequestSchema,
} from '@porcelain/contracts/git-actions';

export function parseRetainedOperation(value: unknown): Operation | null {
  if (!isRecord(value)) return null;
  const candidate = value;
  const parsedScope = gitActionScopeSchema.safeParse({
    projectId: candidate.projectId,
    worktreeId: candidate.worktreeId,
  });
  const request = runGitActionRequestSchema.safeParse(candidate.request);
  if (
    !parsedScope.success ||
    !request.success ||
    typeof candidate.projectId !== 'string' ||
    candidate.projectId.length === 0 ||
    candidate.requestId !== request.data.requestId
  )
    return null;
  return {
    ...parsedScope.data,
    projectId: candidate.projectId,
    requestId: request.data.requestId,
    request: request.data,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
