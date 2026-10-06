import { ReadTextFilesOptions } from '../ports/read-text-files-options.ts';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { Effect, Context, Layer } from 'effect';
import {
  type ReadTextFilesInput,
  type ReadTextFilesResult,
} from '../models/read-text-files.ts';
import { FileReader } from '../ports/file-reader.ts';

export class ReadTextFilesService extends Context.Service<
  ReadTextFilesService,
  {
    readonly execute: (
      input: ReadTextFilesInput,
    ) => Effect.Effect<ReadTextFilesResult, never, WorktreeRead>;
  }
>()('@porcelain/files/ReadTextFilesService') {
  static readonly layer = Layer.effect(
    ReadTextFilesService,
    Effect.gen(function* () {
      const fileReaderCapability = yield* FileReader;
      const optionsCapability = yield* ReadTextFilesOptions;
      function operationReadText(worktreeId: string, path: string) {
        return Effect.gen(function* () {
          const read = yield* fileReaderCapability.readText({
            worktreeId,
            path,
            maxBytes: optionsCapability.maxBytes,
          });
          return { path, read };
        });
      }
      return {
        execute: Effect.fn('ReadTextFilesService.execute')(function* (
          input: ReadTextFilesInput,
        ): Effect.fn.Return<ReadTextFilesResult, never, WorktreeRead> {
          const { worktreeId } = input;
          const reads = yield* Effect.forEach(
            input.paths,
            (path) => operationReadText(worktreeId, path),
            { concurrency: 'unbounded' },
          );
          return {
            texts: new Map(
              reads.flatMap(({ path, read }) =>
                read.kind === 'text' ? [[path, read.text] as const] : [],
              ),
            ),
            unreadable: reads.flatMap(({ path, read }) =>
              read.kind === 'text' ? [] : [path],
            ),
          };
        }),
      };
    }),
  );
}
