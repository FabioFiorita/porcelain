import type {
  CommitDraft,
  CommitDraftInput,
  GitActionScope,
} from '@porcelain/git-actions/models';
import type {
  AdmitCommitDraftService,
  CaptureCommitDraftService,
  GenerateCommitDraftService,
} from '@porcelain/git-actions/services';
import type { Lanes } from '../runtime/operation-runner.ts';

export class GenerateCommitDraftController {
  private readonly lanes: Lanes;
  private readonly laneFor: (projectId: string) => string;
  private readonly admit: AdmitCommitDraftService;
  private readonly capture: CaptureCommitDraftService;
  private readonly generate: GenerateCommitDraftService;

  constructor(
    lanes: Lanes,
    laneFor: (projectId: string) => string,
    admit: AdmitCommitDraftService,
    capture: CaptureCommitDraftService,
    generate: GenerateCommitDraftService,
  ) {
    this.lanes = lanes;
    this.laneFor = laneFor;
    this.admit = admit;
    this.capture = capture;
    this.generate = generate;
  }

  async execute(
    scope: GitActionScope,
    input: CommitDraftInput,
    signal?: AbortSignal,
  ): Promise<CommitDraft> {
    scope = structuredClone(scope);
    input = structuredClone(input);
    const admission = this.admit.execute(scope.worktreeId);
    try {
      const captured = await this.lanes.run(
        this.laneFor(scope.projectId),
        'read',
        ({ signal: operationSignal }) =>
          this.capture.execute(scope, input, operationSignal),
        { callerSignal: signal },
      );
      return await this.lanes.unqueued(
        (operationSignal) =>
          this.generate.execute(captured, input, operationSignal),
        { callerSignal: signal, deadlineMs: 120_000 },
      );
    } finally {
      admission.release();
    }
  }
}
