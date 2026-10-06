import { environmentUnavailable } from '../shared/environment-failure.ts';
import { PairedRequest } from '../shared/http-caller.ts';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import { porcelainApi } from '../shared/http-api.ts';
import { httpFailure } from '../shared/http-failure.ts';
import { worktreeFailures } from '../shared/worktree-failures.ts';
import { gitReadFailures } from '../shared/git-read-failures.ts';
import { textReadFailures } from '../files/failures.ts';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import {
  BranchBaseNotFoundError,
  CommitNotFoundError,
  IncompleteDiffReadError,
  SelectionMismatchError,
  UnbornBranchError,
  UnnamedDiffSelectionError,
  UnrelatedBranchError,
} from '@porcelain/changes/errors';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';
import {
  listBranchBasesResponseSchema,
  readBranchChangesQuerySchema,
  readBranchChangesResponseSchema,
  readBranchDiffsRequestSchema,
  readBranchDiffsResponseSchema,
} from './branch-changes.ts';
import {
  readChangeDiffsRequestSchema,
  readChangeDiffsResponseSchema,
  readChangeLinesQuerySchema,
  readChangeLinesResponseSchema,
  readChangesResponseSchema,
} from './changes.ts';
import {
  readCommitDiffsParamsSchema,
  readCommitDiffsRequestSchema,
  readCommitDiffsResponseSchema,
  readCommitFilesParamsSchema,
  readCommitFilesQuerySchema,
  readCommitFilesResponseSchema,
} from './commit-changes.ts';
import {
  listCommitsQuerySchema,
  listCommitsResponseSchema,
  listFileCommitsQuerySchema,
  listFileCommitsResponseSchema,
} from './commit-history.ts';
import { readGitStatusResponseSchema } from './git-status.ts';

export class ChangesApi extends porcelainApi.add(
  HttpApiGroup.make('changes')
    .add(
      HttpApiEndpoint.get(
        'listBranchBases',
        '/api/worktrees/:worktreeId/branch-bases',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          success: listBranchBasesResponseSchema,
          error: [...worktreeFailures, ...gitReadFailures],
        },
      ),
      HttpApiEndpoint.get('listCommits', '/api/worktrees/:worktreeId/commits', {
        disableCodecs: true,
        params: worktreeParamsSchema,
        query: listCommitsQuerySchema.fields,
        success: listCommitsResponseSchema,
        error: [...worktreeFailures, ...gitReadFailures],
      }),
      HttpApiEndpoint.get(
        'listFileCommits',
        '/api/worktrees/:worktreeId/file-commits',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          query: listFileCommitsQuerySchema.fields,
          success: listFileCommitsResponseSchema,
          error: [...worktreeFailures, ...gitReadFailures],
        },
      ),
      HttpApiEndpoint.get(
        'readBranchChanges',
        '/api/worktrees/:worktreeId/branch-changes',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          query: readBranchChangesQuerySchema.fields,
          success: readBranchChangesResponseSchema,
          error: [
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(BranchBaseNotFoundError, 'NotFound'),
            httpFailure(UnbornBranchError, 'Conflict'),
            httpFailure(UnrelatedBranchError, 'Conflict'),
          ],
        },
      ),
      HttpApiEndpoint.post(
        'readBranchDiffs',
        '/api/worktrees/:worktreeId/branch-changes/diffs',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: readBranchDiffsRequestSchema,
          success: readBranchDiffsResponseSchema,
          error: [
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(CommitNotFoundError, 'NotFound'),
            httpFailure(IncompleteDiffReadError, 'UnprocessableEntity'),
          ],
        },
      ),
      HttpApiEndpoint.post(
        'readChangeDiffs',
        '/api/worktrees/:worktreeId/changes/diffs',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: readChangeDiffsRequestSchema,
          success: readChangeDiffsResponseSchema,
          error: [
            environmentUnavailable,
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(SelectionMismatchError, 'BadRequest', {
              message: 'Invalid request',
            }),
            httpFailure(UnnamedDiffSelectionError, 'BadRequest', {
              message: 'Invalid request',
            }),
            httpFailure(IncompleteDiffReadError, 'UnprocessableEntity'),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'readChangeLines',
        '/api/worktrees/:worktreeId/changes/lines',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          query: readChangeLinesQuerySchema.fields,
          success: readChangeLinesResponseSchema,
          error: [
            environmentUnavailable,
            ...textReadFailures,
            httpFailure(InvalidLineRangeError, 'BadRequest', {
              message: 'Invalid request',
            }),
          ],
        },
      ),
      HttpApiEndpoint.get('readChanges', '/api/worktrees/:worktreeId/changes', {
        disableCodecs: true,
        params: worktreeParamsSchema,
        success: readChangesResponseSchema,
        error: [
          environmentUnavailable,
          ...worktreeFailures,
          ...gitReadFailures,
        ],
      }),
      HttpApiEndpoint.post(
        'readCommitDiffs',
        '/api/worktrees/:worktreeId/commits/:oid/diffs',
        {
          disableCodecs: true,
          params: readCommitDiffsParamsSchema,
          payload: readCommitDiffsRequestSchema,
          success: readCommitDiffsResponseSchema,
          error: [
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(CommitNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'readCommitFiles',
        '/api/worktrees/:worktreeId/commits/:oid/files',
        {
          disableCodecs: true,
          params: readCommitFilesParamsSchema,
          query: readCommitFilesQuerySchema.fields,
          success: readCommitFilesResponseSchema,
          error: [
            ...worktreeFailures,
            ...gitReadFailures,
            httpFailure(CommitNotFoundError, 'NotFound'),
          ],
        },
      ),
      HttpApiEndpoint.get(
        'readGitStatus',
        '/api/worktrees/:worktreeId/git/status',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          success: readGitStatusResponseSchema,
          error: [
            environmentUnavailable,
            ...worktreeFailures,
            ...gitReadFailures,
          ],
        },
      ),
    )
    .middleware(PairedRequest),
) {}
