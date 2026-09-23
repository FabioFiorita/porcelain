import { validateFilePath } from '../errors/validate-file-path.ts';
import { FileInspectionError } from '../errors/file-inspection-error.ts';
import type { FileAsset } from '../models/file-content.ts';
import type { ByteReader } from '../ports/file-reader.ts';
import type { ReachableWorktreeReader } from '../ports/reachable-worktree.ts';
import { assetMediaType } from '../models/asset-media-types.ts';

export class ReadAssetService {
  private readonly worktrees: ReachableWorktreeReader;
  private readonly files: ByteReader;

  constructor(worktrees: ReachableWorktreeReader, files: ByteReader) {
    this.worktrees = worktrees;
    this.files = files;
  }

  async execute(
    worktreeId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<FileAsset> {
    validateFilePath(path, false);
    const mediaType = assetMediaType(path);
    if (!mediaType) throw new FileInspectionError('PATH_NOT_READABLE');
    const worktree = await this.worktrees.reachable(worktreeId, signal);
    const bytes = await this.files.readBytes(
      { worktreeId, root: worktree.path, path },
      10 * 1024 * 1024,
      signal,
    );
    await this.worktrees.reachable(worktreeId, signal);
    signal?.throwIfAborted();
    return { path, mediaType, base64: bytes.toString('base64') };
  }
}
