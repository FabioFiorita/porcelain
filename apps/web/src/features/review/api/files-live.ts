import {
  editFileRequestSchema,
  editFileResponseSchema,
  listDirectoryResponseSchema,
  listWorktreePathsResponseSchema,
  readFileAssetResponseSchema,
  readPreviewAssetsRequestSchema,
  readPreviewAssetsResponseSchema,
  readTextFileResponseSchema,
} from '@porcelain/contracts/files';
import { requestJson } from '@/shared/api/request';
import type { ReviewPort } from './review-port';
import { jsonBody, queryString, worktreePath } from './review-request';

export function createFilesLive(
  transport: typeof fetch,
): Pick<
  ReviewPort,
  | 'directory'
  | 'worktreePaths'
  | 'asset'
  | 'previewAssets'
  | 'text'
  | 'editFile'
> {
  return {
    directory: ({ worktreeId, signal, path }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/directory${queryString({ path })}`,
        listDirectoryResponseSchema,
        { signal },
      ),
    worktreePaths: ({ worktreeId, signal }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/paths`,
        listWorktreePathsResponseSchema,
        { signal },
      ),
    asset: ({ worktreeId, signal, path }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/asset${queryString({ path })}`,
        readFileAssetResponseSchema,
        { signal },
      ),
    previewAssets: ({ worktreeId, signal, document, paths }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/preview-assets`,
        readPreviewAssetsResponseSchema,
        {
          method: 'POST',
          ...jsonBody(
            readPreviewAssetsRequestSchema.parse({ document, paths }),
          ),
          signal,
        },
      ),
    text: ({ worktreeId, signal, path }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/text${queryString({ path })}`,
        readTextFileResponseSchema,
        { signal },
      ),
    editFile: ({ worktreeId, signal, input }) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/files`,
        editFileResponseSchema,
        {
          method: 'POST',
          ...jsonBody(editFileRequestSchema.parse(input)),
          signal,
        },
      ),
  };
}
