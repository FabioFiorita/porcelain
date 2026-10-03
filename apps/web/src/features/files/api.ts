import { filesApi as sharedFilesApi } from '@porcelain/client/files/api';
import {
  editFileRequestSchema,
  editFileResponseSchema,
  type EditFileRequest,
} from '@porcelain/contracts/files';
import { requestJson, RequestError } from '@porcelain/client/transport';
import { perConnection } from '@porcelain/client/transport';
import type { Transport } from '@porcelain/client/transport';

const worktreePath = (worktreeId: string) =>
  `/api/worktrees/${encodeURIComponent(worktreeId)}`;

function createFilesApi(transport: Transport) {
  return {
    ...sharedFilesApi({ transport }),
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
}

export const filesApi = perConnection(createFilesApi);

export function isContentChangedError(error: unknown) {
  return (
    error instanceof RequestError &&
    error.status === 409 &&
    error.code === 'content_changed'
  );
}
