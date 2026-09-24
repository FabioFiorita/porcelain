import { sha256Hex } from '@porcelain/kernel/rules';
import { ContentChangedError } from '../errors/content-changed-error.ts';
import { fileFailureError } from '../errors/file-failure-error.ts';
import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import { InvalidMoveError } from '../errors/invalid-move-error.ts';
import type {
  EditFileInput,
  EditFileOptions,
  EditFileResult,
} from '../models/edit-file.ts';
import type { FileLocation } from '../models/file-location.ts';
import type { FileWrite } from '../models/file-write.ts';
import type { FileReader } from '../ports/file-reader.ts';
import type { FileWriter } from '../ports/file-writer.ts';
import { moveProblem } from '../rules/move-problem.ts';

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
        if (moveProblem(command.path, command.destination))
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
    if (current.kind === 'failed') throw fileFailureError(current.failure);
    if (current.kind === 'too-large') throw new FileTooLargeError();
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
    if (write.kind === 'failed') throw fileFailureError(write.failure);
  }
}
