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
import { encodeBase64 } from '../rules/encode-base64.ts';

export class ReadFileAssetService {
  private readonly fileReader: FileReader;
  private readonly options: ReadFileAssetOptions;

  constructor(fileReader: FileReader, options: ReadFileAssetOptions) {
    this.fileReader = fileReader;
    this.options = options;
  }

  async execute(
    input: ReadFileAssetInput,
    signal?: AbortSignal,
  ): Promise<ReadFileAssetResult> {
    const mediaType = assetMediaType(input.path);
    if (mediaType === undefined) throw new UnsupportedAssetTypeError();
    const read = await this.fileReader.read(
      {
        worktreeId: input.worktreeId,
        path: input.path,
        maxBytes: this.options.maxBytes,
      },
      signal,
    );
    if (read.kind === 'failed') throw this.failure(read.failure);
    if (read.kind === 'too-large' || read.bytes.length > this.options.maxBytes)
      throw new FileTooLargeError();
    return {
      path: input.path,
      mediaType,
      base64: encodeBase64(read.bytes, this.options.base64ChunkBytes),
    };
  }

  private failure(failure: ReadFailure): Error {
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
