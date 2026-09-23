import { validateFilePath } from '../errors/validate-file-path.ts';
import { FileInspectionError } from '../errors/file-inspection-error.ts';
import type { PreviewAsset } from '../models/file-content.ts';
import type { ByteReader } from '../ports/file-reader.ts';
import type { ReachableWorktreeReader } from '../ports/reachable-worktree.ts';
import { assetMediaType } from '../models/asset-media-types.ts';

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;

export class ReadPreviewAssetsService {
  private readonly worktrees: ReachableWorktreeReader;
  private readonly files: ByteReader;

  constructor(worktrees: ReachableWorktreeReader, files: ByteReader) {
    this.worktrees = worktrees;
    this.files = files;
  }

  async execute(
    worktreeId: string,
    document: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<PreviewAsset[]> {
    validateFilePath(document, false);
    const directory = document.includes('/')
      ? document.slice(0, document.lastIndexOf('/'))
      : '';
    const wanted = [...new Set(paths)];
    const worktree = await this.worktrees.reachable(worktreeId, signal);
    const results: PreviewAsset[] = [];
    let total = 0;
    for (const path of wanted) {
      signal?.throwIfAborted();
      const bytes = await this.read(
        worktreeId,
        worktree.path,
        directory,
        path,
        MAX_TOTAL_BYTES - total,
        signal,
      );
      if (bytes === undefined) {
        results.push({ kind: 'unavailable', path });
        continue;
      }
      total += bytes.length;
      results.push({
        kind: 'asset',
        path,
        mediaType: assetMediaType(path) ?? 'application/octet-stream',
        base64: bytes.toString('base64'),
      });
    }
    const after = await this.worktrees.reachable(worktreeId, signal);
    if (
      after.path !== worktree.path ||
      after.metadataIdentity !== worktree.metadataIdentity
    )
      throw new FileInspectionError('REPOSITORY_UNAVAILABLE');
    signal?.throwIfAborted();
    return results;
  }

  private async read(
    worktreeId: string,
    root: string,
    directory: string,
    path: string,
    remaining: number,
    signal?: AbortSignal,
  ): Promise<Buffer | undefined> {
    try {
      validateFilePath(path, false);
      if (directory !== '' && !path.startsWith(`${directory}/`))
        return undefined;
      if (!assetMediaType(path)) return undefined;
      if (remaining <= 0) return undefined;
      return await this.files.readBytes(
        { worktreeId, root, path },
        Math.min(MAX_ASSET_BYTES, remaining),
        signal,
      );
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof Error && error.name === 'AbortError') throw error;
      return undefined;
    }
  }
}
