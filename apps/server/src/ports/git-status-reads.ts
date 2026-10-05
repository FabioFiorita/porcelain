import { Context } from 'effect';
import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type { ReadGitStatusResponse } from '@porcelain/contracts/changes';
import type { GitIoFailure } from '@porcelain/git/errors';
import type { WorktreeAccessFailure } from './worktree-access-failure.ts';
import type { SharedReads } from '../runtime/shared-reads.ts';
export const GitStatusReads = Context.Service<
  '@porcelain/server/GitStatusReads',
  SharedReads<
    ReadGitStatusResponse,
    WorktreeAccessFailure | GitIoFailure | MissingEnvironmentIdentityError
  >
>('@porcelain/server/GitStatusReads');
