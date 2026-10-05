import { Effect } from 'effect';
import type {
  ConfirmDiffObservationService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type {
  GenerateCommitDraftRequest,
  GenerateCommitDraftResponse,
} from '@porcelain/contracts/git-actions';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type {
  CaptureCommitDraftService,
  GenerateCommitDraftService,
} from '@porcelain/git-actions/services';
import type { Lanes } from '../../runtime/lanes.ts';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
import type { WorktreeAccessFailure } from '../../ports/worktree-access-failure.ts';
import type { GitIoFailure } from '../../ports/git-io-failure.ts';

type GenerateCommitDraftOptions = { deadlineMs: number };

export class GenerateCommitDraftUseCase {
  private readonly access: WorktreeAccess;
  private readonly readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>;
  private readonly confirmDiffObservation: ConfirmDiffObservationService;
  private readonly captureCommitDraft: CaptureCommitDraftService<GitIoFailure>;
  private readonly generateCommitDraft: GenerateCommitDraftService;
  private readonly lanes: Lanes;
  private readonly options: GenerateCommitDraftOptions;

  constructor(
    access: WorktreeAccess,
    readWorktreeStatus: ReadWorktreeStatusService<GitIoFailure>,
    readChangeFingerprints: ReadChangeFingerprintsService<GitIoFailure>,
    confirmDiffObservation: ConfirmDiffObservationService,
    captureCommitDraft: CaptureCommitDraftService<GitIoFailure>,
    generateCommitDraft: GenerateCommitDraftService,
    lanes: Lanes,
    options: GenerateCommitDraftOptions,
  ) {
    this.access = access;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.confirmDiffObservation = confirmDiffObservation;
    this.captureCommitDraft = captureCommitDraft;
    this.generateCommitDraft = generateCommitDraft;
    this.lanes = lanes;
    this.options = options;
  }

  execute(
    input: WorktreeParams & GenerateCommitDraftRequest,
  ): Effect.Effect<
    GenerateCommitDraftResponse,
    | WorktreeAccessFailure
    | GitIoFailure
    | Effect.Error<ReturnType<CaptureCommitDraftService['execute']>>
    | Effect.Error<ReturnType<GenerateCommitDraftService['execute']>>
  > {
    return Effect.gen({ self: this }, function* () {
      const { worktreeId } = input;
      const capture = yield* this.access.read(worktreeId, () =>
        Effect.gen({ self: this }, function* () {
          const status = yield* this.readWorktreeStatus.execute({ worktreeId });
          const fingerprints = yield* this.readChangeFingerprints.execute({
            worktreeId,
            comparisons: status.changes,
            paths: undefined,
          });
          yield* this.confirmDiffObservation.execute({
            expectedStatusToken: input.expectedStatusToken,
            expectedFiles: [],
            statusToken: status.statusToken,
            fingerprints,
            previousStamp: undefined,
          });
          return yield* this.captureCommitDraft.execute({
            worktreeId,
            observation: {
              headOid: status.headOid,
              changes: fingerprints.changes,
            },
            paths: input.paths,
          });
        }),
      );
      return yield* this.lanes.unqueued(
        () =>
          this.generateCommitDraft.execute({
            capture,
            mode: input.mode,
            model: input.model,
          }),
        this.options,
      );
    });
  }
}
