import { Effect, Layer } from 'effect';
import { captureGitPlatform } from '@porcelain/git/discovery';
import { readBlobAtOid } from '@porcelain/git/inspection';
import { ReviewCodeReader } from '@porcelain/reviews/ports';
import type { Limits } from '../../config/limits.ts';
import { decodedText } from '../files/filesystem-file-reader.ts';

export const gitReviewCodeReaderLayer = (limits: Limits) =>
  Layer.effect(
    ReviewCodeReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        readText: Effect.fn('ReviewCodeReader.readText')(function* (input) {
          const blob = yield* readBlobAtOid(
            { path: input.commonDirectory },
            { ...input, maxBytes: limits.files.readTextFile.maxBytes },
            limits.git,
          ).pipe(provideGit, Effect.orDie);
          if (blob.kind !== 'bytes') return blob;
          const text = decodedText(blob.bytes);
          return text === undefined
            ? { kind: 'unsupported' as const, blobOid: blob.blobOid }
            : { kind: 'text' as const, text, blobOid: blob.blobOid };
        }),
      };
    }),
  );
