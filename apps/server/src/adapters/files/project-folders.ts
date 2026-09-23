import { lstat, opendir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { decodeDirectoryName } from './decode-directory-name.ts';
import { FileInspectionError } from '@porcelain/files/errors';
import type {
  ProjectFolderContents as FolderContents,
  ProjectFolderReader as ProjectFolders,
} from '@porcelain/projects/ports';
import { mapFilesystemError } from './map-filesystem-error.ts';

export class NodeProjectFolders implements ProjectFolders {
  async read(
    requestedPath: string,
    signal?: AbortSignal,
  ): Promise<FolderContents> {
    if (!isAbsolute(requestedPath) || requestedPath.includes('\0'))
      throw new FileInspectionError('INVALID_REQUEST');
    try {
      signal?.throwIfAborted();
      const path = await realpath(requestedPath);
      const directory = await opendir(path, { encoding: 'buffer' });
      const directories: FolderContents['directories'] = [];
      let count = 0;
      let truncated = false;
      for await (const entry of directory) {
        signal?.throwIfAborted();
        if (++count > 2000) {
          truncated = true;
          break;
        }
        const name = decodeDirectoryName(entry.name);
        if (name === '.git') continue;
        const child = join(path, name);
        const symbolicLink = entry.isSymbolicLink();
        if (
          entry.isDirectory() ||
          (symbolicLink &&
            (await stat(child).then(
              (info) => info.isDirectory(),
              (error: unknown) => {
                if (
                  error instanceof Error &&
                  'code' in error &&
                  ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'ELOOP'].includes(
                    String(error.code),
                  )
                )
                  return false;
                throw error;
              },
            )))
        )
          directories.push({ name, path: child, symbolicLink });
      }
      const gitMarker = await lstat(join(path, '.git')).then(
        (info) => info.isDirectory() || info.isFile(),
        (error: unknown) => {
          if (
            error instanceof Error &&
            'code' in error &&
            ['ENOENT', 'EACCES', 'EPERM'].includes(String(error.code))
          )
            return false;
          throw error;
        },
      );
      signal?.throwIfAborted();
      return {
        path,
        parent: dirname(path) === path ? null : dirname(path),
        directories: directories.sort((a, b) => a.name.localeCompare(b.name)),
        gitMarker,
        truncated,
      };
    } catch (error) {
      return mapFilesystemError(error);
    }
  }
}
