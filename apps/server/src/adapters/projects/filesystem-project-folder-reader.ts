import { lstat, opendir, realpath, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  FolderEntry,
  FolderSearch,
  FolderSearchResult,
  ProjectFolderContents,
  ProjectFolderRead,
  ReadProjectFolderInput,
} from '@porcelain/projects/models';
import type { ProjectFolderReader } from '@porcelain/projects/ports';

const UNREADABLE_CODES = [
  'ENOENT',
  'ENOTDIR',
  'EACCES',
  'EPERM',
  'ELOOP',
  'EISDIR',
  'ENXIO',
];

const MISSING_CODES = ['ENOENT'];

function decodedName(name: unknown): string | undefined {
  if (!Buffer.isBuffer(name)) return undefined;
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      name,
    );
  } catch {
    return undefined;
  }
}

function hasCode(error: unknown, codes: readonly string[]): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    codes.includes(String(error.code))
  );
}

export class FilesystemProjectFolderReader implements ProjectFolderReader {
  private readonly options: { gitDirectory: string };

  constructor(options: { gitDirectory: string }) {
    this.options = options;
  }

  async read(
    input: ReadProjectFolderInput,
    signal?: AbortSignal,
  ): Promise<ProjectFolderRead> {
    try {
      const contents = await this.contents(input, signal);
      return contents
        ? { kind: 'read', contents }
        : { kind: 'unsupported-name' };
    } catch (error) {
      if (hasCode(error, MISSING_CODES)) return { kind: 'missing' };
      if (hasCode(error, UNREADABLE_CODES)) return { kind: 'unreadable' };
      throw error;
    }
  }

  async search(
    input: FolderSearch,
    signal?: AbortSignal,
  ): Promise<FolderSearchResult> {
    const skipped = new Set(input.skippedNames);
    const queue = input.roots.map((path) => ({ path, depth: 0 }));
    const visited = new Set<string>();
    const candidates: string[] = [];
    let limited = false;
    for (let index = 0; index < queue.length; index++) {
      signal?.throwIfAborted();
      if (index >= input.maxFolders) {
        limited = true;
        break;
      }
      const next = queue[index];
      if (!next) break;
      const folder = await this.readable(
        { path: next.path, maxEntries: input.maxEntries },
        signal,
      );
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
          !(input.skipHidden && entry.name.startsWith('.')) &&
          !skipped.has(entry.name),
      );
      if (next.depth >= input.maxDepth) {
        limited ||= children.length > 0;
        continue;
      }
      for (const child of children) {
        if (queue.length >= input.maxFolders) {
          limited = true;
          break;
        }
        queue.push({ path: child.path, depth: next.depth + 1 });
      }
    }
    return { candidates, limited };
  }

  private async readable(
    input: ReadProjectFolderInput,
    signal?: AbortSignal,
  ): Promise<ProjectFolderContents | undefined> {
    try {
      return await this.contents(input, signal);
    } catch (error) {
      signal?.throwIfAborted();
      if (hasCode(error, UNREADABLE_CODES)) return undefined;
      throw error;
    }
  }

  private async contents(
    input: ReadProjectFolderInput,
    signal?: AbortSignal,
  ): Promise<ProjectFolderContents | undefined> {
    signal?.throwIfAborted();
    const path = await realpath(input.path);
    const directory = await opendir(path, { encoding: 'buffer' });
    const directories: FolderEntry[] = [];
    let count = 0;
    let truncated = false;
    for await (const entry of directory) {
      signal?.throwIfAborted();
      if (++count > input.maxEntries) {
        truncated = true;
        break;
      }
      const name = decodedName(entry.name);
      if (name === undefined) return undefined;
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
    const gitMarker = await lstat(join(path, this.options.gitDirectory)).then(
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
