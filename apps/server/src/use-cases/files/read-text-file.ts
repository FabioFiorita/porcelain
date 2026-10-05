import type {
  ReadTextFileQuery,
  ReadTextFileResponse,
} from '@porcelain/contracts/files';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  ReadTextFileService,
  ReadTextFileFailure,
} from '@porcelain/files/services';
import type { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';

export class ReadTextFileUseCase {
  private readonly access: WorktreeAccess;
  private readonly readTextFile: ReadTextFileService;

  constructor(access: WorktreeAccess, readTextFile: ReadTextFileService) {
    this.access = access;
    this.readTextFile = readTextFile;
  }

  execute(
    input: WorktreeParams & ReadTextFileQuery,
  ): Effect.Effect<
    ReadTextFileResponse,
    WorktreeAccessFailure | ReadTextFileFailure
  > {
    return this.access.read(input.worktreeId, (worktree) =>
      this.readTextFile.execute({ ...input, worktreeId: worktree.id }),
    );
  }
}
