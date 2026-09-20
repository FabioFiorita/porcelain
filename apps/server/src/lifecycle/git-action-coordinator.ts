import type { GitActionIntent } from '@porcelain/git/dtos/git-action';
import { GitActionRejectedError } from '@porcelain/git/errors/git-action-rejected-error';
import { RequestGitSession } from '@porcelain/git/git-session';
import type { GitActionReceipt, GitActionScope } from '../models/git-action.ts';
import type { GitActionStore } from '../repositories/interfaces/git-action-store.ts';
import type { AcceptGitAction } from '../use-cases/accept-git-action.ts';
import { GitActionNotFoundError } from '../use-cases/errors/git-action-not-found-error.ts';
import type { ExecuteGitAction } from '../use-cases/execute-git-action.ts';
import type { PrepareGitAction } from '../use-cases/prepare-git-action.ts';
import { ApplicationClosedError } from './errors/application-closed-error.ts';
import type { Lanes } from './lanes.ts';

export class GitActionCoordinator {
  private readonly lanes: Lanes;
  private readonly laneFor: (projectId: string) => string;
  private readonly prepare: PrepareGitAction;
  private readonly accept: AcceptGitAction;
  private readonly execute: ExecuteGitAction;
  private readonly store: GitActionStore;
  private readonly failures = new Set<string>();
  private readonly failedProjects = new Set<string>();
  constructor(
    lanes: Lanes,
    laneFor: (projectId: string) => string,
    prepare: PrepareGitAction,
    accept: AcceptGitAction,
    execute: ExecuteGitAction,
    store: GitActionStore,
  ) {
    this.lanes = lanes;
    this.laneFor = laneFor;
    this.prepare = prepare;
    this.accept = accept;
    this.execute = execute;
    this.store = store;
  }
  /** A removed project takes its in-memory refusal with it. */
  forget(projectId: string): void {
    this.failedProjects.delete(projectId);
  }
  prepareAction(
    scope: GitActionScope,
    intent: GitActionIntent,
    signal?: AbortSignal,
  ) {
    if (this.failedProjects.has(scope.projectId))
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    const submitted = structuredClone({ scope, intent });
    // Preparing inspects through the action process, which owns the refusal
    // latch, so it runs one at a time like the action it prepares.
    return this.lanes.run(
      this.laneFor(submitted.scope.projectId),
      'write',
      async ({ signal: operationSignal }) => {
        if (this.failedProjects.has(submitted.scope.projectId))
          throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
        try {
          return await this.prepare.execute(
            submitted.scope,
            submitted.intent,
            new RequestGitSession(),
            operationSignal,
          );
        } catch (error) {
          if (
            error instanceof GitActionRejectedError &&
            error.reason === 'PROCESS_GROUP_UNCONFIRMED'
          )
            this.failedProjects.add(submitted.scope.projectId);
          throw error;
        }
      },
      { callerSignal: signal },
    );
  }
  submit(
    scope: GitActionScope,
    action: GitActionIntent['action'],
    requestId: string,
    preparationId: string,
  ) {
    this.lanes.assertOpen();
    if (
      this.failedProjects.has(scope.projectId) &&
      !this.store.receipt(requestId)
    )
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    const accepted = this.accept.execute(
      scope,
      action,
      requestId,
      preparationId,
    );
    if (accepted.created) {
      void this.lanes
        .run(
          this.laneFor(accepted.receipt.projectId),
          'write',
          ({ signal: operationSignal }) =>
            this.executeOwned(accepted.receipt, operationSignal),
          { deadlineMs: 120_000, untilSettled: true },
        )
        .catch(() =>
          // The receipt was persisted as running before admission, so a
          // refused admission still has to finish it. Nothing has launched
          // Git, so an aborted signal records it without running anything,
          // and the lane waits for this before releasing its resources.
          this.lanes.finish(() =>
            this.executeOwned(
              accepted.receipt,
              AbortSignal.abort(new ApplicationClosedError()),
            ),
          ),
        )
        .catch(() => {});
    }
    return this.receipt(requestId);
  }
  private async executeOwned(
    receipt: GitActionReceipt,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      if (this.failedProjects.has(receipt.projectId))
        throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
      await this.execute.execute(receipt, new RequestGitSession(), signal);
    } catch {
      // Set the in-memory block before the queue advances, even if persistence
      // failed while recording an unconfirmed group. Never launch subsequent work.
      //
      // ExecuteGitAction turns every refusal into an outcome it records, so
      // what reaches here is the unexpected: a store that could not be
      // written. A submit whose project was removed while it waited for the
      // lane is not one of them — it finds its preparation gone, is recorded
      // as rejected, and leaves no latch behind for an id that is gone too.
      this.failedProjects.add(receipt.projectId);
      this.failures.add(receipt.requestId);
    }
  }
  receipt(requestId: string) {
    this.lanes.assertOpen();
    const receipt = this.store.receipt(requestId);
    if (!receipt) throw new GitActionNotFoundError();
    return this.failures.has(requestId)
      ? {
          ...receipt,
          state: 'indeterminate' as const,
          reason: 'PROCESS_GROUP_UNCONFIRMED' as const,
          refreshRequired: true,
        }
      : receipt;
  }
}
