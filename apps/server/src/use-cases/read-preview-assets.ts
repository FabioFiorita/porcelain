import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import type { ByteReader } from '../filesystem/interfaces/file-reader.ts';
import { assetMediaType } from './asset-media-types.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';
import { validateFilePath } from './validate-file-path.ts';

export type PreviewAsset =
  | { kind: 'asset'; path: string; mediaType: string; base64: string }
  | { kind: 'unavailable'; path: string };

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;

export class ReadPreviewAssets {
  private readonly worktrees: ResolveWorktree;
  private readonly files: ByteReader;
  constructor(worktrees: ResolveWorktree, files: ByteReader) {
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
    const worktree = await resolveReadableWorktree(
      this.worktrees,
      worktreeId,
      signal,
    );
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
      if (bytes === null) {
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
    const after = await resolveReadableWorktree(
      this.worktrees,
      worktreeId,
      signal,
    );
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
  ): Promise<Buffer | null> {
    try {
      validateFilePath(path, false);
      if (directory !== '' && !path.startsWith(`${directory}/`)) return null;
      if (!assetMediaType(path)) return null;
      if (remaining <= 0) return null;
      return await this.files.readBytes(
        { worktreeId, root, path },
        Math.min(MAX_ASSET_BYTES, remaining),
        signal,
      );
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof Error && error.name === 'AbortError') throw error;
      return null;
    }
  }
}
