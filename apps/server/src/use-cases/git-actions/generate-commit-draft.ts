import type {
  ConfirmDiffObservationService,
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import type {
  GenerateCommitDraftRequest,
  GenerateCommitDraftResponse,
  GitActionScope,
} from '@porcelain/contracts/git-actions';
import type {
  CaptureCommitDraftService,
  GenerateCommitDraftService,
} from '@porcelain/git-actions/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';

type GenerateCommitDraftOptions = { deadlineMs: number };

export class GenerateCommitDraftUseCase {
  private readonly checkWorktree: CheckWorktreeUseCasePort;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly confirmDiffObservation: ConfirmDiffObservationService;
  private readonly captureCommitDraft: CaptureCommitDraftService;
  private readonly generateCommitDraft: GenerateCommitDraftService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly options: GenerateCommitDraftOptions;

  constructor(
    checkWorktree: CheckWorktreeUseCasePort,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    confirmDiffObservation: ConfirmDiffObservationService,
    captureCommitDraft: CaptureCommitDraftService,
    generateCommitDraft: GenerateCommitDraftService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    options: GenerateCommitDraftOptions,
  ) {
    this.checkWorktree = checkWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
    this.confirmDiffObservation = confirmDiffObservation;
    this.captureCommitDraft = captureCommitDraft;
    this.generateCommitDraft = generateCommitDraft;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
    this.options = options;
  }

  async execute(
    input: GitActionScope & GenerateCommitDraftRequest,
    context: OperationContext,
  ): Promise<GenerateCommitDraftResponse> {
    const { worktreeId } = input;
    const worktree = await this.checkWorktree.execute(
      { worktreeId, requireAvailableProject: false },
      context,
    );
    const capture = await this.lanes.runConsistent(
      this.laneKeys.repository(worktree),
      worktree,
      async ({ signal }) => {
        const status = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const fingerprints = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths: undefined },
          signal,
        );
        this.confirmDiffObservation.execute({
          expectedStatusToken: input.expectedStatusToken,
          expectedFiles: [],
          statusToken: status.statusToken,
          fingerprints,
          previousStamp: undefined,
        });
        return this.captureCommitDraft.execute(
          {
            worktreeId,
            observation: {
              headOid: status.headOid,
              changes: fingerprints.changes,
            },
            paths: input.paths,
          },
          signal,
        );
      },
      { callerSignal: context.signal },
    );
    return this.lanes.unqueued(
      (signal) =>
        this.generateCommitDraft.execute(
          { capture, mode: input.mode, model: input.model },
          signal,
        ),
      { callerSignal: context.signal, deadlineMs: this.options.deadlineMs },
    );
  }
}
