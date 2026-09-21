import { createHash } from 'node:crypto';
import type { RunGitActionRequest } from '@porcelain/contracts/git-actions';
import { RequestGitSession } from '@porcelain/git/git-session';
import type { GitActionReceipt, GitActionScope } from '../models/git-action.ts';
import type { GitActionStore } from '../repositories/interfaces/git-action-store.ts';
import { GitActionNotFoundError } from '../use-cases/errors/git-action-not-found-error.ts';
import type { ExecuteGitAction } from '../use-cases/execute-git-action.ts';
import { ApplicationClosedError } from './errors/application-closed-error.ts';
import type { Lanes } from './lanes.ts';

export class GitActionCoordinator {
  private readonly lanes: Lanes;
  private readonly laneFor: (projectId: string) => string;
  private readonly execute: ExecuteGitAction;
  private readonly store: GitActionStore;
  private readonly publish: ((receipt: GitActionReceipt) => void) | undefined;
  constructor(
    lanes: Lanes,
    laneFor: (projectId: string) => string,
    execute: ExecuteGitAction,
    store: GitActionStore,
    publish?: (receipt: GitActionReceipt) => void,
  ) {
    this.lanes = lanes;
    this.laneFor = laneFor;
    this.execute = execute;
    this.store = store;
    this.publish = publish;
  }

  run(scope: GitActionScope, request: RunGitActionRequest) {
    this.lanes.assertOpen();
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          scope,
          input: request.input,
          expected: request.expected,
        }),
      )
      .digest('hex');
    const accepted = this.store.acceptDirect(
      scope,
      request.requestId,
      request.input,
      request.expected,
      fingerprint,
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
    return this.receipt(request.requestId);
  }

  private async executeOwned(receipt: GitActionReceipt, signal: AbortSignal) {
    await this.execute.executeDirect(
      receipt,
      new RequestGitSession(),
      signal,
      (line) => {
        const current = this.store.receipt(receipt.requestId);
        if (current?.state !== 'running') return;
        const updated = {
          ...current,
          progress: [...(current.progress ?? []), line].slice(-200),
        };
        this.store.finish(updated);
        this.publish?.(updated);
      },
    );
    this.publish?.(this.receipt(receipt.requestId));
  }

  receipt(requestId: string) {
    this.lanes.assertOpen();
    const receipt = this.store.receipt(requestId);
    if (!receipt) throw new GitActionNotFoundError();
    return receipt;
  }

  interrupted(worktreeId: string) {
    this.lanes.assertOpen();
    return this.store.interrupted(worktreeId);
  }

  dismissInterrupted(scope: GitActionScope, requestId: string) {
    this.lanes.assertOpen();
    this.store.dismissInterrupted(scope, requestId);
  }
}
