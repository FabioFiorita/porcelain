import {
  admittedRead,
  nativeOperation,
  type WorktreeRead,
} from '@porcelain/effects';
import { constants } from 'node:fs';
import type {
  FileRead,
  FileReadInput,
  TextRead,
} from '@porcelain/files/models';
import { FileReader } from '@porcelain/files/ports';
import { Effect, Layer, type Scope } from 'effect';
import { openGuardedFile, syscall } from './guarded-filesystem-syscalls.ts';
import {
  inspectPath,
  type GuardedPathFailure,
  readFailure,
  fileIdentity,
  sameFile,
  unchanged,
  verifyPath,
} from './inspect-path.ts';
import {
  listedWorktree,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';

const textDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export const filesystemFileReaderLayer = (worktrees: ListedWorktrees) =>
  Layer.sync(FileReader, () => {
    const read = Effect.fn('FilesystemFileReader.read')(
      (input: FileReadInput) =>
        admittedRead(
          input.worktreeId,
          Effect.gen(function* () {
            const checkout = yield* nativeOperation((signal) =>
              listedWorktree(worktrees, input.worktreeId, signal),
            );
            const target = { root: checkout.path, path: input.path };
            return yield* Effect.scoped(
              Effect.gen(function* (): Effect.fn.Return<
                FileRead,
                GuardedPathFailure,
                Scope.Scope
              > {
                const before = yield* inspectPath(target);
                if (!before.info.isFile())
                  return { kind: 'failed', failure: 'unreadable' };
                const handle = yield* openGuardedFile(
                  before.path,
                  constants.O_RDONLY,
                );
                const opened = yield* syscall(() =>
                  handle.stat({ bigint: true }),
                );
                if (!opened.isFile() || !sameFile(before.info, opened))
                  return { kind: 'failed', failure: 'changed' };
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
                const settled = yield* syscall(() =>
                  handle.stat({ bigint: true }),
                );
                if (!unchanged(opened, settled))
                  return { kind: 'failed', failure: 'changed' };
                yield* verifyPath(before, target);
                return {
                  kind: 'file',
                  bytes: buffer.subarray(0, length),
                  revision: fileIdentity(settled),
                };
              }),
            ).pipe(
              Effect.catch((error) => {
                const failure = readFailure(error);
                return failure === undefined
                  ? Effect.die(error)
                  : Effect.succeed<FileRead>({ kind: 'failed', failure });
              }),
            );
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
