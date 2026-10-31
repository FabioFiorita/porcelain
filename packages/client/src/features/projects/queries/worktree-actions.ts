import { Atom } from 'effect/reactivity';
import {
  isTerminal,
  operationKey,
} from '../../git-actions/store/operations.ts';
import type { GitConnection } from '../../git-actions/ports/git-connection.ts';
import type { WorktreeScope } from '../../../shared/api/connection.ts';

export const readWorktreeBranchSwitch = Atom.family(
  ({
    connection,
    scope,
  }: {
    connection: GitConnection;
    scope: WorktreeScope;
  }) =>
    connection.operations.state.map(({ operations }) => {
      const operation = operations.get(operationKey(scope, 'switch'));
      return {
        unresolved: Boolean(
          operation && (!operation.receipt || !isTerminal(operation.receipt)),
        ),
      };
    }),
);
