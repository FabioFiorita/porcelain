import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import { UnsupportedAssetTypeError } from '../errors/unsupported-asset-type-error.ts';
import type {
  ReadFileAssetInput,
  ReadFileAssetResult,
} from '../models/read-file-asset.ts';
import type { FileReader } from '../ports/file-reader.ts';
import { assetMediaType } from '../rules/asset-media-type.ts';
import { encodeBase64 } from '../rules/encode-base64.ts';
import { fileFailureError } from '../rules/file-failure-error.ts';

export type ReadFileAssetOptions = { maxBytes: number };

const LIMITS: ReadFileAssetOptions = { maxBytes: 10 * 1024 * 1024 };

export class ReadFileAssetService {
  private readonly fileReader: FileReader;
  private readonly options: ReadFileAssetOptions;

  constructor(fileReader: FileReader, options: ReadFileAssetOptions = LIMITS) {
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
      input,
      this.options.maxBytes,
      signal,
    );
    if (read.kind === 'too-large') throw new FileTooLargeError();
    if (read.kind === 'failed') throw fileFailureError(read.failure);
    return { path: input.path, mediaType, base64: encodeBase64(read.bytes) };
  }
}
