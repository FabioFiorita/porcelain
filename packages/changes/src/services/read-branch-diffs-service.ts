import { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import { IncompleteDiffReadError } from '../errors/incomplete-diff-read-error.ts';
import type { ChangeDiffContent } from '../models/change-diff.ts';
import type {
  ReadBranchDiffsInput,
  ReadBranchDiffsResult,
} from '../models/read-branch-diffs.ts';
import type { BranchRangeReader } from '../ports/branch-range-reader.ts';

const OVER_LIMIT: ChangeDiffContent = { kind: 'omitted', reason: 'size-limit' };

export class ReadBranchDiffsService<E = never> {
  private readonly branchRangeReader: BranchRangeReader<E>;

  constructor(branchRangeReader: BranchRangeReader<E>) {
    this.branchRangeReader = branchRangeReader;
  }

  execute(
    input: ReadBranchDiffsInput,
  ): Effect.Effect<
    ReadBranchDiffsResult,
    E | CommitNotFoundError | IncompleteDiffReadError,
    WorktreeRead
  > {
    return Effect.gen({ self: this }, function* () {
      const read = yield* this.branchRangeReader.readBranchPatches({
        worktreeId: input.worktreeId,
        baseOid: input.baseOid,
        headOid: input.headOid,
        paths: input.paths,
      });
      if (read.kind === 'missing')
        return yield* Effect.fail(new CommitNotFoundError());
      const patches = new Map(
        read.kind === 'within-limit'
          ? read.patches.map((patch) => [patch.paths.join('\0'), patch.content])
          : [],
      );
      const diffs = yield* Effect.forEach(input.paths, (paths) =>
        Effect.gen(function* () {
          if (read.kind === 'over-limit')
            return { paths: [...paths], content: OVER_LIMIT };
          const content = patches.get(paths.join('\0'));
          if (content === undefined)
            return yield* Effect.fail(new IncompleteDiffReadError());
          return { paths: [...paths], content };
        }),
      );
      return { diffs };
    });
  }
}
