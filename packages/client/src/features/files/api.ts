import {
  editFileEndpoint,
  type EditFileRequest,
} from '@porcelain/contracts/files';
import {
  listDirectoryEndpoint,
  listWorktreePathsEndpoint,
  readFileAssetEndpoint,
  readPreviewAssetsEndpoint,
  readTextFileEndpoint,
} from '@porcelain/contracts/files';

import type { EndpointRequest } from '@porcelain/contracts/shared';
import {
  requestEndpoint,
  type EndpointArguments,
} from '../../shared/api/request.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import { type Transport } from '../../shared/api/transport.ts';

function createFilesApi(transport: Transport) {
  return {
    edit: ({
      signal,
      worktreeId,
      input,
    }: EndpointArguments<typeof editFileEndpoint> & {
      input: EditFileRequest;
    }) =>
      requestEndpoint(transport, editFileEndpoint, {
        params: { worktreeId },
        body: input,
        signal,
      }),
    directory: ({
      signal,
      worktreeId,
      path,
    }: EndpointArguments<typeof listDirectoryEndpoint>) =>
      requestEndpoint(transport, listDirectoryEndpoint, {
        params: { worktreeId },
        query: { path },
        signal,
      }),
    paths: ({
      signal,
      worktreeId,
    }: EndpointArguments<typeof listWorktreePathsEndpoint>) =>
      requestEndpoint(transport, listWorktreePathsEndpoint, {
        params: { worktreeId },
        signal,
      }),
    asset: ({
      signal,
      worktreeId,
      path,
    }: EndpointArguments<typeof readFileAssetEndpoint>) =>
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
    }: EndpointArguments<typeof readPreviewAssetsEndpoint> &
      EndpointRequest<typeof readPreviewAssetsEndpoint>['body']) =>
      requestEndpoint(transport, readPreviewAssetsEndpoint, {
        params: { worktreeId },
        body: { document, paths },
        signal,
      }),
    text: ({
      signal,
      worktreeId,
      path,
    }: EndpointArguments<typeof readTextFileEndpoint>) =>
      requestEndpoint(transport, readTextFileEndpoint, {
        params: { worktreeId },
        query: { path },
        signal,
      }),
  };
}

export const filesApi = perConnection(createFilesApi);
