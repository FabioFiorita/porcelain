import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import type { ByteReader } from '../filesystem/interfaces/file-reader.ts';
import { assetMediaType } from './asset-media-types.ts';
import { resolveReadableWorktree } from './resolve-readable-worktree.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';
import { validateFilePath } from './validate-file-path.ts';

/** One asset, or the one answer given for every reason it could not be read. */
export type PreviewAsset =
  | { kind: 'asset'; path: string; mediaType: string; base64: string }
  | { kind: 'unavailable'; path: string };

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
/**
 * Every asset of one preview together. Counted as each file is read rather
 * than after them all, so a request for sixty-four large files stops at the
 * cap instead of allocating its way there first.
 */
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;

/**
 * The assets one previewed HTML file needs, bounded to its own directory.
 *
 * The document's path is part of the request because it is what defines the
 * bound. The browser resolves `../secrets.js` before asking, so a path that
 * left the document's folder arrives looking ordinary — the server has to know
 * which folder the preview belongs to in order to refuse it. Without this a
 * previewed file can make Porcelain read any allow-listed file anywhere in the
 * worktree, which is a capability the person never granted it.
 *
 * Reads are sequential and each one keeps the checks the single-asset route
 * has: the extension allow-list, per-file validation, the 10 MiB cap, a read
 * that does not follow a final symlink, and the worktree confirmed again after
 * the bytes are in hand.
 */
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
    // Asking twice for the same file should not buy twice the budget.
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
    // Every read used the path resolved before the loop. Re-resolving only
    // proves something is still there, so the answer does not leave until the
    // something is the same one: a checkout replaced part-way through would
    // otherwise have its bytes returned as the authorised worktree's.
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

  /**
   * Null for every reason a preview may not have this file. A preview is
   * untrusted input, so it is told the same thing whether the file is missing,
   * outside its folder, of a kind that is never served, or too large: telling
   * it apart is how it would map the worktree.
   */
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
