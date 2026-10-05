import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type {
  BranchBaseNotFoundError,
  UnbornBranchError,
  UnrelatedBranchError,
} from '@porcelain/changes/errors';
import type { ReviewedMarkConflictError } from '@porcelain/reviews/errors';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type {
  ReadBranchChangesService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type {
  ReviewedFileConflictPolicy,
  SetReviewedFileRequest,
  SetReviewedFilesRequest,
  SetReviewedFilesResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { SetReviewedFilesService } from '@porcelain/reviews/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';

export class SetReviewedFilesUseCase {
  private readonly access: WorktreeAccess;
  private readonly readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>;
  private readonly readBranchChanges: ReadBranchChangesService<GitIoFailure>;
  private readonly setReviewedFiles: SetReviewedFilesService;
  private readonly events: EventPublisher;

  constructor(
    access: WorktreeAccess,
    readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>,
    readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>,
    readBranchChanges: ReadBranchChangesService<GitIoFailure>,
    setReviewedFiles: SetReviewedFilesService,
    events: EventPublisher,
  ) {
    this.access = access;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.readBranchChanges = readBranchChanges;
    this.setReviewedFiles = setReviewedFiles;
    this.events = events;
  }

  execute(
    input: WorktreeParams &
      (SetReviewedFilesRequest | SetReviewedFileRequest) &
      ReviewedFileConflictPolicy,
  ): Effect.Effect<
    SetReviewedFilesResponse,
    | WorktreeAccessFailure
    | ReviewedMarkConflictError
    | GitIoFailure
    | BranchBaseNotFoundError
    | UnbornBranchError
    | UnrelatedBranchError
  > {
    const { worktreeId } = input;
    return this.access
      .transaction(
        worktreeId,
        () =>
          Effect.gen({ self: this }, function* () {
            const branch =
              input.scope === 'branch'
                ? yield* this.readBranchChanges.execute({
                    worktreeId,
                    base: input.base,
                  })
                : undefined;
            const changes =
              branch?.files ?? (yield* this.worktreeChanges(worktreeId));
            return { branch, changes };
          }),
        ({ branch, changes }) =>
          this.setReviewedFiles.execute({
            worktreeId,
            scope: input.scope,
            branch: branch?.head.branch,
            files:
              'files' in input
                ? input.files
                : [{ path: input.path, fingerprint: input.fingerprint }],
            changes,
            onConflict: input.onConflict,
          }),
        ({ changed }) =>
          Effect.sync(() => {
            if (changed)
              this.events.worktreeChanged({ worktreeId, change: 'reviewed' });
          }),
      )
      .pipe(Effect.map(({ changed, ...result }) => result));
  }

  private worktreeChanges(worktreeId: string) {
    return Effect.gen({ self: this }, function* () {
      const status = yield* this.readWorktreeStatus.execute({ worktreeId });
      const { changes } = yield* this.readChangeFingerprints.execute({
        worktreeId,
        comparisons: status.changes,
        paths: undefined,
      });
      return changes;
    });
  }
}
