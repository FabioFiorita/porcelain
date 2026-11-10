import { Context, Effect, Layer } from 'effect';
import type {
  BranchArchiveTarget,
  ArchivePullRequestResponse,
} from '../models/archive-branch.ts';
import { BranchArchiver } from '../ports/branch-archiver.ts';
import { BranchArchiveRefusedError } from '../errors/branch-archive-refused-error.ts';
type Input = Omit<
  BranchArchiveTarget,
  'branch' | 'mergedHead' | 'worktreePath'
> & {
  pull:
    | {
        state: 'open' | 'merged' | 'closed';
        headBranch: string;
        headSha: string;
      }
    | undefined;
  worktrees: readonly { branch: string | undefined; path: string }[];
};
export class ArchiveBranchService extends Context.Service<
  ArchiveBranchService,
  {
    readonly execute: (
      input: Input,
    ) => Effect.Effect<ArchivePullRequestResponse, BranchArchiveRefusedError>;
  }
>()('@porcelain/projects/ArchiveBranchService') {
  static readonly layer = Layer.effect(
    ArchiveBranchService,
    Effect.gen(function* () {
      const archiver = yield* BranchArchiver;
      return {
        execute: Effect.fn('ArchiveBranchService.execute')(function* (input) {
          const pull = input.pull;
          if (!pull)
            return yield* new BranchArchiveRefusedError({
              message:
                'The pull request could not be confirmed. Nothing was deleted. Refresh it and retry.',
            });
          if (pull.state === 'open')
            return yield* new BranchArchiveRefusedError({
              message:
                'Only a merged or closed pull request can be archived. Refresh the pull request and retry.',
            });
          const worktree = input.worktrees.find(
            (tree) => tree.branch === `refs/heads/${pull.headBranch}`,
          );
          const plan = yield* archiver.execute({
            ...input,
            branch: pull.headBranch,
            worktreePath: worktree?.path,
            mergedHead: pull.state === 'merged' ? pull.headSha : undefined,
          });
          return { archived: input.confirmation !== undefined, plan };
        }),
      };
    }),
  );
}
