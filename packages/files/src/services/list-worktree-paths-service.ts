import { type WorktreeRead } from '@porcelain/effects/worktree';
import { Effect, Context, Layer } from 'effect';
import { DirectoryTooLargeError } from '../errors/directory-too-large-error.ts';
import {
  type ListWorktreePathsInput,
  type ListWorktreePathsResult,
} from '../models/list-worktree-paths.ts';
import { WorktreePathsReader } from '../ports/worktree-paths-reader.ts';

export class ListWorktreePathsService extends Context.Service<
  ListWorktreePathsService,
  {
    readonly execute: (
      input: ListWorktreePathsInput,
    ) => Effect.Effect<
      ListWorktreePathsResult,
      DirectoryTooLargeError,
      WorktreeRead
    >;
  }
>()('@porcelain/files/ListWorktreePathsService') {
  static readonly layer = Layer.effect(
    ListWorktreePathsService,
    Effect.gen(function* () {
      const worktreePathsReaderCapability = yield* WorktreePathsReader;

      return {
        execute: Effect.fn('ListWorktreePathsService.execute')(function* (
          input: ListWorktreePathsInput,
        ): Effect.fn.Return<
          ListWorktreePathsResult,
          DirectoryTooLargeError,
          WorktreeRead
        > {
          const read = yield* worktreePathsReaderCapability.read({
            worktreeId: input.worktreeId,
          });
          if (read.kind === 'too-large')
            return yield* new DirectoryTooLargeError();
          return { worktreeId: input.worktreeId, paths: read.paths };
        }),
      };
    }),
  );
}
