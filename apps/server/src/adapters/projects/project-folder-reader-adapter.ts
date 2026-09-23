import { lstat, opendir, realpath, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  FolderEntry,
  FolderSearch,
  FolderSearchResult,
  ProjectFolderContents,
} from '@porcelain/projects/models';
import type { ProjectFolderReader } from '@porcelain/projects/ports';
import { decodeDirectoryName } from '../files/decode-directory-name.ts';
import { mapFilesystemError } from '../files/map-filesystem-error.ts';

const ENTRY_LIMIT = 2000;
const UNREADABLE_CODES = [
  'ENOENT',
  'ENOTDIR',
  'EACCES',
  'EPERM',
  'ELOOP',
  'EISDIR',
  'ENXIO',
];

type NameDecoder = (name: unknown) => string | undefined;

const strictName: NameDecoder = decodeDirectoryName;

const lenientName: NameDecoder = (name) => {
  if (!Buffer.isBuffer(name)) return undefined;
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      name,
    );
  } catch {
    return undefined;
  }
};

function hasCode(error: unknown, codes: readonly string[]): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    codes.includes(String(error.code))
  );
}

export class ProjectFolderReaderAdapter implements ProjectFolderReader {
  async read(
    path: string,
    signal?: AbortSignal,
  ): Promise<ProjectFolderContents> {
    try {
      const contents = await this.contents(path, strictName, signal);
      if (!contents) throw new Error('Expected a decodable directory');
      return contents;
    } catch (error) {
      return mapFilesystemError(error);
    }
  }

  async search(
    search: FolderSearch,
    signal?: AbortSignal,
  ): Promise<FolderSearchResult> {
    const skipped = new Set(search.skippedNames);
    const queue = search.roots.map((path) => ({ path, depth: 0 }));
    const visited = new Set<string>();
    const candidates: string[] = [];
    let limited = false;
    for (let index = 0; index < queue.length; index++) {
      signal?.throwIfAborted();
      if (index >= search.maxFolders) {
        limited = true;
        break;
      }
      const next = queue[index];
      if (!next) break;
      const folder = await this.readable(next.path, signal);
      if (!folder) {
        limited = true;
        continue;
      }
      if (visited.has(folder.path)) continue;
      visited.add(folder.path);
      limited ||= folder.truncated;
      if (folder.gitMarker) {
        candidates.push(folder.path);
        continue;
      }
      const children = folder.directories.filter(
        (entry) =>
          !entry.symbolicLink &&
          !(search.skipHidden && entry.name.startsWith('.')) &&
          !skipped.has(entry.name),
      );
      if (next.depth >= search.maxDepth) {
        limited ||= children.length > 0;
        continue;
      }
      for (const child of children) {
        if (queue.length >= search.maxFolders) {
          limited = true;
          break;
        }
        queue.push({ path: child.path, depth: next.depth + 1 });
      }
    }
    return { candidates, limited };
  }

  private async readable(
    path: string,
    signal?: AbortSignal,
  ): Promise<ProjectFolderContents | undefined> {
    try {
      return await this.contents(path, lenientName, signal);
    } catch (error) {
      signal?.throwIfAborted();
      if (hasCode(error, UNREADABLE_CODES)) return undefined;
      throw error;
    }
  }

  private async contents(
    requestedPath: string,
    decode: NameDecoder,
    signal?: AbortSignal,
  ): Promise<ProjectFolderContents | undefined> {
    signal?.throwIfAborted();
    const path = await realpath(requestedPath);
    const directory = await opendir(path, { encoding: 'buffer' });
    const directories: FolderEntry[] = [];
    let count = 0;
    let truncated = false;
    for await (const entry of directory) {
      signal?.throwIfAborted();
      if (++count > ENTRY_LIMIT) {
        truncated = true;
        break;
      }
      const name = decode(entry.name);
      if (name === undefined) return undefined;
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
                hasCode(error, [
                  'ENOENT',
                  'ENOTDIR',
                  'EACCES',
                  'EPERM',
                  'ELOOP',
                ])
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
        if (hasCode(error, ['ENOENT', 'EACCES', 'EPERM'])) return false;
        throw error;
      },
    );
    signal?.throwIfAborted();
    return {
      path,
      parent: dirname(path) === path ? undefined : dirname(path),
      directories: directories.sort((a, b) => a.name.localeCompare(b.name)),
      gitMarker,
      truncated,
    };
  }
}
