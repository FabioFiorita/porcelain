import {
  CommitDraftSelectionError,
  CommitDraftTooLargeError,
  CommitGenerationFailedError,
  CommitGroupsMismatchError,
  CommitToolFailedError,
  CommitToolMissingError,
  DiscardExpectationMismatchError,
  DuplicateExpectedFileError,
  EmptyCommitSelectionError,
  ExpectedFilesMismatchError,
  GitActionNotFoundError,
  GitActionReceiptMismatchError,
  InvalidHunkRangeError,
  MergeExpectationMismatchError,
  MissingExpectedFilesError,
  MissingUpstreamExpectationError,
  UnsupportedCommitModelError,
} from '@porcelain/git-actions/errors';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api';
import { porcelainApi } from '../shared/http-api.ts';
import { PairedRequest } from '../shared/http-caller.ts';
import { httpFailure } from '../shared/http-failure.ts';
import { gitReadFailures } from '../shared/git-read-failures.ts';
import { worktreeFailures } from '../shared/worktree-failures.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';
import {
  generateCommitDraftRequestSchema,
  generateCommitDraftResponseSchema,
  listCommitModelsResponseSchema,
} from './commit-draft.ts';
import {
  dismissInterruptedGitActionParamsSchema,
  dismissInterruptedGitActionResponseSchema,
  readGitActionReceiptParamsSchema,
  readGitActionReceiptResponseSchema,
  runGitActionRequestSchema,
  runGitActionResponseSchema,
  runGitActionRejectedResponseSchema,
} from './git-actions.ts';

const receiptMismatch = httpFailure(GitActionReceiptMismatchError, 'Conflict', {
  message: 'Git action request does not match its receipt',
});
const receiptMissing = httpFailure(GitActionNotFoundError, 'NotFound');
const acceptanceFailures = [
  httpFailure(InvalidHunkRangeError, 'BadRequest', {
    message: 'Invalid request',
  }),
  httpFailure(DuplicateExpectedFileError, 'BadRequest', {
    message: 'Invalid request',
  }),
  httpFailure(MergeExpectationMismatchError, 'BadRequest', {
    message: 'Invalid request',
  }),
  httpFailure(EmptyCommitSelectionError, 'BadRequest', {
    message: 'Invalid request',
  }),
  httpFailure(ExpectedFilesMismatchError, 'BadRequest', {
    message: 'Invalid request',
  }),
  httpFailure(DiscardExpectationMismatchError, 'BadRequest', {
    message: 'Invalid request',
  }),
  httpFailure(MissingExpectedFilesError, 'BadRequest', {
    message: 'Invalid request',
  }),
  httpFailure(MissingUpstreamExpectationError, 'BadRequest', {
    message: 'Invalid request',
  }),
] as const;
const draftFailures = [
  httpFailure(CommitDraftSelectionError, 'UnprocessableEntity'),
  httpFailure(CommitDraftTooLargeError, 'UnprocessableEntity'),
  httpFailure(CommitGenerationFailedError, 'UnprocessableEntity'),
  httpFailure(CommitGroupsMismatchError, 'UnprocessableEntity'),
  httpFailure(CommitToolFailedError, 'UnprocessableEntity'),
  httpFailure(CommitToolMissingError, 'UnprocessableEntity'),
  httpFailure(UnsupportedCommitModelError, 'UnprocessableEntity'),
] as const;

export class GitActionsApi extends porcelainApi.add(
  HttpApiGroup.make('gitActions')
    .add(
      HttpApiEndpoint.delete(
        'dismissInterruptedGitAction',
        '/api/worktrees/:worktreeId/git/interrupted/:requestId',
        {
          disableCodecs: true,
          params: dismissInterruptedGitActionParamsSchema,
          success: dismissInterruptedGitActionResponseSchema,
          error: [...worktreeFailures, receiptMissing, receiptMismatch],
        },
      ),
      HttpApiEndpoint.post(
        'generateCommitDraft',
        '/api/worktrees/:worktreeId/git/commit-draft',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: generateCommitDraftRequestSchema,
          success: generateCommitDraftResponseSchema,
          error: [...worktreeFailures, ...gitReadFailures, ...draftFailures],
        },
      ),
      HttpApiEndpoint.get('listCommitModels', '/api/git/commit-models', {
        disableCodecs: true,
        success: listCommitModelsResponseSchema,
      }),
      HttpApiEndpoint.get(
        'readGitActionReceipt',
        '/api/worktrees/:worktreeId/git/receipts/:requestId',
        {
          disableCodecs: true,
          params: readGitActionReceiptParamsSchema,
          success: readGitActionReceiptResponseSchema,
          error: [...worktreeFailures, receiptMissing],
        },
      ),
      HttpApiEndpoint.post(
        'runGitAction',
        '/api/worktrees/:worktreeId/git/actions',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: runGitActionRequestSchema,
          success: [
            runGitActionResponseSchema,
            runGitActionResponseSchema.pipe(HttpApiSchema.status(202)),
            runGitActionRejectedResponseSchema.pipe(HttpApiSchema.status(409)),
            runGitActionRejectedResponseSchema.pipe(HttpApiSchema.status(503)),
          ],
          error: [...worktreeFailures, receiptMismatch, ...acceptanceFailures],
        },
      ),
    )
    .middleware(PairedRequest),
) {}
