import { defineEndpoint } from '../shared/endpoint.ts';
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

export const listBranchBasesEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/branch-bases',
  schema: {
    params: worktreeParamsSchema,
    response: { 200: listBranchBasesResponseSchema },
  },
  errors: ['worktree_changed'],
});

export const listCommitsEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/commits',
  schema: {
    params: worktreeParamsSchema,
    querystring: listCommitsQuerySchema,
    response: { 200: listCommitsResponseSchema },
  },
  errors: ['worktree_changed'],
});

export const listFileCommitsEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/file-commits',
  schema: {
    params: worktreeParamsSchema,
    querystring: listFileCommitsQuerySchema,
    response: { 200: listFileCommitsResponseSchema },
  },
  errors: ['worktree_changed'],
});

export const readBranchChangesEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/branch-changes',
  schema: {
    params: worktreeParamsSchema,
    querystring: readBranchChangesQuerySchema,
    response: { 200: readBranchChangesResponseSchema },
  },
  errors: ['worktree_changed'],
});

export const readBranchDiffsEndpoint = defineEndpoint({
  method: 'POST',
  path: '/worktrees/:worktreeId/branch-changes/diffs',
  schema: {
    params: worktreeParamsSchema,
    body: readBranchDiffsRequestSchema,
    response: { 200: readBranchDiffsResponseSchema },
  },
  errors: ['worktree_changed'],
});

export const readChangeDiffsEndpoint = defineEndpoint({
  method: 'POST',
  path: '/worktrees/:worktreeId/changes/diffs',
  schema: {
    params: worktreeParamsSchema,
    body: readChangeDiffsRequestSchema,
    response: { 200: readChangeDiffsResponseSchema },
  },
  errors: ['worktree_changed'],
});

export const readChangeLinesEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/changes/lines',
  schema: {
    params: worktreeParamsSchema,
    querystring: readChangeLinesQuerySchema,
    response: { 200: readChangeLinesResponseSchema },
  },
  errors: [
    'content_changed',
    'file_too_large',
    'unsupported_text',
    'worktree_changed',
  ],
});

export const readChangesEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/changes',
  schema: {
    params: worktreeParamsSchema,
    response: { 200: readChangesResponseSchema },
  },
  errors: ['worktree_changed'],
});

export const readCommitDiffsEndpoint = defineEndpoint({
  method: 'POST',
  path: '/worktrees/:worktreeId/commits/:oid/diffs',
  schema: {
    params: readCommitDiffsParamsSchema,
    body: readCommitDiffsRequestSchema,
    response: { 200: readCommitDiffsResponseSchema },
  },
  errors: ['worktree_changed'],
});

export const readCommitFilesEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/commits/:oid/files',
  schema: {
    params: readCommitFilesParamsSchema,
    querystring: readCommitFilesQuerySchema,
    response: { 200: readCommitFilesResponseSchema },
  },
  errors: ['worktree_changed'],
});

export const readGitStatusEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/git/status',
  schema: {
    params: worktreeParamsSchema,
    response: { 200: readGitStatusResponseSchema },
  },
  errors: ['worktree_changed'],
});
