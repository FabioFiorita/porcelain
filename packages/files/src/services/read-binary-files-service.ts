import { ReadBinaryFilesOptions } from '../ports/read-binary-files-options.ts';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import { Effect, Context, Layer } from 'effect';
import {
  type ReadBinaryFilesInput,
  type ReadBinaryFilesResult,
} from '../models/read-binary-files.ts';
import { FileReader } from '../ports/file-reader.ts';

export class ReadBinaryFilesService extends Context.Service<
  ReadBinaryFilesService,
  {
    readonly execute: (
      input: ReadBinaryFilesInput,
    ) => Effect.Effect<ReadBinaryFilesResult, never, WorktreeRead>;
  }
>()('@porcelain/files/ReadBinaryFilesService') {
  static readonly layer = Layer.effect(
    ReadBinaryFilesService,
    Effect.gen(function* () {
      const fileReaderCapability = yield* FileReader;
      const optionsCapability = yield* ReadBinaryFilesOptions;

      return {
        execute: Effect.fn('ReadBinaryFilesService.execute')(function* (
          input: ReadBinaryFilesInput,
        ): Effect.fn.Return<ReadBinaryFilesResult, never, WorktreeRead> {
          const files = new Map<string, Uint8Array>();
          const tooLarge: string[] = [];
          const unreadable: string[] = [];
          let remaining = optionsCapability.totalBytes;
          for (const path of input.paths) {
            if (remaining <= 0) {
              tooLarge.push(path);
              continue;
            }
            const maxBytes = Math.min(optionsCapability.maxBytes, remaining);
            const read = yield* fileReaderCapability.read({
              worktreeId: input.worktreeId,
              path,
              maxBytes,
            });
            if (read.kind === 'file' && read.bytes.length <= maxBytes) {
              files.set(path, read.bytes);
              remaining -= read.bytes.length;
            } else if (read.kind !== 'failed') tooLarge.push(path);
            else unreadable.push(path);
          }
          return { files, tooLarge, unreadable };
        }),
      };
    }),
  );
}
