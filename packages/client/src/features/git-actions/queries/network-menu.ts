import { Atom } from 'effect/reactivity';
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
};
export const networkMenuNotice = Atom.family((_selection: Selection) =>
  Atom.make<MenuNotice | null>(null).pipe(Atom.keepAlive),
);

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
  const result =
    selected && receipt && !running
      ? networkNotice(selected.action, receipt)
      : (fallback?.notice ?? null);
  return {
    selected,
    running,
    result,
    retryAction:
      result?.type === 'error'
        ? (selected?.action ?? fallback?.action)
        : undefined,
  };
}
