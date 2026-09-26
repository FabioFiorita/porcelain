import { isRelativePath } from '@porcelain/kernel/rules';
import type { FileReadInput } from '../models/file-read.ts';
import type { PreviewAsset } from '../models/preview-asset.ts';
import type {
  ReadPreviewAssetsInput,
  ReadPreviewAssetsOptions,
  ReadPreviewAssetsResult,
} from '../models/read-preview-assets.ts';
import type { FileReader } from '../ports/file-reader.ts';
import { assetMediaType } from '../rules/asset-media-type.ts';
import { encodeBase64 } from '../rules/encode-base64.ts';

export class ReadPreviewAssetsService {
  private readonly fileReader: FileReader;
  private readonly options: ReadPreviewAssetsOptions;

  constructor(fileReader: FileReader, options: ReadPreviewAssetsOptions) {
    this.fileReader = fileReader;
    this.options = options;
  }

  async execute(
    input: ReadPreviewAssetsInput,
    signal?: AbortSignal,
  ): Promise<ReadPreviewAssetsResult> {
    const directory = input.document.includes('/')
      ? input.document.slice(0, input.document.lastIndexOf('/'))
      : '';
    const assets: PreviewAsset[] = [];
    let remaining = this.options.maxTotalBytes;
    for (const path of new Set(input.paths)) {
      const mediaType = assetMediaType(path);
      const bytes =
        mediaType === undefined ||
        remaining <= 0 ||
        !this.servable(directory, path)
          ? undefined
          : await this.read(
              {
                worktreeId: input.worktreeId,
                path,
                maxBytes: Math.min(this.options.maxAssetBytes, remaining),
              },
              signal,
            );
      if (mediaType === undefined || bytes === undefined) {
        assets.push({ kind: 'unavailable', path });
        continue;
      }
      remaining -= bytes.length;
      assets.push({
        kind: 'asset',
        path,
        mediaType,
        base64: encodeBase64(bytes, this.options.base64ChunkBytes),
      });
    }
    return { assets };
  }

  private servable(directory: string, path: string): boolean {
    return (
      isRelativePath(path, this.options.maxPathLength) &&
      (directory === '' || path.startsWith(`${directory}/`))
    );
  }

  private async read(
    input: FileReadInput,
    signal?: AbortSignal,
  ): Promise<Uint8Array | undefined> {
    const read = await this.fileReader.read(input, signal);
    return read.kind === 'file' && read.bytes.length <= input.maxBytes
      ? read.bytes
      : undefined;
  }
}
