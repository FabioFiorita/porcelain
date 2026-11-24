import { fileFailure } from './file-failure.ts';
import { ReadTextFileOptions } from '../ports/read-text-file-options.ts';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { sha256Hex, utf8ByteLength } from '@porcelain/kernel/rules';
import { Effect, Context, Layer } from 'effect';
import type { ContentChangedError } from '../errors/content-changed-error.ts';
import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import type { PathNotFoundError } from '../errors/path-not-found-error.ts';
import type { PathNotReadableError } from '../errors/path-not-readable-error.ts';
import type { UnsupportedTextError } from '../errors/unsupported-text-error.ts';
import {
  type ReadTextFileInput,
  type ReadTextFileResult,
} from '../models/read-text-file.ts';
import { FileReader } from '../ports/file-reader.ts';
import { HeadTextReader } from '../ports/head-text-reader.ts';

type TextFailureError =
  | PathNotFoundError
  | PathNotReadableError
  | ContentChangedError
  | UnsupportedTextError;

export type ReadTextFileFailure = TextFailureError | FileTooLargeError;

export class ReadTextFileService extends Context.Service<
  ReadTextFileService,
  {
    readonly execute: (
      input: ReadTextFileInput,
    ) => Effect.Effect<ReadTextFileResult, ReadTextFileFailure, WorktreeRead>;
  }
>()('@porcelain/files/ReadTextFileService') {
  static readonly layer = Layer.effect(
    ReadTextFileService,
    Effect.gen(function* () {
      const fileReaderCapability = yield* FileReader;
      const headTextReaderCapability = yield* HeadTextReader;
      const optionsCapability = yield* ReadTextFileOptions;
      return {
        execute: Effect.fn('ReadTextFileService.execute')(function* (
          input: ReadTextFileInput,
        ): Effect.fn.Return<
          ReadTextFileResult,
          ReadTextFileFailure,
          WorktreeRead
        > {
          const reader =
            input.at === 'head'
              ? headTextReaderCapability
              : fileReaderCapability;
          const read = yield* reader.readText({
            worktreeId: input.worktreeId,
            path: input.path,
            maxBytes: optionsCapability.maxBytes,
          });
          if (read.kind === 'failed')
            return yield* Effect.fail(fileFailure[read.failure]());
          if (read.kind === 'too-large') return yield* new FileTooLargeError();
          const answer: Omit<ReadTextFileResult, 'contentFingerprint'> = {
            worktreeId: input.worktreeId,
            path: input.path,
            encoding: 'utf-8',
            byteLength: read.byteLength,
            text: read.text,
          };
          if (
            utf8ByteLength(JSON.stringify(answer)) > optionsCapability.maxBytes
          )
            return yield* new FileTooLargeError();
          return { ...answer, contentFingerprint: sha256Hex(read.text) };
        }),
      };
    }),
  );
}
