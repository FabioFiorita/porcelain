import { Context, Schema, type Effect } from 'effect';
import type {
  FilesApi,
  ReadFileAssetResponse,
} from '@porcelain/contracts/files';
import type { HttpApiEndpoint } from 'effect/http-api';
import type { HttpClientError } from 'effect/http';
import type { ConnectionError } from '../../../shared/api/connection-error.ts';
import type { RequestError } from '../../../shared/api/request-error.ts';

export type PreviewAssetFailure =
  | HttpApiEndpoint.Errors<
      typeof FilesApi.groups.files.endpoints.readPreviewAssets
    >
  | HttpClientError.HttpClientError
  | Schema.SchemaError
  | ConnectionError
  | RequestError;
export type HtmlPreview = {
  readonly html: string;
  readonly missing: readonly string[];
};

export class HtmlPreviewUnavailable extends Schema.TaggedError<HtmlPreviewUnavailable>()(
  'HtmlPreviewUnavailable',
  {},
) {
  override get message() {
    return 'Could not prepare the HTML preview. Try again.';
  }
}

export class HtmlPreviewPlatform extends Context.Service<
  HtmlPreviewPlatform,
  {
    readonly render: (
      html: string,
      path: string,
      read: (
        paths: readonly string[],
      ) => Effect.Effect<
        Map<string, ReadFileAssetResponse | null>,
        PreviewAssetFailure
      >,
    ) => Effect.Effect<
      HtmlPreview,
      PreviewAssetFailure | HtmlPreviewUnavailable
    >;
  }
>()('@porcelain/client/HtmlPreviewPlatform') {}
