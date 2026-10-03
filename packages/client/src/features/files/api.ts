import { RequestError } from '../../shared/api/request.ts';
import {
  listDirectoryResponseSchema,
  listWorktreePathsResponseSchema,
  readFileAssetResponseSchema,
  readPreviewAssetsRequestSchema,
  readPreviewAssetsResponseSchema,
  readTextFileResponseSchema,
} from '@porcelain/contracts/files';
import { requestJson } from '../../shared/api/request.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import { type Transport } from '../../shared/api/transport.ts';

const worktreePath = (worktreeId: string) =>
  `/api/worktrees/${encodeURIComponent(worktreeId)}`;
const pathQuery = (path: string) =>
  `?${new URLSearchParams({ path }).toString()}`;

function createFilesApi(transport: Transport) {
  return {
    directory: (signal: AbortSignal, worktreeId: string, path: string) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/directory${pathQuery(path)}`,
        listDirectoryResponseSchema,
        { signal },
      ),
    paths: (signal: AbortSignal, worktreeId: string) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/paths`,
        listWorktreePathsResponseSchema,
        { signal },
      ),
    asset: (signal: AbortSignal, worktreeId: string, path: string) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/asset${pathQuery(path)}`,
        readFileAssetResponseSchema,
        { signal },
      ),
    previewAssets: (
      signal: AbortSignal,
      worktreeId: string,
      document: string,
      paths: string[],
    ) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/preview-assets`,
        readPreviewAssetsResponseSchema,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            readPreviewAssetsRequestSchema.parse({ document, paths }),
          ),
          signal,
        },
      ),
    text: (signal: AbortSignal, worktreeId: string, path: string) =>
      requestJson(
        transport,
        `${worktreePath(worktreeId)}/text${pathQuery(path)}`,
        readTextFileResponseSchema,
        { signal },
      ),
  };
}

export const filesApi = perConnection(createFilesApi);

export function unreadableFileReason(error: unknown) {
  if (!(error instanceof RequestError) || error.status !== 422) return null;
  if (error.code === 'unsupported_text')
    return 'This file is binary or uses an unsupported text encoding.';
  if (error.code === 'file_too_large')
    return 'This file is too large to display as text.';
  return null;
}
