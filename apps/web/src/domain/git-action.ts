import type {
  commitDraftRequestSchema,
  commitDraftResponseSchema,
  commitModelsSchema,
} from '@porcelain/contracts/commit-draft';
export type CommitDraftInput = ReturnType<
  typeof commitDraftRequestSchema.parse
>;
export type CommitDraft = ReturnType<typeof commitDraftResponseSchema.parse>;
export type CommitModel = ReturnType<typeof commitModelsSchema.parse>[number];

export type {
  ActionInput,
  BranchesResponse,
  Expectation,
  GitAction,
  Receipt,
  RunGitActionRequest,
} from '@porcelain/contracts/git-actions';

import type {
  Receipt,
  RunGitActionRequest,
} from '@porcelain/contracts/git-actions';
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
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const parsedScope = gitActionScopeSchema.safeParse({
    projectId: candidate.projectId,
    worktreeId: candidate.worktreeId,
  });
  const request = runGitActionRequestSchema.safeParse(candidate.request);
  if (
    !parsedScope.success ||
    !request.success ||
    candidate.requestId !== request.data.requestId
  )
    return null;
  return {
    ...parsedScope.data,
    requestId: request.data.requestId,
    request: request.data,
  };
}
