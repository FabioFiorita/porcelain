import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type { CommitNotFoundError } from '@porcelain/changes/errors';
import type {
  CheckCommitService,
  ReadCommitDiffsService,
} from '@porcelain/changes/services';
import type {
  ReadCommitDiffsParams,
  ReadCommitDiffsRequest,
  ReadCommitDiffsResponse,
} from '@porcelain/contracts/changes';

export class ReadCommitDiffsUseCase {
  private readonly access: WorktreeAccess;
  private readonly checkCommit: CheckCommitService<GitIoFailure>;
  private readonly readCommitDiffs: ReadCommitDiffsService<GitIoFailure>;

  constructor(
    access: WorktreeAccess,
    checkCommit: CheckCommitService<GitIoFailure>,
    readCommitDiffs: ReadCommitDiffsService<GitIoFailure>,
  ) {
    this.access = access;
    this.checkCommit = checkCommit;
    this.readCommitDiffs = readCommitDiffs;
  }

  execute(
    input: ReadCommitDiffsParams & ReadCommitDiffsRequest,
  ): Effect.Effect<
    ReadCommitDiffsResponse,
    WorktreeAccessFailure | GitIoFailure | CommitNotFoundError
  > {
    const { worktreeId, oid, parent, paths } = input;
    return this.access.read(worktreeId, () =>
      Effect.gen({ self: this }, function* () {
        yield* this.checkCommit.execute({ worktreeId, oid, parent });
        const diffs = yield* this.readCommitDiffs.execute({
          worktreeId,
          oid,
          parent,
          paths,
        });
        return diffs;
      }),
    );
  }
}
