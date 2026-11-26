import { Atom } from 'effect/reactivity';
import { Context, Effect, Layer } from 'effect';
import { PREVIEW_FILE_ROUTE } from '@porcelain/contracts/files';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import type {
  PreviewAssetFailure,
  PreviewAssetSource,
} from '../ports/html-preview-platform.ts';

export const readPreviewAssets = Atom.family(
  (connection: RuntimeConnection) => {
    class PreviewAssets extends Context.Service<
      PreviewAssets,
      {
        readonly read: (
          scope: WorktreeScope,
          document: string,
          paths: readonly string[],
          streamMedia: boolean,
        ) => Effect.Effect<
          Map<string, PreviewAssetSource | null>,
          PreviewAssetFailure
        >;
      }
    >()('@porcelain/client/PreviewAssets') {
      static readonly layer = Layer.effect(
        PreviewAssets,
        Effect.gen(function* () {
          const client = yield* porcelainClient(connection);
          return {
            read: Effect.fn('PreviewAssets.read')(function* (
              scope: WorktreeScope,
              document: string,
              paths: readonly string[],
              streamMedia: boolean,
            ) {
              const [response, request] = yield* client.request((api) =>
                api.files.readPreviewAssets({
                  params: { worktreeId: scope.worktreeId },
                  payload: {
                    document,
                    paths: [...paths],
                    ...(streamMedia ? { streamMedia } : {}),
                  },
                  responseMode: 'decoded-and-response',
                }),
              );
              yield* currentAnswerEffect(connection);
              return new Map<string, PreviewAssetSource | null>(
                response.assets.map((asset) => [
                  asset.path,
                  asset.kind === 'stream'
                    ? { url: previewUrl(request.url, scope.worktreeId, asset) }
                    : asset.kind === 'asset'
                      ? asset
                      : null,
                ]),
              );
            }),
          };
        }),
      );
    }
    return PreviewAssets;
  },
);

function previewUrl(
  base: string,
  worktreeId: string,
  asset: { path: string; ticket: string },
) {
  const url = new URL(
    PREVIEW_FILE_ROUTE.replace(':worktreeId', encodeURIComponent(worktreeId)),
    base,
  );
  url.search = new URLSearchParams({
    path: asset.path,
    ticket: asset.ticket,
  }).toString();
  return url.href;
}
