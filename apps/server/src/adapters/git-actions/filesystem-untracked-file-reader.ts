import { FileReader } from '@porcelain/files/ports';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import { Effect, Layer } from 'effect';
import type {
  UntrackedFileRead,
  UntrackedFileRequest,
} from '@porcelain/git-actions/models';
import { UntrackedFileReader } from '@porcelain/git-actions/ports';

export const filesystemUntrackedFileReaderLayer = Layer.effect(
  UntrackedFileReader,
  Effect.gen(function* () {
    const files = yield* FileReader;
    return {
      read: Effect.fn('FilesystemUntrackedFileReader.read')(function* (
        input: UntrackedFileRequest,
      ): Effect.fn.Return<UntrackedFileRead, never, WorktreeRead> {
        const read = yield* files.readText({
          worktreeId: input.worktreeId,
          path: input.path,
          maxBytes: input.maxBytes,
        });
        switch (read.kind) {
          case 'text':
            return {
              kind: 'text',
              text: read.text,
              byteLength: read.byteLength,
            };
          case 'too-large':
            return { kind: 'too-large' };
          case 'failed':
            return { kind: 'failed', failure: read.failure };
        }
      }),
    };
  }),
);
