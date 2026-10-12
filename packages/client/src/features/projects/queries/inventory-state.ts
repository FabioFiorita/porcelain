import { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { connectionErrorMessage } from '../../access/rules/connection-error-message.ts';
import type { Inventory } from '../rules/inventory.ts';
import type {
  WorkspaceInventory,
  WorkspaceReadiness,
} from '../rules/workspace-selection.ts';
import type { PersistedReadState } from '../../persistence/rules/read-state.ts';

export function workspaceReadiness(
  storage: PersistedReadState,
  selection: PersistedReadState,
): WorkspaceReadiness {
  const readiness = {
    environmentsReady: storage.status === 'ready',
    selectionReady: selection.status === 'ready',
  };
  if (storage.status === 'unreadable')
    return {
      ...readiness,
      failure: {
        source: 'storage',
        message: storage.error ?? 'Saved environments could not be read.',
      },
    };
  if (selection.status === 'unreadable')
    return {
      ...readiness,
      failure: {
        source: 'selection',
        message:
          selection.error ?? 'Saved workspace selections could not be read.',
      },
    };
  return { ...readiness, failure: undefined };
}

export function workspaceInventory(
  result: AsyncResult.AsyncResult<Inventory, unknown>,
): WorkspaceInventory {
  const inventory = AsyncResult.value(result);
  if (Option.isSome(inventory))
    return { status: 'ready', inventory: inventory.value };
  if (AsyncResult.isFailure(result)) {
    const error = Cause.squash(result.cause);
    return {
      status: 'failed',
      message:
        error instanceof MissingEnvironmentIdentityError
          ? error.message
          : connectionErrorMessage(error),
    };
  }
  return { status: 'reading' };
}
