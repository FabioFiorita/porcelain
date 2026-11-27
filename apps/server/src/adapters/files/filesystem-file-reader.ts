import { NodeStream } from '@effect/platform-node';
import { type WorktreeRead } from '@porcelain/effects';
import { constants } from 'node:fs';
import type {
  FileRead,
  FileReadInput,
  TextRead,
} from '@porcelain/files/models';
import { FileReader, PreviewFileReader } from '@porcelain/files/ports';
import { Effect, Layer, Scope } from 'effect';
import { openGuardedFile, syscall } from './guarded-filesystem-syscalls.ts';
import {
  inspectPath,
  pathRefused,
  type CheckoutPath,
  type GuardedPathFailure,
  fileIdentity,
  sameFile,
  unchanged,
  verifyPath,
} from './inspect-path.ts';
import type { ListedWorktrees } from '../projects/checkout-session.ts';
import {
  readGuardedWorktree,
  withGuardedWorktree,
} from './read-guarded-worktree.ts';

const textDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export const filesystemFileReaderLayer = (worktrees: ListedWorktrees) =>
  Layer.sync(FileReader, () => {
    const read = Effect.fn('FilesystemFileReader.read')(
      (input: FileReadInput) =>
        readGuardedWorktree(worktrees, input, (target) =>
          Effect.gen(function* (): Effect.fn.Return<
            FileRead,
            GuardedPathFailure,
            Scope.Scope
          > {
            const { before, handle, opened } = yield* openCheckedFile(target);
            if (opened.size > BigInt(input.maxBytes))
              return { kind: 'too-large' };
            const buffer = Buffer.alloc(Number(opened.size) + 1);
            let length = 0;
            while (length < buffer.length) {
              const { bytesRead } = yield* syscall(() =>
                handle.read(buffer, length, buffer.length - length, length),
              );
              if (bytesRead === 0) break;
              length += bytesRead;
            }
            if (length > input.maxBytes) return { kind: 'too-large' };
            const settled = yield* syscall(() => handle.stat({ bigint: true }));
            if (!unchanged(opened, settled))
              return { kind: 'failed', failure: 'changed' };
            yield* verifyPath(before, target);
            return {
              kind: 'file',
              bytes: buffer.subarray(0, length),
              revision: fileIdentity(settled),
            };
          }),
        ),
    );
    const readText = Effect.fn('FilesystemFileReader.readText')(function* (
      input: FileReadInput,
    ): Effect.fn.Return<TextRead, never, WorktreeRead> {
      const found = yield* read(input);
      if (found.kind !== 'file') return found;
      const text = decodedText(found.bytes);
      return text === undefined
        ? { kind: 'failed', failure: 'unsupported-text' }
        : {
            kind: 'text',
            text,
            byteLength: found.bytes.length,
            revision: found.revision,
          };
    });
    return { read, readText };
  });

export function decodedText(bytes: Uint8Array): string | undefined {
  if (bytes.includes(0)) return undefined;
  try {
    return textDecoder.decode(bytes);
  } catch {
    return undefined;
  }
}

const openCheckedFile = Effect.fn('FilesystemFileReader.openCheckedFile')(
  function* (target: CheckoutPath) {
    const before = yield* inspectPath(target);
    if (!before.info.isFile())
      return yield* Effect.fail(pathRefused('unreadable'));
    const handle = yield* openGuardedFile(before.path, constants.O_RDONLY);
    const opened = yield* syscall(() => handle.stat({ bigint: true }));
    if (!opened.isFile() || !sameFile(before.info, opened))
      return yield* Effect.fail(pathRefused('changed'));
    return { before, handle, opened };
  },
);

export const filesystemPreviewFileReaderLayer = (worktrees: ListedWorktrees) =>
  Layer.succeed(PreviewFileReader, {
    open: Effect.fn('FilesystemPreviewFileReader.open')(function* (input: {
      worktreeId: string;
      path: string;
    }) {
      const scope = yield* Effect.scope;
      const file = yield* withGuardedWorktree(worktrees, input, (target) =>
        Effect.gen(function* () {
          const { before, handle, opened } = yield* openCheckedFile(target);
          yield* verifyPath(before, target);
          if (!unchanged(before.info, opened))
            return yield* Effect.fail(pathRefused('changed'));
          return {
            kind: 'stream' as const,
            size: Number(opened.size),
            revision: fileIdentity(opened),
            bytes: (start: number, end: number) =>
              NodeStream.fromReadable({
                evaluate: () =>
                  handle.createReadStream({ start, end, autoClose: false }),
                onError: (cause) => cause,
              }),
          };
        }).pipe(Scope.provide(scope)),
      );
      return file.kind === 'stream' ? file : undefined;
    }),
  });
