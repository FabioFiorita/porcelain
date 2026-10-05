import type { WorktreeRead } from '@porcelain/effects/worktree';
import { encodeBase64 } from '@porcelain/kernel/rules';
import { Effect } from 'effect';
import { ContentChangedError } from '../errors/content-changed-error.ts';
import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import { PathNotFoundError } from '../errors/path-not-found-error.ts';
import { PathNotReadableError } from '../errors/path-not-readable-error.ts';
import { UnsupportedAssetTypeError } from '../errors/unsupported-asset-type-error.ts';
import type { ReadFailure } from '../models/file-failure.ts';
import type {
  ReadFileAssetInput,
  ReadFileAssetOptions,
  ReadFileAssetResult,
} from '../models/read-file-asset.ts';
import type { FileReader } from '../ports/file-reader.ts';
import { assetMediaType } from '../rules/asset-media-type.ts';

type ReadFailureError =
  | PathNotFoundError
  | PathNotReadableError
  | ContentChangedError;

export type ReadFileAssetFailure =
  | ReadFailureError
  | FileTooLargeError
  | UnsupportedAssetTypeError;

export class ReadFileAssetService {
  private readonly fileReader: FileReader;
  private readonly options: ReadFileAssetOptions;

  constructor(fileReader: FileReader, options: ReadFileAssetOptions) {
    this.fileReader = fileReader;
    this.options = options;
  }

  execute(
    input: ReadFileAssetInput,
  ): Effect.Effect<ReadFileAssetResult, ReadFileAssetFailure, WorktreeRead> {
    return Effect.gen({ self: this }, function* () {
      const mediaType = assetMediaType(input.path);
      if (mediaType === undefined)
        return yield* new UnsupportedAssetTypeError();
      const read = yield* this.fileReader.read({
        worktreeId: input.worktreeId,
        path: input.path,
        maxBytes: this.options.maxBytes,
      });
      if (read.kind === 'failed')
        return yield* Effect.fail(this.failure(read.failure));
      if (read.kind === 'too-large') return yield* new FileTooLargeError();
      return {
        path: input.path,
        mediaType,
        base64: encodeBase64(read.bytes, this.options.base64ChunkBytes),
      };
    });
  }

  private failure(failure: ReadFailure): ReadFailureError {
    switch (failure) {
      case 'missing':
        return new PathNotFoundError();
      case 'unreadable':
        return new PathNotReadableError();
      case 'changed':
        return new ContentChangedError();
    }
  }
}
