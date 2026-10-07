import type { FileReadInput, TextRead } from '@porcelain/files/models';
import { HeadTextReader } from '@porcelain/files/ports';
import { readHeadBlob } from '@porcelain/git/inspection';
import { Effect, Layer } from 'effect';
import { readGitEffect } from '../../runtime/git-io.ts';
import { captureGitPlatform } from '@porcelain/git/discovery';
import type { OpenInspection } from '../changes/inspection-checkouts.ts';
import { decodedText } from './filesystem-file-reader.ts';

export const gitHeadTextReaderLayer = (open: OpenInspection) =>
  Layer.effect(
    HeadTextReader,
    Effect.gen(function* () {
      const provideGit = yield* captureGitPlatform();
      return {
        readText: Effect.fn('GitHeadTextReader.readText')(
          (input: FileReadInput) =>
            readGitEffect(
              input.worktreeId,
              Effect.gen(function* () {
                const { checkout, limits } = yield* open(input.worktreeId);
                yield* checkout.verify();
                const blob = yield* readHeadBlob(
                  checkout,
                  { path: input.path, maxBytes: input.maxBytes },
                  limits,
                );
                if (blob.kind === 'too-large') return blob;
                if (blob.kind === 'missing')
                  return {
                    kind: 'failed',
                    failure: 'missing',
                  } satisfies TextRead;
                const text = decodedText(blob.bytes);
                return text === undefined
                  ? ({
                      kind: 'failed',
                      failure: 'unsupported-text',
                    } satisfies TextRead)
                  : ({
                      kind: 'text',
                      text,
                      byteLength: blob.bytes.length,
                      revision: 'HEAD',
                    } satisfies TextRead);
              }).pipe(provideGit),
            ).pipe(Effect.orDie),
        ),
      };
    }),
  );
