import { Context, type Effect } from 'effect';
import type { AtomRef } from 'effect/reactivity';
import type {
  RunGitActionRequest,
  RunGitActionResponse,
} from '@porcelain/contracts/git-actions';
import type { ConnectionError } from '../../../shared/api/connection-error.ts';

export type Receipt = RunGitActionResponse;
export type Operation = {
  readonly requestId: string;
  readonly projectId: string;
  readonly worktreeId: string;
  readonly request: RunGitActionRequest;
  readonly receipt?: Receipt;
};
export type OperationState = {
  readonly operations: ReadonlyMap<string, Operation>;
  readonly closed: boolean;
  readonly restorationError: ConnectionError | undefined;
};
export class OperationStore extends Context.Service<
  OperationStore,
  {
    readonly state: AtomRef.ReadonlyRef<OperationState>;
    readonly set: (
      key: string,
      operation: Operation | null,
    ) => Effect.Effect<void, ConnectionError>;
    readonly accept: (
      receipt: Receipt,
    ) => Effect.Effect<boolean, ConnectionError>;
    readonly wait: (
      key: string,
      requestId: string,
    ) => Effect.Effect<Receipt, ConnectionError>;
  }
>()('@porcelain/client/OperationStore') {}
