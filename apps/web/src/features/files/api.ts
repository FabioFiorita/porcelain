import { editFileEndpoint } from '@porcelain/contracts/files';
import { filesApi as sharedFilesApi } from '@porcelain/client/files/api';
import { type EditFileRequest } from '@porcelain/contracts/files';
import {
  requestEndpoint,
  type EndpointArguments,
} from '@porcelain/client/transport';
import { perConnection } from '@porcelain/client/transport';
import type { Transport } from '@porcelain/client/transport';

function createFilesApi(transport: Transport) {
  return {
    ...sharedFilesApi({ transport }),
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
  };
}

export const filesApi = perConnection(createFilesApi);
