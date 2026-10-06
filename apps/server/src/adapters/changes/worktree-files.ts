import { Effect, type Scope } from 'effect';
import { createHash } from 'node:crypto';
import type { BigIntStats } from 'node:fs';
import { constants } from 'node:fs';
import { lstat, readlink } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import type { WorktreeEntry } from '@porcelain/changes/models';
import {
  openGuardedFile,
  syscall,
} from '../files/guarded-filesystem-syscalls.ts';
import {
  fileIdentity,
  inspectPath,
  type GuardedPathFailure,
  readFailure,
  sameFile,
  unchanged,
  verifyPath,
} from '../files/inspect-path.ts';

export type WorktreeReadOptions = { chunkBytes: number; concurrency: number };

export const readWorktreeFiles = Effect.fn('readWorktreeFiles')(function* (
  root: string,
  paths: readonly string[],
  maxDigestBytes: number,
  options: WorktreeReadOptions,
) {
  const entries = yield* Effect.forEach(
    [...new Set(paths)],
    (path) =>
      readEntry(
        root,
        path,
        maxDigestBytes,
        Buffer.alloc(options.chunkBytes),
      ).pipe(
        Effect.map((entry) => [path, entry] as const),
        Effect.catch((error) =>
          Effect.succeed([
            path,
            readFailure(error) === 'missing'
              ? undefined
              : ({ kind: 'unreadable' } satisfies WorktreeEntry),
          ] as const),
        ),
      ),
    { concurrency: options.concurrency },
  );
  return new Map<string, WorktreeEntry>(
    entries.flatMap(([path, entry]): [string, WorktreeEntry][] =>
      entry === undefined ? [] : [[path, entry]],
    ),
  );
});

const readEntry = Effect.fn('readWorktreeFiles.readEntry')(function* (
  root: string,
  path: string,
  maxDigestBytes: number,
  buffer: Buffer,
): Effect.fn.Return<WorktreeEntry | undefined, GuardedPathFailure> {
  const parent = dirname(path);
  const target = { root, path: parent === '.' ? '' : parent };
  const before = yield* inspectPath(target);
  if (!before.info.isDirectory()) return undefined;
  const full = join(before.path, path.split('/').at(-1) ?? '');
  if (!full.startsWith(before.path + sep)) return undefined;
  const info = yield* syscall(() => lstat(full, { bigint: true }));
  if (info.isSymbolicLink()) {
    const link = yield* syscall(() => readlink(full));
    yield* verifyPath(before, target);
    return { kind: 'symlink', target: link, stamp: fileIdentity(info) };
  }
  if (!info.isFile()) return { kind: 'other' };
  const read = yield* digestFile(full, info, maxDigestBytes, buffer);
  if (read.kind === 'file') yield* verifyPath(before, target);
  return read;
});

export const stampPath = Effect.fn('stampPath')((path: string) =>
  syscall(() => lstat(path, { bigint: true })).pipe(
    Effect.map(fileIdentity),
    Effect.catch(() => Effect.succeed(undefined)),
  ),
);

const digestFile = Effect.fn('readWorktreeFiles.digestFile')(
  (full: string, classified: BigIntStats, maxBytes: number, buffer: Buffer) =>
    Effect.scoped(
      Effect.gen(function* (): Effect.fn.Return<
        WorktreeEntry,
        GuardedPathFailure,
        Scope.Scope
      > {
        const handle = yield* openGuardedFile(full, constants.O_RDONLY);
        const opened = yield* syscall(() => handle.stat({ bigint: true }));
        if (!opened.isFile() || !sameFile(classified, opened))
          return { kind: 'other' };
        if (opened.size > BigInt(maxBytes)) return { kind: 'too-large' };
        const hash = createHash('sha256');
        let read = 0;
        for (;;) {
          const { bytesRead } = yield* syscall(() =>
            handle.read(buffer, 0, buffer.length, read),
          );
          if (bytesRead === 0) break;
          read += bytesRead;
          if (read > maxBytes) return { kind: 'too-large' };
          hash.update(buffer.subarray(0, bytesRead));
        }
        const after = yield* syscall(() => handle.stat({ bigint: true }));
        if (!unchanged(opened, after)) return { kind: 'other' };
        return {
          kind: 'file',
          digest: hash.digest('hex'),
          stamp: fileIdentity(after),
        };
      }),
    ),
);
