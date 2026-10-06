import { admittedRead, nativeOperation } from '@porcelain/effects';
import type { Dirent } from 'node:fs';
import { lstat, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DirectoryEntry,
  DirectoryRead,
  DirectoryReadInput,
  EntryKind,
} from '@porcelain/files/models';
import { DirectoryReader } from '@porcelain/files/ports';
import { Effect, Layer, type Scope } from 'effect';
import {
  type GuardedPathFailure,
  inspectPath,
  readFailure,
  verifyPath,
} from './inspect-path.ts';
import { openRawDirectory, syscall } from './guarded-filesystem-syscalls.ts';
import {
  listedWorktree,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

const nameDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export const filesystemDirectoryReaderLayer = (
  worktrees: ListedWorktrees,
  options: { gitDirectory: string },
) =>
  Layer.succeed(DirectoryReader, {
    list: Effect.fn('FilesystemDirectoryReader.list')(
      (input: DirectoryReadInput) =>
        admittedRead(
          input.worktreeId,
          Effect.gen(function* () {
            const checkout = yield* nativeOperation((signal) =>
              listedWorktree(worktrees, input.worktreeId, signal),
            );
            const target = { root: checkout.path, path: input.path };
            return yield* Effect.scoped(
              Effect.gen(function* (): Effect.fn.Return<
                DirectoryRead,
                GuardedPathFailure,
                Scope.Scope
              > {
                const before = yield* inspectPath(target);
                if (!before.info.isDirectory())
                  return { kind: 'failed', failure: 'unreadable' };
                const directory = yield* openRawDirectory(before.path);
                const found: { name: string; entry: Dirent }[] = [];
                let truncated = false;
                for (;;) {
                  const entry = yield* syscall(() => directory.read());
                  if (entry === null) break;
                  const name = decodedName(entry.name);
                  if (name === undefined)
                    return { kind: 'failed', failure: 'unsupported-name' };
                  if (found.length === input.limit) {
                    truncated = true;
                    break;
                  }
                  found.push({ name, entry });
                }
                const entries = yield* Effect.forEach(
                  found,
                  ({ name, entry }) =>
                    describe(before.path, name, entry, options.gitDirectory),
                );
                yield* verifyPath(before, target);
                return { kind: 'listed', entries, truncated };
              }),
            ).pipe(
              Effect.catch((error) => {
                const failure = readFailure(error);
                return failure === undefined
                  ? Effect.die(error)
                  : Effect.succeed<DirectoryRead>({ kind: 'failed', failure });
              }),
            );
          }),
        ),
    ),
  });

function decodedName(name: unknown) {
  if (!(name instanceof Uint8Array))
    throw new TypeError('Expected a raw directory name');
  try {
    return nameDecoder.decode(name);
  } catch {
    return undefined;
  }
}

const describe = Effect.fn('FilesystemDirectoryReader.describe')(function* (
  directory: string,
  name: string,
  entry: Dirent,
  gitDirectory: string,
): Effect.fn.Return<DirectoryEntry> {
  const kind = entryKind(entry);
  const full = join(directory, name);
  if (kind === 'symlink') {
    const target = yield* syscall(() => readlink(full)).pipe(
      Effect.catch(() => Effect.succeed(undefined)),
    );
    return target === undefined ? { name, kind } : { name, kind, target };
  }
  if (kind === 'directory') {
    const nested = yield* syscall(() => lstat(join(full, gitDirectory))).pipe(
      Effect.as(true),
      Effect.catch(() => Effect.succeed(false)),
    );
    return { name, kind: nested ? 'submodule' : kind };
  }
  return { name, kind };
});

function entryKind(entry: Dirent): EntryKind {
  if (entry.isSymbolicLink()) return 'symlink';
  if (entry.isDirectory()) return 'directory';
  if (entry.isFile()) return 'file';
  return 'other';
}
