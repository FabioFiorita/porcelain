import type {
  PreviewAsset,
  ReadPreviewAssetsInput,
  ReadPreviewAssetsResult,
} from '../models/read-preview-assets.ts';
import type { FileReader } from '../ports/file-reader.ts';
import { assetMediaType } from '../rules/asset-media-type.ts';
import { encodeBase64 } from '../rules/encode-base64.ts';
import { isWorktreeRelativePath } from '../rules/worktree-relative-path.ts';

export type ReadPreviewAssetsOptions = {
  maxAssetBytes: number;
  maxTotalBytes: number;
};

const LIMITS: ReadPreviewAssetsOptions = {
  maxAssetBytes: 10 * 1024 * 1024,
  maxTotalBytes: 16 * 1024 * 1024,
};

export class ReadPreviewAssetsService {
  private readonly fileReader: FileReader;
  private readonly options: ReadPreviewAssetsOptions;

  constructor(
    fileReader: FileReader,
    options: ReadPreviewAssetsOptions = LIMITS,
  ) {
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
      signal?.throwIfAborted();
      const mediaType = assetMediaType(path);
      const bytes =
        mediaType === undefined || remaining <= 0 || !inside(directory, path)
          ? undefined
          : await this.read(
              { worktreeId: input.worktreeId, path },
              Math.min(this.options.maxAssetBytes, remaining),
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
        base64: encodeBase64(bytes),
      });
    }
    return { assets };
  }

  private async read(
    location: { worktreeId: string; path: string },
    maxBytes: number,
    signal?: AbortSignal,
  ): Promise<Uint8Array | undefined> {
    try {
      const read = await this.fileReader.read(location, maxBytes, signal);
      return read.kind === 'file' ? read.bytes : undefined;
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof Error && error.name === 'AbortError') throw error;
      return undefined;
    }
  }
}

function inside(directory: string, path: string) {
  return (
    isWorktreeRelativePath(path) &&
    (directory === '' || path.startsWith(`${directory}/`))
  );
}
