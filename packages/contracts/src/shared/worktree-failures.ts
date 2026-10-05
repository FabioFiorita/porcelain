import {
  WorktreeChangedError,
  WorktreeNotFoundError,
} from '@porcelain/kernel/errors';
import {
  ProjectNotFoundError,
  WorktreeUnavailableError,
} from '@porcelain/projects/errors';
import { httpFailure } from './http-failure.ts';

export const worktreeFailures = [
  httpFailure(WorktreeChangedError, 'Conflict', {
    code: 'worktree_changed',
    message: 'Refresh status and retry inspection',
  }),
  httpFailure(WorktreeNotFoundError, 'NotFound'),
  httpFailure(ProjectNotFoundError, 'NotFound'),
  httpFailure(WorktreeUnavailableError, 'UnprocessableEntity', {
    message: 'Repository could not be inspected',
  }),
] as const;
