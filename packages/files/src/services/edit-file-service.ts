import { EditFileOptions } from '../ports/edit-file-options.ts';
import {
  type WorktreeRead,
  type WorktreeWrite,
} from '@porcelain/effects/worktree';
import { sha256Hex } from '@porcelain/kernel/rules';
import { Effect, Context, Layer } from 'effect';
import { ContentChangedError } from '../errors/content-changed-error.ts';
import { CrossDeviceMoveError } from '../errors/cross-device-move-error.ts';
import { DiskFullError } from '../errors/disk-full-error.ts';
import { EntryExistsError } from '../errors/entry-exists-error.ts';
import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import { InvalidMoveError } from '../errors/invalid-move-error.ts';
import { PathNotFoundError } from '../errors/path-not-found-error.ts';
import { PathNotReadableError } from '../errors/path-not-readable-error.ts';
import { TrashUnavailableError } from '../errors/trash-unavailable-error.ts';
import { UnsupportedTextError } from '../errors/unsupported-text-error.ts';
import {
  type EditFileInput,
  type EditFileResult,
} from '../models/edit-file.ts';
import { type FileEdit } from '../models/file-edit.ts';
import { type TextFailure, type WriteFailure } from '../models/file-failure.ts';
import { type FileLocation } from '../models/file-location.ts';
import { type FileWrite } from '../models/file-write.ts';
import { FileReader } from '../ports/file-reader.ts';
import { FileWriter } from '../ports/file-writer.ts';
import { moveProblem } from '../rules/move-problem.ts';

export type EditFileFailure =
  | PathNotFoundError
  | PathNotReadableError
  | ContentChangedError
  | UnsupportedTextError
  | EntryExistsError
  | CrossDeviceMoveError
  | TrashUnavailableError
  | FileTooLargeError
  | DiskFullError
  | InvalidMoveError;

type WriteEdit = Extract<FileEdit, { kind: 'write' }>;

export class EditFileService extends Context.Service<
  EditFileService,
  {
    readonly execute: (
      input: EditFileInput,
    ) => Effect.Effect<
      EditFileResult,
      EditFileFailure,
      WorktreeRead | WorktreeWrite
    >;
  }
>()('@porcelain/files/EditFileService') {
  static readonly layer = Layer.effect(
    EditFileService,
    Effect.gen(function* () {
      const fileReaderCapability = yield* FileReader;
      const fileWriterCapability = yield* FileWriter;
      const optionsCapability = yield* EditFileOptions;
      const operationWrite = Effect.fn('EditFileService.write')(function* (
        location: FileLocation,
        command: WriteEdit,
      ): Effect.fn.Return<
        EditFileResult,
        EditFileFailure,
        WorktreeRead | WorktreeWrite
      > {
        const current = yield* fileReaderCapability.readText({
          ...location,
          maxBytes: optionsCapability.maxCurrentBytes,
        });
        if (current.kind === 'failed')
          return yield* Effect.fail(operationFailure(current.failure));
        if (current.kind === 'too-large') return yield* new FileTooLargeError();
        if (sha256Hex(current.text) !== command.expectedFingerprint)
          return yield* new ContentChangedError();
        const written = yield* fileWriterCapability.write({
          ...location,
          text: command.text,
          revision: current.revision,
        });
        yield* operationSucceed(written);
        return {
          path: location.path,
          contentFingerprint: sha256Hex(command.text),
        };
      });
      const operationSucceed = Effect.fn('EditFileService.succeed')(function* (
        write: FileWrite,
      ): Effect.fn.Return<void, EditFileFailure> {
        return yield* write.kind === 'failed'
          ? Effect.fail(operationFailure(write.failure))
          : Effect.void;
      });
      function operationFailure(
        failure: TextFailure | WriteFailure,
      ): EditFileFailure {
        switch (failure) {
          case 'missing':
            return new PathNotFoundError();
          case 'unreadable':
            return new PathNotReadableError();
          case 'changed':
            return new ContentChangedError();
          case 'unsupported-text':
            return new UnsupportedTextError();
          case 'exists':
            return new EntryExistsError();
          case 'cross-device':
            return new CrossDeviceMoveError();
          case 'trash-unavailable':
            return new TrashUnavailableError();
          case 'too-large':
            return new FileTooLargeError();
          case 'no-space':
            return new DiskFullError();
        }
      }
      return {
        execute: Effect.fn('EditFileService.execute')(function* (
          input: EditFileInput,
        ): Effect.fn.Return<
          EditFileResult,
          EditFileFailure,
          WorktreeRead | WorktreeWrite
        > {
          return yield* Effect.suspend(() => {
            const { worktreeId, command } = input;
            switch (command.kind) {
              case 'write':
                return operationWrite(
                  { worktreeId, path: command.path },
                  command,
                );
              case 'create':
                return Effect.gen(function* () {
                  const created = yield* fileWriterCapability.create({
                    worktreeId,
                    path: command.path,
                    entryKind: command.entryKind,
                  });
                  yield* operationSucceed(created);
                  return { path: command.path };
                });
              case 'move':
                return Effect.gen(function* () {
                  if (moveProblem(command.path, command.destination))
                    return yield* new InvalidMoveError();
                  const moved = yield* fileWriterCapability.move({
                    worktreeId,
                    path: command.path,
                    destination: command.destination,
                  });
                  yield* operationSucceed(moved);
                  return { path: command.destination };
                });
              case 'trash':
                return Effect.gen(function* () {
                  const trashed = yield* fileWriterCapability.trash({
                    worktreeId,
                    path: command.path,
                  });
                  yield* operationSucceed(trashed);
                  return { path: command.path };
                });
              case 'copy':
                return Effect.gen(function* () {
                  const copied = yield* fileWriterCapability.copy({
                    worktreeId,
                    path: command.path,
                    destination: command.destination,
                    maxBytes: optionsCapability.maxCopyBytes,
                  });
                  yield* operationSucceed(copied);
                  return { path: command.destination };
                });
            }
          });
        }),
      };
    }),
  );
}
