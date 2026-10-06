import { Context, type Effect, type Schema } from 'effect';
import type { HttpApiEndpoint } from 'effect/http-api';
import type { HttpClientError } from 'effect/http';
import type { FilesApi } from '@porcelain/contracts/files';
import type { ConnectionError } from '../../../shared/api/connection-error.ts';
import type { RequestError } from '../../../shared/api/request-error.ts';

export type FileDraftWriteFailure =
  | HttpApiEndpoint.Errors<typeof FilesApi.groups.files.endpoints.editFile>
  | HttpClientError.HttpClientError
  | Schema.SchemaError
  | ConnectionError
  | RequestError;

export class FileDraftWriter extends Context.Service<
  FileDraftWriter,
  {
    readonly write: (
      text: string,
      expectedFingerprint: string,
    ) => Effect.Effect<string, FileDraftWriteFailure>;
    readonly isBlockedError?: (error: unknown) => boolean;
  }
>()('@porcelain/client/FileDraftWriter') {}
