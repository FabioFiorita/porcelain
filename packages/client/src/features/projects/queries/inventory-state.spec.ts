import { describe, expect, it } from 'vitest';
import { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { workspaceInventory } from './inventory-state.ts';

const inventory = {
  environmentId: 'laptop',
  environment: { name: 'Laptop', custom: true },
  projects: [],
};

describe('inventory state for a workspace decision', () => {
  it('keeps the first read pending until an inventory exists', () => {
    expect(workspaceInventory(AsyncResult.initial())).toEqual({
      status: 'reading',
    });
    expect(workspaceInventory(AsyncResult.initial(true))).toEqual({
      status: 'reading',
    });
  });
  it('shows failure before retained data, including during retry', () => {
    const error = new ConnectionError({ message: 'The server is offline.' });
    expect(
      workspaceInventory(
        AsyncResult.fail(error, {
          previousSuccess: Option.some(AsyncResult.success(inventory)),
          waiting: true,
        }),
      ),
    ).toEqual({ status: 'failed', message: 'The server is offline.' });
    expect(workspaceInventory(AsyncResult.fail(error))).toEqual({
      status: 'failed',
      message: 'The server is offline.',
    });
  });
  it('preserves the declared inventory failure message', () => {
    expect(
      workspaceInventory(
        AsyncResult.fail(new MissingEnvironmentIdentityError()),
      ),
    ).toEqual({
      status: 'failed',
      message: 'This server has no environment identity.',
    });
  });
  it('keeps a successful inventory ready during background refresh', () => {
    const expected = {
      status: 'ready',
      inventory: {
        environmentId: 'laptop',
        environment: { name: 'Laptop', custom: true },
        projects: [],
      },
    };
    expect(workspaceInventory(AsyncResult.success(inventory))).toEqual(
      expected,
    );
    expect(
      workspaceInventory(AsyncResult.success(inventory, { waiting: true })),
    ).toEqual(expected);
  });
});
