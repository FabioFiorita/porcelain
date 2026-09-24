import { WorktreeNotFoundError } from '@porcelain/git-actions/errors';
import { describe, expect, it } from 'vitest';
import {
  PROJECT_ID,
  WORKTREE_ID,
} from '../../spec/fakes/git-action-samples.ts';
import { CheckGitActionScopeService } from './check-git-action-scope-service.ts';

const worktree = { id: WORKTREE_ID, projectId: PROJECT_ID };

describe('CheckGitActionScopeService', () => {
  it('accepts a worktree of the named project', () => {
    expect(() =>
      new CheckGitActionScopeService().execute({
        projectId: PROJECT_ID,
        worktree,
      }),
    ).not.toThrow();
  });

  it('does not find a worktree under a project it belongs not to', () => {
    expect(() =>
      new CheckGitActionScopeService().execute({
        projectId: '11111111-1111-4111-8111-111111111111',
        worktree,
      }),
    ).toThrow(WorktreeNotFoundError);
  });
});
