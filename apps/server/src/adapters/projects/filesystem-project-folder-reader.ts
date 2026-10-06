import { Effect, FileSystem, Layer, Path } from 'effect';
import { lstat, stat } from 'node:fs/promises';
import type {
  FolderEntry,
  ProjectFolderRead,
  ReadProjectFolderInput,
} from '@porcelain/projects/models';
import { ProjectFolderReader } from '@porcelain/projects/ports';
import {
  openRawDirectory,
  syscall,
} from '../files/guarded-filesystem-syscalls.ts';

const UNREADABLE_CODES = [
  'ENOENT',
  'ENOTDIR',
  'EACCES',
  'EPERM',
  'ELOOP',
  'EISDIR',
  'ENXIO',
];
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
  if (error instanceof Error && 'code' in error)
    return codes.includes(String(error.code));
  if (error instanceof Error && 'cause' in error)
    return hasCode(error.cause, codes);
  return false;
}

export const filesystemProjectFolderReaderLayer = (options: {
  gitDirectory: string;
}) =>
  Layer.effect(
    ProjectFolderReader,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const pathApi = yield* Path.Path;
      return {
        read: Effect.fn('FilesystemProjectFolderReader.read')(
          (input: ReadProjectFolderInput) =>
            Effect.scoped(
              Effect.gen(function* () {
                const path = yield* fs.realPath(input.path);
                const directory = yield* openRawDirectory(path);
                const directories: FolderEntry[] = [];
                let count = 0;
                let truncated = false;
                for (;;) {
                  const entry = yield* syscall(() => directory.read());
                  if (entry === null) break;
                  if (++count > input.maxEntries) {
                    truncated = true;
                    break;
                  }
                  const name = decodedName(entry.name);
                  if (name === undefined)
                    return {
                      kind: 'unsupported-name',
                    } satisfies ProjectFolderRead;
                  const child = pathApi.join(path, name);
                  const symbolicLink = entry.isSymbolicLink();
                  const isDirectory =
                    entry.isDirectory() ||
                    (symbolicLink &&
                      (yield* syscall(() => stat(child)).pipe(
                        Effect.map((info) => info.isDirectory()),
                        Effect.catch((error) =>
                          hasCode(error, [
                            'ENOENT',
                            'ENOTDIR',
                            'EACCES',
                            'EPERM',
                            'ELOOP',
                          ])
                            ? Effect.succeed(false)
                            : Effect.fail(error),
                        ),
                      )));
                  if (isDirectory)
                    directories.push({ name, path: child, symbolicLink });
                }
                const gitMarker = yield* syscall(() =>
                  lstat(pathApi.join(path, options.gitDirectory)),
                ).pipe(
                  Effect.map((info) => info.isDirectory() || info.isFile()),
                  Effect.catch((error) =>
                    hasCode(error, ['ENOENT', 'EACCES', 'EPERM'])
                      ? Effect.succeed(false)
                      : Effect.fail(error),
                  ),
                );
                return {
                  kind: 'read',
                  contents: {
                    path,
                    parent:
                      pathApi.dirname(path) === path
                        ? undefined
                        : pathApi.dirname(path),
                    directories: directories.sort((a, b) =>
                      a.name.localeCompare(b.name),
                    ),
                    gitMarker,
                    truncated,
                  },
                } satisfies ProjectFolderRead;
              }),
            ).pipe(
              Effect.catch((error) => {
                if (hasCode(error, ['ENOENT']))
                  return Effect.succeed<ProjectFolderRead>({ kind: 'missing' });
                if (hasCode(error, UNREADABLE_CODES))
                  return Effect.succeed<ProjectFolderRead>({
                    kind: 'unreadable',
                  });
                return Effect.die(error);
              }),
            ),
        ),
      };
    }),
  );
