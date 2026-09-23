import type {
  GenerateCommitDraftRequest,
  GenerateCommitDraftResponse,
  GitActionScope,
} from '@porcelain/contracts/git-actions';
import type {
  CaptureCommitDraftService,
  GenerateCommitDraftService,
} from '@porcelain/git-actions/services';
import type { LaneKeys } from '../runtime/lane-keys.ts';
import type { Lanes } from '../runtime/lanes.ts';
import type { OperationContext } from '../runtime/operation-context.ts';

export type GenerateCommitDraftOptions = { deadlineMs: number };

export class GenerateCommitDraftController {
  private readonly captureCommitDraft: CaptureCommitDraftService;
  private readonly generateCommitDraft: GenerateCommitDraftService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;
  private readonly options: GenerateCommitDraftOptions;

  constructor(
    captureCommitDraft: CaptureCommitDraftService,
    generateCommitDraft: GenerateCommitDraftService,
    lanes: Lanes,
    laneKeys: LaneKeys,
    options: GenerateCommitDraftOptions,
  ) {
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
    const capture = await this.lanes.run(
      this.laneKeys.project(input.projectId),
      'read',
      ({ signal }) =>
        this.captureCommitDraft.execute(
          {
            projectId: input.projectId,
            worktreeId: input.worktreeId,
            expectedStatusToken: input.expectedStatusToken,
            paths: input.paths,
          },
          signal,
        ),
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
