import { lstat, readlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { FileTree } from '../models/file-tree.ts';
import { FileInspectionError } from './errors/file-inspection-error.ts';
import { inspectPath } from './inspect-path.ts';
import type { FileTreeReader } from './interfaces/file-tree-reader.ts';
export class NodeFileTree implements FileTreeReader {
  async read(
    root: string,
    worktreeId: string,
    listed: { paths: string[]; ignored: string[] },
    signal?: AbortSignal,
  ): Promise<FileTree> {
    if (listed.paths.length > 50000)
      throw new FileInspectionError('DIRECTORY_TOO_LARGE');
    const ignored = new Set(
      listed.ignored.map((path) => path.replace(/\/$/, '')),
    );
    const entries: FileTree['entries'] = [];
    for (const candidate of listed.paths) {
      signal?.throwIfAborted();
      const path = candidate.replace(/\/$/, '');
      try {
        const parent = await inspectPath(
          {
            root,
            path: dirname(path) === '.' ? '' : dirname(path),
            worktreeId,
          },
          signal,
        );
        const full = join(parent.path, basename(path));
        const info = await lstat(full);
        const kind = info.isSymbolicLink()
          ? 'symlink'
          : info.isDirectory()
            ? (await lstat(join(full, '.git')).then(
                () => true,
                (error: unknown) => {
                  if (
                    error instanceof Error &&
                    'code' in error &&
                    error.code === 'ENOENT'
                  )
                    return false;
                  throw error;
                },
              ))
              ? 'submodule'
              : 'directory'
            : info.isFile()
              ? 'file'
              : 'other';
        entries.push({
          path: kind === 'directory' ? `${path}/` : path,
          kind,
          ignored: ignored.has(path),
          ...(kind === 'symlink' ? { target: await readlink(full) } : {}),
        });
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            'code' in error &&
            (error.code === 'ENOENT' || error.code === 'PATH_NOT_READABLE')
          )
        )
          throw error;
      }
    }
    const result = { worktreeId, entries };
    if (Buffer.byteLength(JSON.stringify(result)) > 8 * 1024 * 1024)
      throw new FileInspectionError('DIRECTORY_TOO_LARGE');
    return result;
  }
}
