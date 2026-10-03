import { defineEndpoint } from '../shared/endpoint.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';
import {
  editFileRequestSchema,
  editFileResponseSchema,
  listDirectoryQuerySchema,
  listDirectoryResponseSchema,
  listWorktreePathsResponseSchema,
  readFileAssetQuerySchema,
  readFileAssetResponseSchema,
  readPreviewAssetsRequestSchema,
  readPreviewAssetsResponseSchema,
  readTextFileQuerySchema,
  readTextFileResponseSchema,
} from './files.ts';

export const editFileEndpoint = defineEndpoint({
  method: 'POST',
  path: '/worktrees/:worktreeId/files',
  schema: {
    params: worktreeParamsSchema,
    body: editFileRequestSchema,
    response: { 200: editFileResponseSchema },
  },
  errors: {
    content_changed: 409,
    file_too_large: 422,
    unsupported_text: 422,
    worktree_changed: 409,
  },
});

export const listDirectoryEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/directory',
  schema: {
    params: worktreeParamsSchema,
    querystring: listDirectoryQuerySchema,
    response: { 200: listDirectoryResponseSchema },
  },
  errors: { content_changed: 409, worktree_changed: 409 },
});

export const listWorktreePathsEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/paths',
  schema: {
    params: worktreeParamsSchema,
    response: { 200: listWorktreePathsResponseSchema },
  },
  errors: { worktree_changed: 409 },
});

export const readFileAssetEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/asset',
  schema: {
    params: worktreeParamsSchema,
    querystring: readFileAssetQuerySchema,
    response: { 200: readFileAssetResponseSchema },
  },
  errors: { content_changed: 409, file_too_large: 422, worktree_changed: 409 },
});

export const readPreviewAssetsEndpoint = defineEndpoint({
  method: 'POST',
  path: '/worktrees/:worktreeId/preview-assets',
  schema: {
    params: worktreeParamsSchema,
    body: readPreviewAssetsRequestSchema,
    response: { 200: readPreviewAssetsResponseSchema },
  },
  errors: { worktree_changed: 409 },
});

export const readTextFileEndpoint = defineEndpoint({
  method: 'GET',
  path: '/worktrees/:worktreeId/text',
  schema: {
    params: worktreeParamsSchema,
    querystring: readTextFileQuerySchema,
    response: { 200: readTextFileResponseSchema },
  },
  errors: {
    content_changed: 409,
    file_too_large: 422,
    unsupported_text: 422,
    worktree_changed: 409,
  },
});
