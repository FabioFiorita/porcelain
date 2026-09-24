import { sha256Hex } from '@porcelain/kernel/rules';
import { ContentChangedError } from '../errors/content-changed-error.ts';
import { CrossDeviceMoveError } from '../errors/cross-device-move-error.ts';
import { EntryExistsError } from '../errors/entry-exists-error.ts';
import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import { InvalidMoveError } from '../errors/invalid-move-error.ts';
import { PathNotFoundError } from '../errors/path-not-found-error.ts';
import { PathNotReadableError } from '../errors/path-not-readable-error.ts';
import { TrashUnavailableError } from '../errors/trash-unavailable-error.ts';
import { UnsupportedTextError } from '../errors/unsupported-text-error.ts';
import type { EditFileInput, EditFileResult } from '../models/edit-file.ts';
import type { TextFailure, WriteFailure } from '../models/file-failure.ts';
import type { FileLocation } from '../models/file-location.ts';
import type { FileWrite } from '../models/file-write.ts';
import type { FileReader } from '../ports/file-reader.ts';
import type { FileWriter } from '../ports/file-writer.ts';

export type EditFileOptions = { maxCurrentBytes: number };

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

  async execute(
    input: EditFileInput,
    signal?: AbortSignal,
  ): Promise<EditFileResult> {
    const { worktreeId, command } = input;
    switch (command.kind) {
      case 'write':
        return this.write(
          { worktreeId, path: command.path },
          command.text,
          command.expectedFingerprint,
          signal,
        );
      case 'create':
        this.succeed(
          await this.fileWriter.create(
            { worktreeId, path: command.path, entryKind: command.entryKind },
            signal,
          ),
        );
        return { path: command.path };
      case 'move':
        if (
          command.destination === command.path ||
          command.destination.startsWith(`${command.path}/`)
        )
          throw new InvalidMoveError();
        this.succeed(
          await this.fileWriter.move(
            {
              worktreeId,
              path: command.path,
              destination: command.destination,
            },
            signal,
          ),
        );
        return { path: command.destination };
      case 'trash':
        this.succeed(
          await this.fileWriter.trash(
            { worktreeId, path: command.path },
            signal,
          ),
        );
        return { path: command.path };
    }
  }

  private async write(
    location: FileLocation,
    text: string,
    expectedFingerprint: string,
    signal?: AbortSignal,
  ): Promise<EditFileResult> {
    const current = await this.fileReader.readText(
      { ...location, maxBytes: this.options.maxCurrentBytes },
      signal,
    );
    if (current.kind === 'failed') throw this.failure(current.failure);
    if (
      current.kind === 'too-large' ||
      current.byteLength > this.options.maxCurrentBytes
    )
      throw new FileTooLargeError();
    if (sha256Hex(current.text) !== expectedFingerprint)
      throw new ContentChangedError();
    this.succeed(
      await this.fileWriter.write(
        { ...location, text, revision: current.revision },
        signal,
      ),
    );
    return {
      path: location.path,
      contentFingerprint: sha256Hex(text),
    };
  }

  private succeed(write: FileWrite): void {
    if (write.kind === 'failed') throw this.failure(write.failure);
  }

  private failure(failure: TextFailure | WriteFailure): Error {
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
    }
  }
}
