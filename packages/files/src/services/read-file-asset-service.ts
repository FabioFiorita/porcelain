import { ReadFileAssetOptions } from '../ports/read-file-asset-options.ts';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { encodeBase64 } from '@porcelain/kernel/rules';
import { Effect, Context, Layer } from 'effect';
import { ContentChangedError } from '../errors/content-changed-error.ts';
import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import { PathNotFoundError } from '../errors/path-not-found-error.ts';
import { PathNotReadableError } from '../errors/path-not-readable-error.ts';
import { UnsupportedAssetTypeError } from '../errors/unsupported-asset-type-error.ts';
import { type ReadFailure } from '../models/file-failure.ts';
import {
  type ReadFileAssetInput,
  type ReadFileAssetResult,
} from '../models/read-file-asset.ts';
import { FileReader } from '../ports/file-reader.ts';
import { assetMediaType } from '../rules/asset-media-type.ts';

type ReadFailureError =
  | PathNotFoundError
  | PathNotReadableError
  | ContentChangedError;

export type ReadFileAssetFailure =
  | ReadFailureError
  | FileTooLargeError
  | UnsupportedAssetTypeError;

export class ReadFileAssetService extends Context.Service<
  ReadFileAssetService,
  {
    readonly execute: (
      input: ReadFileAssetInput,
    ) => Effect.Effect<ReadFileAssetResult, ReadFileAssetFailure, WorktreeRead>;
  }
>()('@porcelain/files/ReadFileAssetService') {
  static readonly layer = Layer.effect(
    ReadFileAssetService,
    Effect.gen(function* () {
      const fileReaderCapability = yield* FileReader;
      const optionsCapability = yield* ReadFileAssetOptions;
      function operationFailure(failure: ReadFailure): ReadFailureError {
        switch (failure) {
          case 'missing':
            return new PathNotFoundError();
          case 'unreadable':
            return new PathNotReadableError();
          case 'changed':
            return new ContentChangedError();
        }
      }
      return {
        execute: Effect.fn('ReadFileAssetService.execute')(function* (
          input: ReadFileAssetInput,
        ): Effect.fn.Return<
          ReadFileAssetResult,
          ReadFileAssetFailure,
          WorktreeRead
        > {
          const mediaType = assetMediaType(input.path);
          if (mediaType === undefined)
            return yield* new UnsupportedAssetTypeError();
          const read = yield* fileReaderCapability.read({
            worktreeId: input.worktreeId,
            path: input.path,
            maxBytes: optionsCapability.maxBytes,
          });
          if (read.kind === 'failed')
            return yield* Effect.fail(operationFailure(read.failure));
          if (read.kind === 'too-large') return yield* new FileTooLargeError();
          return {
            path: input.path,
            mediaType,
            base64: encodeBase64(
              read.bytes,
              optionsCapability.base64ChunkBytes,
            ),
          };
        }),
      };
    }),
  );
}
