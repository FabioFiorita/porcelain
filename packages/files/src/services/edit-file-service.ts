import type { WorktreeRead, WorktreeWrite } from '@porcelain/effects/worktree';
import { sha256Hex } from '@porcelain/kernel/rules';
import { Effect } from 'effect';
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
import type {
  EditFileInput,
  EditFileOptions,
  EditFileResult,
} from '../models/edit-file.ts';
import type { FileEdit } from '../models/file-edit.ts';
import type { TextFailure, WriteFailure } from '../models/file-failure.ts';
import type { FileLocation } from '../models/file-location.ts';
import type { FileWrite } from '../models/file-write.ts';
import type { FileReader } from '../ports/file-reader.ts';
import type { FileWriter } from '../ports/file-writer.ts';
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

export class EditFileService {
  private readonly fileReader: FileReader;
  private readonly fileWriter: FileWriter;
  private readonly options: EditFileOptions;

  constructor(
    fileReader: FileReader,
    fileWriter: FileWriter,
    options: EditFileOptions,
  ) {
    this.fileReader = fileReader;
    this.fileWriter = fileWriter;
    this.options = options;
  }

  execute(
    input: EditFileInput,
  ): Effect.Effect<
    EditFileResult,
    EditFileFailure,
    WorktreeRead | WorktreeWrite
  > {
    const { worktreeId, command } = input;
    switch (command.kind) {
      case 'write':
        return this.write({ worktreeId, path: command.path }, command);
      case 'create':
        return Effect.gen({ self: this }, function* () {
          const created = yield* this.fileWriter.create({
            worktreeId,
            path: command.path,
            entryKind: command.entryKind,
          });
          yield* this.succeed(created);
          return { path: command.path };
        });
      case 'move':
        return Effect.gen({ self: this }, function* () {
          if (moveProblem(command.path, command.destination))
            return yield* new InvalidMoveError();
          const moved = yield* this.fileWriter.move({
            worktreeId,
            path: command.path,
            destination: command.destination,
          });
          yield* this.succeed(moved);
          return { path: command.destination };
        });
      case 'trash':
        return Effect.gen({ self: this }, function* () {
          const trashed = yield* this.fileWriter.trash({
            worktreeId,
            path: command.path,
          });
          yield* this.succeed(trashed);
          return { path: command.path };
        });
      case 'copy':
        return Effect.gen({ self: this }, function* () {
          const copied = yield* this.fileWriter.copy({
            worktreeId,
            path: command.path,
            destination: command.destination,
            maxBytes: this.options.maxCopyBytes,
          });
          yield* this.succeed(copied);
          return { path: command.destination };
        });
    }
  }

  private write(
    location: FileLocation,
    command: WriteEdit,
  ): Effect.Effect<
    EditFileResult,
    EditFileFailure,
    WorktreeRead | WorktreeWrite
  > {
    return Effect.gen({ self: this }, function* () {
      const current = yield* this.fileReader.readText({
        ...location,
        maxBytes: this.options.maxCurrentBytes,
      });
      if (current.kind === 'failed')
        return yield* Effect.fail(this.failure(current.failure));
      if (current.kind === 'too-large') return yield* new FileTooLargeError();
      if (sha256Hex(current.text) !== command.expectedFingerprint)
        return yield* new ContentChangedError();
      const written = yield* this.fileWriter.write({
        ...location,
        text: command.text,
        revision: current.revision,
      });
      yield* this.succeed(written);
      return {
        path: location.path,
        contentFingerprint: sha256Hex(command.text),
      };
    });
  }

  private succeed(write: FileWrite): Effect.Effect<void, EditFileFailure> {
    return write.kind === 'failed'
      ? Effect.fail(this.failure(write.failure))
      : Effect.void;
  }

  private failure(failure: TextFailure | WriteFailure): EditFileFailure {
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
}
