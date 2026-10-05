import { FilesApi } from '@porcelain/contracts/files';
import {
  FileTooLargeError,
  UnsupportedTextError,
} from '@porcelain/files/errors';
import { Effect } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { perConnection } from '../../shared/api/per-connection.ts';
import { transportClient } from '../../shared/api/effect-client.ts';
import type { Transport } from '../../shared/api/transport.ts';

function createFilesApi(transport: Transport) {
  const client = HttpApiClient.makeWith(FilesApi, {
    httpClient: transportClient(transport),
  });
  return Effect.runSync(client).files;
}

export const filesApi = perConnection(createFilesApi);

export function unreadableFileReason(error: unknown) {
  if (error instanceof UnsupportedTextError)
    return 'This file is binary or uses an unsupported text encoding.';
  if (error instanceof FileTooLargeError)
    return 'This file is too large to display as text.';
  return null;
}
