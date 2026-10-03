import {
  listDirectoryEndpoint,
  listWorktreePathsEndpoint,
  readFileAssetEndpoint,
  readPreviewAssetsEndpoint,
  readTextFileEndpoint,
} from '@porcelain/contracts/files';

import { requestEndpoint } from '../../shared/api/request.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import { type Transport } from '../../shared/api/transport.ts';

function createFilesApi(transport: Transport) {
  return {
    directory: ({
      signal,
      worktreeId,
      path,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      path: string;
    }) =>
      requestEndpoint(transport, listDirectoryEndpoint, {
        params: { worktreeId },
        query: { path },
        signal,
      }),
    paths: ({
      signal,
      worktreeId,
    }: {
      signal: AbortSignal;
      worktreeId: string;
    }) =>
      requestEndpoint(transport, listWorktreePathsEndpoint, {
        params: { worktreeId },
        signal,
      }),
    asset: ({
      signal,
      worktreeId,
      path,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      path: string;
    }) =>
      requestEndpoint(transport, readFileAssetEndpoint, {
        params: { worktreeId },
        query: { path },
        signal,
      }),
    previewAssets: ({
      signal,
      worktreeId,
      document,
      paths,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      document: string;
      paths: string[];
    }) =>
      requestEndpoint(transport, readPreviewAssetsEndpoint, {
        params: { worktreeId },
        body: { document, paths },
        signal,
      }),
    text: ({
      signal,
      worktreeId,
      path,
    }: {
      signal: AbortSignal;
      worktreeId: string;
      path: string;
    }) =>
      requestEndpoint(transport, readTextFileEndpoint, {
        params: { worktreeId },
        query: { path },
        signal,
      }),
  };
}

export const filesApi = perConnection(createFilesApi);
