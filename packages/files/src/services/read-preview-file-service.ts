import type { WorktreeRead } from '@porcelain/effects/worktree';
import { isRelativePath } from '@porcelain/kernel/rules';
import { Context, Effect, Layer, type Scope } from 'effect';
import type { PreviewFile } from '../models/preview-file.ts';
import { PreviewFileReader } from '../ports/preview-file-reader.ts';
import { ReadPreviewAssetsOptions } from '../ports/read-preview-assets-options.ts';
import { assetMediaType } from '../rules/asset-media-type.ts';

export class ReadPreviewFileService extends Context.Service<
  ReadPreviewFileService,
  {
    readonly execute: (input: {
      worktreeId: string;
      path: string;
    }) => Effect.Effect<
      PreviewFile | undefined,
      never,
      WorktreeRead | Scope.Scope
    >;
  }
>()('@porcelain/files/ReadPreviewFileService') {
  static readonly layer = Layer.effect(
    ReadPreviewFileService,
    Effect.gen(function* () {
      const reader = yield* PreviewFileReader;
      const { maxPathLength } = yield* ReadPreviewAssetsOptions;
      return {
        execute: Effect.fn('ReadPreviewFileService.execute')(function* (input) {
          const { path } = input;
          const unescaped = path.replace(
            /%(?:25)*(2e|2f|5c|00)/gi,
            (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)),
          );
          if (
            !isRelativePath(path, maxPathLength) ||
            !isRelativePath(unescaped, maxPathLength)
          )
            return undefined;
          const file = yield* reader.open(input);
          if (!file) return undefined;
          const mediaType = assetMediaType(path);
          return {
            ...file,
            mediaType:
              !mediaType || mediaType === 'text/javascript'
                ? 'text/plain; charset=utf-8'
                : mediaType,
          };
        }),
      };
    }),
  );
}
