import { Atom } from 'effect/reactivity';
import { Context, Effect, Layer } from 'effect';
import type { ReadFileAssetResponse } from '@porcelain/contracts/files';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { requestEffect } from '../../../shared/api/effect-client.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { porcelainClient } from '../../../shared/api/client.ts';
import type { PreviewAssetFailure } from '../ports/html-preview-platform.ts';

export const readPreviewAssets = Atom.family(
  (connection: RuntimeConnection) => {
    class PreviewAssets extends Context.Service<
      PreviewAssets,
      {
        readonly read: (
          scope: WorktreeScope,
          document: string,
          paths: readonly string[],
        ) => Effect.Effect<
          Map<string, ReadFileAssetResponse | null>,
          PreviewAssetFailure
        >;
      }
    >()('@porcelain/client/PreviewAssets') {
      static readonly layer = Layer.effect(
        PreviewAssets,
        Effect.gen(function* () {
          const api = yield* porcelainClient(connection);
          return {
            read: Effect.fn('PreviewAssets.read')(function* (
              scope: WorktreeScope,
              document: string,
              paths: readonly string[],
            ) {
              const response = yield* requestEffect(
                api.files.readPreviewAssets({
                  params: { worktreeId: scope.worktreeId },
                  payload: { document, paths: [...paths] },
                }),
              );
              yield* currentAnswerEffect(connection.request().signal);
              return new Map(
                response.assets.map((asset) => [
                  asset.path,
                  asset.kind === 'asset' ? asset : null,
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
