import type { WorktreeRead } from '@porcelain/effects/worktree';
import { Effect } from 'effect';
import { DirectoryTooLargeError } from '../errors/directory-too-large-error.ts';
import type {
  ListWorktreePathsInput,
  ListWorktreePathsResult,
} from '../models/list-worktree-paths.ts';
import type { WorktreePathsReader } from '../ports/worktree-paths-reader.ts';

export class ListWorktreePathsService {
  private readonly worktreePathsReader: WorktreePathsReader;

  constructor(worktreePathsReader: WorktreePathsReader) {
    this.worktreePathsReader = worktreePathsReader;
  }

  execute(
    input: ListWorktreePathsInput,
  ): Effect.Effect<
    ListWorktreePathsResult,
    DirectoryTooLargeError,
    WorktreeRead
  > {
    return Effect.gen({ self: this }, function* () {
      const read = yield* this.worktreePathsReader.read({
        worktreeId: input.worktreeId,
      });
      if (read.kind === 'too-large') return yield* new DirectoryTooLargeError();
      return { worktreeId: input.worktreeId, paths: read.paths };
    });
  }
}
