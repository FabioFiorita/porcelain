import { ContentChangedError } from '../errors/content-changed-error.ts';
import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import { InvalidMoveError } from '../errors/invalid-move-error.ts';
import type { EditFileInput, EditFileResult } from '../models/edit-file.ts';
import type { FileLocation } from '../models/file-location.ts';
import type { FileWrite } from '../models/file-write.ts';
import type { FileReader } from '../ports/file-reader.ts';
import type { FileWriter } from '../ports/file-writer.ts';
import { contentFingerprint } from '../rules/content-fingerprint.ts';
import { fileFailureError } from '../rules/file-failure-error.ts';

export type EditFileOptions = { maxCurrentBytes: number };

const LIMITS: EditFileOptions = { maxCurrentBytes: 1024 * 1024 };

export class EditFileService {
  private readonly fileReader: FileReader;
  private readonly fileWriter: FileWriter;
  private readonly options: EditFileOptions;

  constructor(
    fileReader: FileReader,
    fileWriter: FileWriter,
    options: EditFileOptions = LIMITS,
  ) {
    this.fileReader = fileReader;
    this.fileWriter = fileWriter;
    this.options = options;
  }

  async execute(
    input: EditFileInput,
    signal?: AbortSignal,
  ): Promise<EditFileResult> {
    const { command } = input;
    const location = { worktreeId: input.worktreeId, path: command.path };
    switch (command.kind) {
      case 'write':
        return this.write(
          location,
          command.text,
          command.expectedFingerprint,
          signal,
        );
      case 'create':
        succeed(
          await this.fileWriter.create(location, command.entryKind, signal),
        );
        return { path: command.path };
      case 'move':
        if (
          command.destination === command.path ||
          command.destination.startsWith(`${command.path}/`)
        )
          throw new InvalidMoveError();
        succeed(
          await this.fileWriter.move(location, command.destination, signal),
        );
        return { path: command.destination };
      case 'trash':
        succeed(await this.fileWriter.trash(location, signal));
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
      location,
      this.options.maxCurrentBytes,
      signal,
    );
    if (current.kind === 'too-large') throw new FileTooLargeError();
    if (current.kind === 'failed') throw fileFailureError(current.failure);
    if (contentFingerprint(current.text) !== expectedFingerprint)
      throw new ContentChangedError();
    succeed(
      await this.fileWriter.write(location, text, current.revision, signal),
    );
    return {
      path: location.path,
      contentFingerprint: contentFingerprint(text),
    };
  }
}

function succeed(write: FileWrite) {
  if (write.kind === 'failed') throw fileFailureError(write.failure);
}
