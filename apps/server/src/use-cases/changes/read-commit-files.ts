import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type { CommitNotFoundError } from '@porcelain/changes/errors';
import type { ReadCommitFilesService } from '@porcelain/changes/services';
import type {
  ReadCommitFilesParams,
  ReadCommitFilesQuery,
  ReadCommitFilesResponse,
} from '@porcelain/contracts/changes';

export class ReadCommitFilesUseCase {
  private readonly access: WorktreeAccess;
  private readonly readCommitFiles: ReadCommitFilesService<GitIoFailure>;

  constructor(
    access: WorktreeAccess,
    readCommitFiles: ReadCommitFilesService<GitIoFailure>,
  ) {
    this.access = access;
    this.readCommitFiles = readCommitFiles;
  }

  execute(
    input: ReadCommitFilesParams & ReadCommitFilesQuery,
  ): Effect.Effect<
    ReadCommitFilesResponse,
    WorktreeAccessFailure | GitIoFailure | CommitNotFoundError
  > {
    const { worktreeId, oid, parent } = input;
    return this.access.read(worktreeId, () =>
      Effect.gen({ self: this }, function* () {
        const files = yield* this.readCommitFiles.execute({
          worktreeId,
          oid,
          parent,
        });
        return files;
      }),
    );
  }
}
