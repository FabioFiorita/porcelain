import type { RunGitActionRequest } from '@porcelain/contracts/git-actions';
import {
  gitActionReceiptView,
  type GitActionReceipt,
  type GitActionReceiptView,
  type GitActionScope,
} from '@porcelain/git-actions/models';
import type {
  AcceptGitActionService,
  ExecuteGitActionService,
  ReadGitActionReceiptService,
  RecordGitActionProgressService,
} from '@porcelain/git-actions/services';
import { ApplicationClosedError } from '../runtime/errors/application-closed-error.ts';
import type { Lanes } from '../runtime/operation-runner.ts';

export class RunGitActionController {
  private readonly lanes: Lanes;
  private readonly laneFor: (projectId: string) => string;
  private readonly accept: AcceptGitActionService;
  private readonly executeAction: ExecuteGitActionService;
  private readonly readReceipt: ReadGitActionReceiptService;
  private readonly progress: RecordGitActionProgressService;
  private readonly publish: ((receipt: GitActionReceipt) => void) | undefined;

  constructor(
    lanes: Lanes,
    laneFor: (projectId: string) => string,
    accept: AcceptGitActionService,
    executeAction: ExecuteGitActionService,
    readReceipt: ReadGitActionReceiptService,
    progress: RecordGitActionProgressService,
    publish?: (receipt: GitActionReceipt) => void,
  ) {
    this.lanes = lanes;
    this.laneFor = laneFor;
    this.accept = accept;
    this.executeAction = executeAction;
    this.readReceipt = readReceipt;
    this.progress = progress;
    this.publish = publish;
  }

  execute(
    scope: GitActionScope,
    request: RunGitActionRequest,
  ): GitActionReceiptView {
    this.lanes.assertOpen();
    const accepted = this.accept.execute(
      scope,
      request.requestId,
      request.input,
      request.expected,
    );
    if (accepted.created) {
      this.publish?.(accepted.receipt);
      void this.lanes
        .run(
          this.laneFor(scope.projectId),
          'write',
          ({ signal }) => this.executeOwned(accepted.receipt, signal),
          { deadlineMs: 120_000, untilSettled: true },
        )
        .catch(() =>
          this.lanes.finish(() =>
            this.executeOwned(
              accepted.receipt,
              AbortSignal.abort(new ApplicationClosedError()),
            ),
          ),
        )
        .catch(() => {});
    }
    return gitActionReceiptView(this.readReceipt.execute(request.requestId));
  }

  private async executeOwned(receipt: GitActionReceipt, signal: AbortSignal) {
    await this.executeAction.execute(receipt, signal, (line) => {
      const updated = this.progress.execute(receipt.requestId, line);
      if (updated) this.publish?.(updated);
    });
    this.publish?.(this.readReceipt.execute(receipt.requestId));
  }
}
