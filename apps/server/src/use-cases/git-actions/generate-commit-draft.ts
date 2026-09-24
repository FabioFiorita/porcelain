import type {
  ReadChangeFingerprintsService,
  ReadWorktreeStatusService,
} from '@porcelain/changes/services';
import { observationProblem } from '@porcelain/changes/rules';
import { WorktreeChangedError } from '@porcelain/kernel/errors';
import type {
  GenerateCommitDraftRequest,
  GenerateCommitDraftResponse,
  GitActionScope,
} from '@porcelain/contracts/git-actions';
import type {
  CaptureCommitDraftService,
  GenerateCommitDraftService,
} from '@porcelain/git-actions/services';
import type {
  CheckProjectService,
  CheckWorktreeService,
} from '@porcelain/projects/services';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';
import type { OperationContext } from '../../runtime/operation-context.ts';

export type GenerateCommitDraftOptions = { deadlineMs: number };

export class GenerateCommitDraftUseCase {
  private readonly checkProject: CheckProjectService;
  private readonly checkWorktree: CheckWorktreeService;
  private readonly readWorktreeStatus: ReadWorktreeStatusService;
  private readonly readChangeFingerprints: ReadChangeFingerprintsService;
  private readonly captureCommitDraft: CaptureCommitDraftService;
  private readonly generateCommitDraft: GenerateCommitDraftService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly options: GenerateCommitDraftOptions;

  constructor(
    checkProject: CheckProjectService,
    checkWorktree: CheckWorktreeService,
    readWorktreeStatus: ReadWorktreeStatusService,
    readChangeFingerprints: ReadChangeFingerprintsService,
    captureCommitDraft: CaptureCommitDraftService,
    generateCommitDraft: GenerateCommitDraftService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    options: GenerateCommitDraftOptions,
  ) {
    this.checkProject = checkProject;
    this.checkWorktree = checkWorktree;
    this.readWorktreeStatus = readWorktreeStatus;
    this.readChangeFingerprints = readChangeFingerprints;
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
    const { projectId, worktreeId } = input;
    this.checkProject.execute({ projectId });
    const worktree = await this.checkWorktree.execute(
      { worktreeId, projectId, purpose: 'writing' },
      context.signal,
    );
    const capture = await this.lanes.run(
      this.laneKeys.repository(worktree),
      'read',
      async ({ signal }) => {
        const status = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const fingerprints = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths: undefined },
          signal,
        );
        const problem = observationProblem({
          expectedStatusToken: input.expectedStatusToken,
          expectedFiles: [],
          statusToken: status.statusToken,
          fingerprints,
          previousStamp: undefined,
        });
        if (problem) throw new WorktreeChangedError();
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
