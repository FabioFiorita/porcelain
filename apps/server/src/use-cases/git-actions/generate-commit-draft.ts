import type {
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
  CheckGitActionScopeService,
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
  private readonly checkGitActionScope: CheckGitActionScopeService;
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
    checkGitActionScope: CheckGitActionScopeService,
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
    this.checkGitActionScope = checkGitActionScope;
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
    const capture = await this.lanes.run(
      this.laneKeys.project(projectId),
      'read',
      async ({ signal }) => {
        const worktree = await this.checkWorktree.execute(
          { worktreeId },
          signal,
        );
        this.checkGitActionScope.execute({ projectId, worktree });
        const status = await this.readWorktreeStatus.execute(
          { worktreeId },
          signal,
        );
        const { changes } = await this.readChangeFingerprints.execute(
          { worktreeId, comparisons: status.changes, paths: undefined },
          signal,
        );
        return this.captureCommitDraft.execute(
          {
            worktreeId,
            observation: {
              statusToken: status.statusToken,
              headOid: status.headOid,
              changes,
            },
            expectedStatusToken: input.expectedStatusToken,
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
