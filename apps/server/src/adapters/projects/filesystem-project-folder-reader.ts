import { lstat, opendir, realpath, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  FolderEntry,
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
