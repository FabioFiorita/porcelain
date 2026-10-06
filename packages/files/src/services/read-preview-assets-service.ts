import { ReadPreviewAssetsOptions } from '../ports/read-preview-assets-options.ts';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { encodeBase64, isRelativePath } from '@porcelain/kernel/rules';
import { Effect, Context, Layer } from 'effect';
import { type FileReadInput } from '../models/file-read.ts';
import { type PreviewAsset } from '../models/preview-asset.ts';
import {
  type ReadPreviewAssetsInput,
  type ReadPreviewAssetsResult,
} from '../models/read-preview-assets.ts';
import { FileReader } from '../ports/file-reader.ts';
import { assetMediaType } from '../rules/asset-media-type.ts';

export class ReadPreviewAssetsService extends Context.Service<
  ReadPreviewAssetsService,
  {
    readonly execute: (
      input: ReadPreviewAssetsInput,
    ) => Effect.Effect<ReadPreviewAssetsResult, never, WorktreeRead>;
  }
>()('@porcelain/files/ReadPreviewAssetsService') {
  static readonly layer = Layer.effect(
    ReadPreviewAssetsService,
    Effect.gen(function* () {
      const fileReaderCapability = yield* FileReader;
      const optionsCapability = yield* ReadPreviewAssetsOptions;
      function operationServable(directory: string, path: string): boolean {
        return (
          isRelativePath(path, optionsCapability.maxPathLength) &&
          (directory === '' || path.startsWith(`${directory}/`))
        );
      }
      const operationRead = Effect.fn('ReadPreviewAssetsService.read')(
        function* (
          input: FileReadInput,
        ): Effect.fn.Return<Uint8Array | undefined, never, WorktreeRead> {
          const read = yield* fileReaderCapability.read(input);
          return read.kind === 'file' && read.bytes.length <= input.maxBytes
            ? read.bytes
            : undefined;
        },
      );
      return {
        execute: Effect.fn('ReadPreviewAssetsService.execute')(function* (
          input: ReadPreviewAssetsInput,
        ): Effect.fn.Return<ReadPreviewAssetsResult, never, WorktreeRead> {
          const directory = input.document.includes('/')
            ? input.document.slice(0, input.document.lastIndexOf('/'))
            : '';
          const assets: PreviewAsset[] = [];
          let remaining = optionsCapability.maxTotalBytes;
          for (const path of new Set(input.paths)) {
            const mediaType = assetMediaType(path);
            const bytes =
              mediaType === undefined ||
              remaining <= 0 ||
              !operationServable(directory, path)
                ? undefined
                : yield* operationRead({
                    worktreeId: input.worktreeId,
                    path,
                    maxBytes: Math.min(
                      optionsCapability.maxAssetBytes,
                      remaining,
                    ),
                  });
            if (mediaType === undefined || bytes === undefined) {
              assets.push({ kind: 'unavailable', path });
              continue;
            }
            remaining -= bytes.length;
            assets.push({
              kind: 'asset',
              path,
              mediaType,
              base64: encodeBase64(bytes, optionsCapability.base64ChunkBytes),
            });
          }
          return { assets };
        }),
      };
    }),
  );
}
