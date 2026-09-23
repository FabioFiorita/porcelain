import type {
  GenerateCommitDraftRequest,
  GenerateCommitDraftResponse,
  GitActionScope,
} from '@porcelain/contracts/git-actions';
import type {
  CaptureCommitDraftService,
  CheckWorktreeService,
  GenerateCommitDraftService,
} from '@porcelain/git-actions/services';
import type { CheckProjectService } from '@porcelain/projects/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export type GenerateCommitDraftOptions = { deadlineMs: number };

export class GenerateCommitDraftController {
  private readonly checkProject: CheckProjectService;
  private readonly checkWorktree: CheckWorktreeService;
  private readonly captureCommitDraft: CaptureCommitDraftService;
  private readonly generateCommitDraft: GenerateCommitDraftService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly options: GenerateCommitDraftOptions;

  constructor(
    checkProject: CheckProjectService,
    checkWorktree: CheckWorktreeService,
    captureCommitDraft: CaptureCommitDraftService,
    generateCommitDraft: GenerateCommitDraftService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    options: GenerateCommitDraftOptions,
  ) {
    this.checkProject = checkProject;
    this.checkWorktree = checkWorktree;
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
    const scope = { projectId: input.projectId, worktreeId: input.worktreeId };
    this.checkProject.execute(scope);
    const capture = await this.lanes.run(
      this.laneKeys.project(input.projectId),
      'read',
      async ({ signal }) => {
        await this.checkWorktree.execute(scope, signal);
        return this.captureCommitDraft.execute(
          {
            ...scope,
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
