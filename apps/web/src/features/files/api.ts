import {
  editFileRequestSchema,
  editFileResponseSchema,
  listDirectoryResponseSchema,
  listWorktreePathsResponseSchema,
  readFileAssetResponseSchema,
  readPreviewAssetsRequestSchema,
  readPreviewAssetsResponseSchema,
  readTextFileResponseSchema,
  type EditFileRequest,
} from '@porcelain/contracts/files';
import { requestJson, RequestError } from '@/shared/api/request';
import { browserTransport } from '@/shared/api/transport';

const transport = browserTransport(fetch);
const worktreePath = (worktreeId: string) =>
  `/api/worktrees/${encodeURIComponent(worktreeId)}`;
const pathQuery = (path: string) => `?${new URLSearchParams({ path })}`;

export const filesApi = {
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
  edit: (signal: AbortSignal, worktreeId: string, input: EditFileRequest) =>
    requestJson(
      transport,
      `${worktreePath(worktreeId)}/files`,
      editFileResponseSchema,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editFileRequestSchema.parse(input)),
        signal,
      },
    ),
};

export function isContentChangedError(error: unknown) {
  return (
    error instanceof RequestError &&
    error.status === 409 &&
    error.code === 'content_changed'
  );
}

export function unreadableFileReason(error: unknown) {
  if (!(error instanceof RequestError) || error.status !== 422) return null;
  if (error.code === 'unsupported_text')
    return 'This file is binary or uses an unsupported text encoding.';
  if (error.code === 'file_too_large')
    return 'This file is too large to display as text.';
  return null;
}
