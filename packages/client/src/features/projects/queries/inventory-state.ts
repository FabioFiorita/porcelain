import { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { connectionErrorMessage } from '../../access/rules/connection-error-message.ts';
import type { Inventory } from '../rules/inventory.ts';
import type { WorkspaceInventory } from '../rules/workspace-selection.ts';

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
