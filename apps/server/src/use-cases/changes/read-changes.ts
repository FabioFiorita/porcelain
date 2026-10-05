import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { ReadInterruptedGitActionService } from '@porcelain/git-actions/services';

export class ReadChangesUseCase {
  private readonly access: WorktreeAccess;
  private readonly readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>;
  private readonly readInterruptedGitAction: ReadInterruptedGitActionService;
  private readonly readEnvironment: ReadEnvironmentService;

  constructor(
    access: WorktreeAccess,
    readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>,
    readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>,
    readInterruptedGitAction: ReadInterruptedGitActionService,
    readEnvironment: ReadEnvironmentService,
  ) {
    this.access = access;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.readInterruptedGitAction = readInterruptedGitAction;
    this.readEnvironment = readEnvironment;
  }

  execute(
    input: WorktreeParams,
  ): Effect.Effect<
    ReadChangesResponse,
    MissingEnvironmentIdentityError | WorktreeAccessFailure | GitIoFailure
  > {
    const { worktreeId } = input;
    return this.access.read(worktreeId, () =>
      Effect.gen({ self: this }, function* () {
        const status = yield* this.readWorktreeStatus.execute({ worktreeId });
        const { changes } = yield* this.readChangeFingerprints.execute({
          worktreeId,
          comparisons: status.changes,
          paths: undefined,
        });
        const interrupted = yield* this.readInterruptedGitAction.execute({
          worktreeId,
        });
        return {
          environmentId: (yield* this.readEnvironment.execute()).environmentId,
          worktreeId,
          statusToken: status.statusToken,
          headOid: status.headOid,
          inProgress: status.inProgress,
          mergeHeadOid: status.mergeHeadOid,
          branch: status.branch,
          changes,
          ...(interrupted.kind === 'interrupted' && {
            interrupted: {
              requestId: interrupted.receipt.requestId,
              action: interrupted.receipt.action,
            },
          }),
        };
      }),
    );
  }
}
