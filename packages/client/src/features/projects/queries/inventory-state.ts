import { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Cause } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { connectionErrorMessage } from '../../access/rules/connection-error-message.ts';
import type { Inventory } from '../rules/inventory.ts';
import type { WorkspaceInventory } from '../rules/workspace-selection.ts';

export function workspaceInventory(
  result: AsyncResult.AsyncResult<Inventory, unknown>,
): WorkspaceInventory {
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
  if (AsyncResult.isSuccess(result))
    return { status: 'ready', inventory: result.value };
  return { status: 'reading' };
}
