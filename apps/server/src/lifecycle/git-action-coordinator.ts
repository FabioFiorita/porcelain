import type { GitActionIntent } from '@porcelain/git/dtos/git-action';
import { GitActionRejectedError } from '@porcelain/git/errors/git-action-rejected-error';
import type { GitActionReceipt, GitActionScope } from '../models/git-action.ts';
import type { GitActionStore } from '../repositories/interfaces/git-action-store.ts';
import type { AcceptGitAction } from '../use-cases/accept-git-action.ts';
import { GitActionNotFoundError } from '../use-cases/errors/git-action-not-found-error.ts';
import type { ExecuteGitAction } from '../use-cases/execute-git-action.ts';
import type { PrepareGitAction } from '../use-cases/prepare-git-action.ts';
import type { OperationRunner } from './operation-runner.ts';

export class GitActionCoordinator {
  private readonly operations: OperationRunner;
  private readonly prepare: PrepareGitAction;
  private readonly accept: AcceptGitAction;
  private readonly execute: ExecuteGitAction;
  private readonly store: GitActionStore;
  private readonly failures = new Set<string>();
  private readonly failedProjects = new Set<string>();
  constructor(
    operations: OperationRunner,
    prepare: PrepareGitAction,
    accept: AcceptGitAction,
    execute: ExecuteGitAction,
    store: GitActionStore,
  ) {
    this.operations = operations;
    this.prepare = prepare;
    this.accept = accept;
    this.execute = execute;
    this.store = store;
  }
  prepareAction(
    scope: GitActionScope,
    intent: GitActionIntent,
    signal?: AbortSignal,
  ) {
    if (this.failedProjects.has(scope.projectId))
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    const submitted = structuredClone({ scope, intent });
    return this.operations.run(async (operationSignal) => {
      if (this.failedProjects.has(submitted.scope.projectId))
        throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
      try {
        return await this.prepare.execute(
          submitted.scope,
          submitted.intent,
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
    }, signal);
  }
  submit(
    scope: GitActionScope,
    action: GitActionIntent['action'],
    requestId: string,
    preparationId: string,
    signal?: AbortSignal,
  ) {
    this.operations.assertOpen();
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
      void this.operations
        .runOwned(
          (operationSignal) =>
            this.executeOwned(accepted.receipt, operationSignal),
          120_000,
          signal,
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
      await this.execute.execute(receipt, signal);
    } catch {
      // Set the in-memory block before the queue advances, even if persistence
      // failed while recording an unconfirmed group. Never launch subsequent work.
      this.failedProjects.add(receipt.projectId);
      this.failures.add(receipt.requestId);
    }
  }
  receipt(requestId: string) {
    this.operations.assertOpen();
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
