import type { ProofFileNotFoundError } from '@porcelain/reviews/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  ReadProofFileQuery,
  ReadProofFileResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadProofFileService } from '@porcelain/reviews/services';

export class ReadProofFileUseCase {
  private readonly access: WorktreeAccess;
  private readonly readProofFile: ReadProofFileService;

  constructor(access: WorktreeAccess, readProofFile: ReadProofFileService) {
    this.access = access;
    this.readProofFile = readProofFile;
  }

  execute(
    input: WorktreeParams & ReadProofFileQuery,
  ): Effect.Effect<
    ReadProofFileResponse,
    WorktreeAccessFailure | ProofFileNotFoundError
  > {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId, proofId } = input;
      return yield* this.access.reviews(worktreeId, 'read', () =>
        Effect.gen({ self: this }, function* () {
          return yield* this.readProofFile.execute({ worktreeId, proofId });
        }),
      );
    });
  }
}
