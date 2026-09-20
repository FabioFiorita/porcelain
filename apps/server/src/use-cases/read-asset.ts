import { extname } from 'node:path';
import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import type { ByteReader } from '../filesystem/interfaces/file-reader.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';
import { validateFilePath } from './validate-file-path.ts';

const mediaTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};
export class ReadAsset {
  private readonly worktrees: ResolveWorktree;
  private readonly files: ByteReader;
  constructor(worktrees: ResolveWorktree, files: ByteReader) {
    this.worktrees = worktrees;
    this.files = files;
  }
  async execute(worktreeId: string, path: string, signal?: AbortSignal) {
    validateFilePath(path, false);
    const mediaType = mediaTypes[extname(path).toLowerCase()];
    if (!mediaType) throw new FileInspectionError('PATH_NOT_READABLE');
    const worktree = await resolveReadableWorktree(
      this.worktrees,
      worktreeId,
      signal,
    );
    const bytes = await this.files.readBytes(
      { worktreeId, root: worktree.path, path },
      10 * 1024 * 1024,
      signal,
    );
    await resolveReadableWorktree(this.worktrees, worktreeId, signal);
    signal?.throwIfAborted();
    return { path, mediaType, base64: bytes.toString('base64') };
  }
}
