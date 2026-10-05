import type { WorktreeRead } from '@porcelain/effects/worktree';
import { sha256Hex, utf8ByteLength } from '@porcelain/kernel/rules';
import { Effect } from 'effect';
import { ContentChangedError } from '../errors/content-changed-error.ts';
import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import { PathNotFoundError } from '../errors/path-not-found-error.ts';
import { PathNotReadableError } from '../errors/path-not-readable-error.ts';
import { UnsupportedTextError } from '../errors/unsupported-text-error.ts';
import type { TextFailure } from '../models/file-failure.ts';
import type {
  ReadTextFileInput,
  ReadTextFileOptions,
  ReadTextFileResult,
} from '../models/read-text-file.ts';
import type { FileReader } from '../ports/file-reader.ts';
import type { HeadTextReader } from '../ports/head-text-reader.ts';

type TextFailureError =
  | PathNotFoundError
  | PathNotReadableError
  | ContentChangedError
  | UnsupportedTextError;

export type ReadTextFileFailure = TextFailureError | FileTooLargeError;

export class ReadTextFileService {
  private readonly fileReader: FileReader;
  private readonly headTextReader: HeadTextReader;
  private readonly options: ReadTextFileOptions;

  constructor(
    fileReader: FileReader,
    headTextReader: HeadTextReader,
    options: ReadTextFileOptions,
  ) {
    this.fileReader = fileReader;
    this.headTextReader = headTextReader;
    this.options = options;
  }

  execute(
    input: ReadTextFileInput,
  ): Effect.Effect<ReadTextFileResult, ReadTextFileFailure, WorktreeRead> {
    return Effect.gen({ self: this }, function* () {
      const reader =
        input.at === 'head' ? this.headTextReader : this.fileReader;
      const read = yield* reader.readText({
        worktreeId: input.worktreeId,
        path: input.path,
        maxBytes: this.options.maxBytes,
      });
      if (read.kind === 'failed')
        return yield* Effect.fail(this.failure(read.failure));
      if (read.kind === 'too-large') return yield* new FileTooLargeError();
      const answer: Omit<ReadTextFileResult, 'contentFingerprint'> = {
        worktreeId: input.worktreeId,
        path: input.path,
        encoding: 'utf-8',
        byteLength: read.byteLength,
        text: read.text,
      };
      if (utf8ByteLength(JSON.stringify(answer)) > this.options.maxBytes)
        return yield* new FileTooLargeError();
      return { ...answer, contentFingerprint: sha256Hex(read.text) };
    });
  }

  private failure(failure: TextFailure): TextFailureError {
    switch (failure) {
      case 'missing':
        return new PathNotFoundError();
      case 'unreadable':
        return new PathNotReadableError();
      case 'changed':
        return new ContentChangedError();
      case 'unsupported-text':
        return new UnsupportedTextError();
    }
  }
}
