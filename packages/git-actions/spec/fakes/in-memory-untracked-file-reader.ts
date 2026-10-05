import { Effect } from 'effect';
import type {
  UntrackedFileRead,
  UntrackedFileRequest,
} from '../../src/models/commit-draft-evidence.ts';
import type { UntrackedFileReader } from '../../src/ports/untracked-file-reader.ts';

export class InMemoryUntrackedFileReader implements UntrackedFileReader {
  private readonly files: Readonly<Record<string, UntrackedFileRead>>;

  constructor(files: Readonly<Record<string, UntrackedFileRead>> = {}) {
    this.files = files;
  }

  read(input: UntrackedFileRequest): Effect.Effect<UntrackedFileRead> {
    return Effect.sync(() => {
      return this.files[input.path] ?? { kind: 'failed', failure: 'missing' };
    });
  }
}
