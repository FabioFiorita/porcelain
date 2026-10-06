import { admittedRead, nativeOperation } from '@porcelain/effects';
import type { FileReadInput, TextRead } from '@porcelain/files/models';
import { HeadTextReader } from '@porcelain/files/ports';
import { Effect, Layer } from 'effect';
import type { OpenInspection } from '../changes/inspection-checkouts.ts';
import { decodedText } from './filesystem-file-reader.ts';

export const gitHeadTextReaderLayer = (open: OpenInspection) =>
  Layer.succeed(HeadTextReader, {
    readText: Effect.fn('GitHeadTextReader.readText')((input: FileReadInput) =>
      admittedRead(
        input.worktreeId,
        Effect.gen(function* (): Effect.fn.Return<TextRead> {
          const { git } = yield* nativeOperation((signal) =>
            open(input.worktreeId, signal),
          );
          const blob = yield* nativeOperation((signal) =>
            git.readHeadBlob(
              { path: input.path, maxBytes: input.maxBytes },
              signal,
            ),
          );
          if (blob.kind === 'too-large') return blob;
          if (blob.kind === 'missing')
            return { kind: 'failed', failure: 'missing' };
          const text = decodedText(blob.bytes);
          return text === undefined
            ? { kind: 'failed', failure: 'unsupported-text' }
            : {
                kind: 'text',
                text,
                byteLength: blob.bytes.length,
                revision: 'HEAD',
              };
        }),
      ),
    ),
  });
