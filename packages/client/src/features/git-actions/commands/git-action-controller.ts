import { Effect, Schema } from 'effect';
import type { QueryClient } from '@tanstack/query-core';
import type {
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { currentAnswerEffect } from '../../../shared/api/stale-answer.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import type { ConnectionError } from '../../../shared/api/connection-error.ts';
import { withSignal } from '@porcelain/effects';
import { gitActionsApi } from '../api.ts';
import {
  isTerminal,
  operationKey,
  type OperationStore,
} from '../store/operations.ts';
import { refreshGitReceipt } from './refresh-receipt.ts';

type Receipt = RunGitActionResponse;
type RunFailure = Effect.Error<
  ReturnType<ReturnType<typeof gitActionsApi>['runGitAction']>
>;

class GitOperationStateError extends Schema.TaggedError<GitOperationStateError>()(
  'GitOperationStateError',
  {
    reason: Schema.Literals(['pending', 'missing', 'mismatch']),
  },
) {
  override get message() {
    switch (this.reason) {
      case 'pending':
        return 'Check the existing receipt before starting another operation.';
      case 'missing':
        return 'No operation to recover';
      case 'mismatch':
        return 'Action mismatch';
    }
  }
}

export class GitActionController {
  readonly key: string;
  private readonly scope: WorktreeScope;
  private readonly connection: WorktreeConnection;
  private readonly operations: OperationStore;
  private readonly client: QueryClient;
  private readonly signal: AbortSignal;
  private readonly id: () => string;
  private readonly action: RunGitActionRequest['input']['action'];

  constructor(
    scope: WorktreeScope,
    action: RunGitActionRequest['input']['action'],
    connection: WorktreeConnection,
    operations: OperationStore,
    client: QueryClient,
    signal: AbortSignal,
    id: () => string,
  ) {
    this.scope = scope;
    this.action = action;
    this.connection = connection;
    this.operations = operations;
    this.client = client;
    this.signal = signal;
    this.id = id;
    this.key = operationKey(scope, action);
  }

  execute(
    input: Pick<RunGitActionRequest, 'input' | 'expected'>,
  ): Effect.Effect<
    Receipt,
    RunFailure | RequestError | ConnectionError | GitOperationStateError
  > {
    return withSignal(
      Effect.gen({ self: this }, function* () {
        yield* currentAnswerEffect(this.signal);
        const previous = this.operations.get(this.key);
        if (previous && (!previous.receipt || !isTerminal(previous.receipt)))
          return yield* Effect.fail(
            new GitOperationStateError({ reason: 'pending' }),
          );
        if (input.input.action !== this.action)
          return yield* Effect.fail(
            new GitOperationStateError({ reason: 'mismatch' }),
          );
        const request = { ...input, requestId: this.id() };
        yield* this.operations.set(this.key, {
          ...this.scope,
          requestId: request.requestId,
          request,
        });
        return yield* this.send(request);
      }),
      this.signal,
    );
  }

  recover(): Effect.Effect<
    Receipt,
    RunFailure | RequestError | ConnectionError | GitOperationStateError
  > {
    return withSignal(
      Effect.gen({ self: this }, function* () {
        yield* currentAnswerEffect(this.signal);
        const current = this.operations.get(this.key);
        if (!current)
          return yield* Effect.fail(
            new GitOperationStateError({ reason: 'missing' }),
          );
        return yield* this.send(current.request);
      }),
      this.signal,
    );
  }

  startNew(): Effect.Effect<boolean, ConnectionError> {
    return Effect.gen({ self: this }, function* () {
      const receipt = this.operations.get(this.key)?.receipt;
      if (!receipt || !isTerminal(receipt)) return false;
      yield* this.operations.set(this.key, null);
      return true;
    });
  }

  private send(
    request: RunGitActionRequest,
  ): Effect.Effect<Receipt, RunFailure | RequestError | ConnectionError> {
    return Effect.gen({ self: this }, function* () {
      const api = gitActionsApi(this.connection);
      const result = yield* api.runGitAction({
        params: { worktreeId: this.scope.worktreeId },
        payload: request,
      });
      if (!('requestId' in result))
        return yield* Effect.fail(
          new RequestError({
            status: result.statusCode,
            message: result.message,
          }),
        );
      yield* currentAnswerEffect(
        this.signal,
        result.projectId === this.scope.projectId &&
          result.worktreeId === this.scope.worktreeId &&
          result.requestId === request.requestId &&
          result.action === this.action,
      );
      yield* this.accept(result);
      return yield* this.operations.wait(this.key, request.requestId);
    });
  }

  private accept(receipt: Receipt): Effect.Effect<Receipt, ConnectionError> {
    return Effect.gen({ self: this }, function* () {
      yield* currentAnswerEffect(
        this.signal,
        receipt.requestId === this.operations.get(this.key)?.requestId,
      );
      yield* refreshGitReceipt(
        this.client,
        this.connection.environmentId,
        receipt,
      );
      yield* currentAnswerEffect(
        this.signal,
        receipt.requestId === this.operations.get(this.key)?.requestId,
      );
      yield* this.operations.accept(receipt);
      return receipt;
    });
  }
}
