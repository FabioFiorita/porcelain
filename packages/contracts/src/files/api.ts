import { PairedRequest } from '../shared/http-caller.ts';
import {
  invalidMove,
  entryExists,
  unsupportedEntryName,
  directoryTooLarge,
  crossDeviceMove,
  trashUnavailable,
  unsupportedAssetType,
  unsupportedText,
  fileTooLarge,
  diskFull,
  readFailures,
} from './failures.ts';
import { worktreeParamsSchema } from '../shared/worktree-params.ts';
import { porcelainApi } from '../shared/http-api.ts';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';
import { worktreeFailures } from '../shared/worktree-failures.ts';
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

export class FilesApi extends porcelainApi.add(
  HttpApiGroup.make('files')
    .add(
      HttpApiEndpoint.get(
        'listDirectory',
        '/api/worktrees/:worktreeId/directory',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          query: listDirectoryQuerySchema.fields,
          success: listDirectoryResponseSchema,
          error: [...readFailures, unsupportedEntryName, directoryTooLarge],
        },
      ),
      HttpApiEndpoint.get(
        'listWorktreePaths',
        '/api/worktrees/:worktreeId/paths',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          success: listWorktreePathsResponseSchema,
          error: [...worktreeFailures, directoryTooLarge],
        },
      ),
      HttpApiEndpoint.get('readTextFile', '/api/worktrees/:worktreeId/text', {
        disableCodecs: true,
        params: worktreeParamsSchema,
        query: readTextFileQuerySchema.fields,
        success: readTextFileResponseSchema,
        error: [...readFailures, unsupportedText, fileTooLarge],
      }),
      HttpApiEndpoint.get('readFileAsset', '/api/worktrees/:worktreeId/asset', {
        disableCodecs: true,
        params: worktreeParamsSchema,
        query: readFileAssetQuerySchema.fields,
        success: readFileAssetResponseSchema,
        error: [...readFailures, unsupportedAssetType, fileTooLarge],
      }),
      HttpApiEndpoint.post(
        'readPreviewAssets',
        '/api/worktrees/:worktreeId/preview-assets',
        {
          disableCodecs: true,
          params: worktreeParamsSchema,
          payload: readPreviewAssetsRequestSchema,
          success: readPreviewAssetsResponseSchema,
          error: worktreeFailures,
        },
      ),
      HttpApiEndpoint.post('editFile', '/api/worktrees/:worktreeId/files', {
        disableCodecs: true,
        params: worktreeParamsSchema,
        payload: editFileRequestSchema,
        success: editFileResponseSchema,
        error: [
          ...readFailures,
          unsupportedText,
          entryExists,
          crossDeviceMove,
          trashUnavailable,
          fileTooLarge,
          diskFull,
          invalidMove,
        ],
      }),
    )
    .middleware(PairedRequest),
) {}
