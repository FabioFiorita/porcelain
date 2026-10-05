import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type {
  CommitNotFoundError,
  IncompleteDiffReadError,
} from '@porcelain/changes/errors';
import type { ReadBranchDiffsService } from '@porcelain/changes/services';
import type {
  ReadBranchDiffsRequest,
  ReadBranchDiffsResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';

export class ReadBranchDiffsUseCase {
  private readonly access: WorktreeAccess;
  private readonly readBranchDiffs: ReadBranchDiffsService<GitIoFailure>;

  constructor(
    access: WorktreeAccess,
    readBranchDiffs: ReadBranchDiffsService<GitIoFailure>,
  ) {
    this.access = access;
    this.readBranchDiffs = readBranchDiffs;
  }

  execute(
    input: WorktreeParams & ReadBranchDiffsRequest,
  ): Effect.Effect<
    ReadBranchDiffsResponse,
    | WorktreeAccessFailure
    | GitIoFailure
    | CommitNotFoundError
    | IncompleteDiffReadError
  > {
    const { worktreeId, baseOid, headOid, paths } = input;
    return this.access.read(worktreeId, () =>
      Effect.gen({ self: this }, function* () {
        const diffs = yield* this.readBranchDiffs.execute({
          worktreeId,
          baseOid,
          headOid,
          paths,
        });
        return diffs;
      }),
    );
  }
}
