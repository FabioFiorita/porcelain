import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type { Context } from 'effect';
import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';
import type {
  SelectionMismatchError,
  UnnamedDiffSelectionError,
  IncompleteDiffReadError,
} from '@porcelain/changes/errors';
import type { ReadEnvironmentService } from '@porcelain/access/services';
import type {
  CheckDiffSelectionService,
  ConfirmDiffObservationService,
  ReadChangeDiffsService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type {
  ReadChangeDiffsRequest,
  ReadChangeDiffsResponse,
} from '@porcelain/contracts/changes';
import type { WorktreeParams } from '@porcelain/contracts/shared';

export class ReadChangeDiffsUseCase {
  private readonly access: WorktreeAccess;
  private readonly readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>;
  private readonly checkDiffSelection: CheckDiffSelectionService;
  private readonly confirmDiffObservation: ConfirmDiffObservationService;
  private readonly readChangeDiffs: ReadChangeDiffsService<GitIoFailure>;
  private readonly readEnvironment: Context.Service.Shape<
    typeof ReadEnvironmentService
  >;

  constructor(
    access: WorktreeAccess,
    readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>,
    readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>,
    checkDiffSelection: CheckDiffSelectionService,
    confirmDiffObservation: ConfirmDiffObservationService,
    readChangeDiffs: ReadChangeDiffsService<GitIoFailure>,
    readEnvironment: Context.Service.Shape<typeof ReadEnvironmentService>,
  ) {
    this.access = access;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.checkDiffSelection = checkDiffSelection;
    this.confirmDiffObservation = confirmDiffObservation;
    this.readChangeDiffs = readChangeDiffs;
    this.readEnvironment = readEnvironment;
  }

  execute(
    input: WorktreeParams & ReadChangeDiffsRequest,
  ): Effect.Effect<
    ReadChangeDiffsResponse,
    | MissingEnvironmentIdentityError
    | WorktreeAccessFailure
    | GitIoFailure
    | SelectionMismatchError
    | UnnamedDiffSelectionError
    | IncompleteDiffReadError
  > {
    const { worktreeId, expectedStatusToken, expectedFiles, selections } =
      input;
    return this.access.read(worktreeId, () =>
      Effect.gen({ self: this }, function* () {
        const before = yield* this.readWorktreeStatus.execute({ worktreeId });
        const selected = yield* this.checkDiffSelection.execute({
          expectedFiles,
          selections,
          status: before,
        });
        const observed = yield* this.readChangeFingerprints.execute({
          worktreeId,
          comparisons: before.changes,
          paths: selected.paths,
        });
        yield* this.confirmDiffObservation.execute({
          expectedStatusToken,
          expectedFiles,
          statusToken: before.statusToken,
          fingerprints: observed,
          previousStamp: undefined,
        });
        const diffs = yield* this.readChangeDiffs.execute({
          worktreeId,
          comparisons: selected.comparisons,
        });
        const after = yield* this.readWorktreeStatus.execute({ worktreeId });
        const reobserved = yield* this.readChangeFingerprints.execute({
          worktreeId,
          comparisons: after.changes,
          paths: selected.paths,
        });
        yield* this.confirmDiffObservation.execute({
          expectedStatusToken,
          expectedFiles,
          statusToken: after.statusToken,
          fingerprints: reobserved,
          previousStamp: observed.stamp,
        });
        return {
          environmentId: (yield* this.readEnvironment.execute()).environmentId,
          worktreeId,
          statusToken: before.statusToken,
          diffs,
        };
      }),
    );
  }
}
