import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type {
  BranchBaseNotFoundError,
  UnbornBranchError,
  UnrelatedBranchError,
} from '@porcelain/changes/errors';
import type { ReadBranchChangesService } from '@porcelain/changes/services';
import type {
  ReadBranchChangesQuery,
  ReadBranchChangesResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';

export class ReadBranchChangesUseCase {
  private readonly access: WorktreeAccess;
  private readonly readBranchChanges: ReadBranchChangesService<GitIoFailure>;

  constructor(
    access: WorktreeAccess,
    readBranchChanges: ReadBranchChangesService<GitIoFailure>,
  ) {
    this.access = access;
    this.readBranchChanges = readBranchChanges;
  }

  execute(
    input: WorktreeParams & ReadBranchChangesQuery,
  ): Effect.Effect<
    ReadBranchChangesResponse,
    | WorktreeAccessFailure
    | GitIoFailure
    | BranchBaseNotFoundError
    | UnbornBranchError
    | UnrelatedBranchError
  > {
    const { worktreeId, base } = input;
    return this.access.read(worktreeId, () =>
      Effect.gen({ self: this }, function* () {
        const changes = yield* this.readBranchChanges.execute({
          worktreeId,
          base,
        });
        return { worktreeId, ...changes };
      }),
    );
  }
}
