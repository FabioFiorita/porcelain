import { Atom, type AtomRef } from 'effect/reactivity';
import type { RunGitActionRequest } from '@porcelain/contracts/git-actions';
import type { GitConnection } from '../ports/git-connection.ts';
import type { Operation, OperationState } from '../ports/operation-store.ts';
import type { GitScope } from '../rules/git-action.ts';
import type { GitNotice } from '../rules/feedback.ts';
import { networkNotice } from '../rules/network.ts';
import { isTerminal, operationKey } from '../store/operations.ts';

type Selection = { connection: GitConnection; scope: GitScope };
type MenuNotice = {
  action: 'fetch' | 'pull';
  notice: GitNotice;
  operation: Operation | undefined;
  unrecorded?: boolean;
};
export const networkMenuNotice = Atom.family((_selection: Selection) =>
  Atom.make<MenuNotice | null>(null).pipe(Atom.keepAlive),
);

export type NetworkMenuAttempt = {
  action: 'fetch' | 'pull';
  previous: Operation | undefined;
  request?: RunGitActionRequest;
};

export function networkMenuAttemptNotice(
  state: OperationState,
  scope: GitScope,
  attempt: NetworkMenuAttempt,
  notice: GitNotice,
): MenuNotice | undefined {
  const selected = networkMenuFeedback(state, scope).selected?.operation;
  if (attempt.request) {
    const operation = state.operations.get(operationKey(scope, attempt.action));
    return operation?.requestId === attempt.request.requestId &&
      selected?.requestId === attempt.request.requestId
      ? { action: attempt.action, notice, operation }
      : undefined;
  }
  return selected?.requestId === attempt.previous?.requestId
    ? { action: attempt.action, notice, operation: selected, unrecorded: true }
    : undefined;
}

export function networkMenuFeedback(
  state: OperationState,
  scope: GitScope,
  notice?: MenuNotice | null,
) {
  const candidates = (['fetch', 'pull'] as const).flatMap((action) => {
    const operation = state.operations.get(operationKey(scope, action));
    return operation ? [{ action, operation }] : [];
  });
  const pending = candidates.filter(
    ({ operation }) => !operation.receipt || !isTerminal(operation.receipt),
  );
  const selected = (pending.length ? pending : candidates).sort((left, right) =>
    (right.operation.receipt?.acceptedAt ?? '').localeCompare(
      left.operation.receipt?.acceptedAt ?? '',
    ),
  )[0];
  const receipt = selected?.operation.receipt;
  const running =
    selected && (!receipt || !isTerminal(receipt)) ? selected : undefined;
  const fallback =
    notice?.notice.type === 'error' &&
    notice.operation?.requestId === selected?.operation.requestId
      ? notice
      : undefined;
  const result = fallback?.unrecorded
    ? fallback.notice
    : selected && receipt && !running
      ? networkNotice(selected.action, receipt)
      : (fallback?.notice ?? null);
  return {
    selected,
    running,
    result,
    retryAction:
      result?.type === 'error'
        ? fallback?.unrecorded
          ? fallback.action
          : (selected?.action ?? fallback?.action)
        : undefined,
  };
}

const succeeded = (receipt: Operation['receipt']) =>
  receipt?.state === 'succeeded' || receipt?.state === 'no-change';

export function networkSuccesses(
  previous: OperationState,
  next: OperationState,
): { action: 'fetch' | 'pull'; requestId: string }[] {
  return [...next.operations].flatMap(([key, now]) => {
    const action = now.request.input.action;
    if (action !== 'fetch' && action !== 'pull') return [];
    const before = previous.operations.get(key);
    return succeeded(now.receipt) &&
      before?.requestId === now.requestId &&
      !(before.receipt && isTerminal(before.receipt))
      ? [{ action, requestId: now.requestId }]
      : [];
  });
}

type WatchedOperations = {
  readonly operations: { readonly state: AtomRef.ReadonlyRef<OperationState> };
};

type WatchedConnections = {
  readonly value: readonly WatchedOperations[];
  readonly subscribe: (changed: () => void) => () => void;
};

export function watchNetworkSuccesses(
  connections: WatchedConnections,
  announce: (action: 'fetch' | 'pull') => void,
) {
  const announced = new Set<string>();
  const watched = new Map<WatchedOperations, () => void>();
  const watch = () => {
    const current = connections.value;
    for (const [connection, stop] of watched)
      if (!current.includes(connection)) {
        stop();
        watched.delete(connection);
      }
    for (const connection of current) {
      if (watched.has(connection)) continue;
      let previous = connection.operations.state.value;
      watched.set(
        connection,
        connection.operations.state.subscribe(() => {
          const next = connection.operations.state.value;
          for (const { action, requestId } of networkSuccesses(previous, next))
            if (!announced.has(requestId)) {
              announced.add(requestId);
              announce(action);
            }
          previous = next;
        }),
      );
    }
  };
  watch();
  const stopConnections = connections.subscribe(watch);
  return () => {
    stopConnections();
    for (const stop of watched.values()) stop();
  };
}
