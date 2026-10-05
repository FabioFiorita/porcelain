import type { FileReader } from '@porcelain/files/ports';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import { Effect } from 'effect';
import type {
  UntrackedFileRead,
  UntrackedFileRequest,
} from '@porcelain/git-actions/models';
import type { UntrackedFileReader } from '@porcelain/git-actions/ports';

export class FilesystemUntrackedFileReader implements UntrackedFileReader {
  private readonly files: FileReader;

  constructor(files: FileReader) {
    this.files = files;
  }

  read(
    input: UntrackedFileRequest,
  ): Effect.Effect<UntrackedFileRead, never, WorktreeRead> {
    return Effect.gen({ self: this }, function* () {
      const read = yield* this.files.readText({
        worktreeId: input.worktreeId,
        path: input.path,
        maxBytes: input.maxBytes,
      });
      switch (read.kind) {
        case 'text':
          return { kind: 'text', text: read.text, byteLength: read.byteLength };
        case 'too-large':
          return { kind: 'too-large' };
        case 'failed':
          return { kind: 'failed', failure: read.failure };
      }
    });
  }
}
