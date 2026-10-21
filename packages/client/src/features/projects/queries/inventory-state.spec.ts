import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { describe, expect, it } from 'vitest';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { workspaceInventory, workspaceReadiness } from './inventory-state.ts';

describe('workspace readiness from the persistence owners', () => {
  const ready = { status: 'ready' as const, error: undefined };
  it('keeps storage failure ahead of selection failure and identifies the retry owner', () => {
    expect(
      workspaceReadiness(
        { status: 'unreadable', error: 'Saved environments were refused.' },
        { status: 'unreadable', error: 'Saved workspace was refused.' },
      ),
    ).toEqual({
      environmentsReady: false,
      selectionReady: false,
      failure: {
        source: 'storage',
        message: 'Saved environments were refused.',
      },
    });
    expect(
      workspaceReadiness(ready, {
        status: 'unreadable',
        error: 'Saved workspace was refused.',
      }),
    ).toEqual({
      environmentsReady: true,
      selectionReady: false,
      failure: { source: 'selection', message: 'Saved workspace was refused.' },
    });
  });
});

const inventory = {
  environmentId: 'laptop',
  environment: { name: 'Laptop', custom: true },
  projects: [],
};

describe('inventory state for a workspace decision', () => {
  it('keeps the last inventory available after a refetch fails, including during retry', () => {
    const error = new ConnectionError({ message: 'The server is offline.' });
    expect(
      workspaceInventory(
        AsyncResult.fail(error, {
          previousSuccess: Option.some(AsyncResult.success(inventory)),
          waiting: true,
        }),
      ),
    ).toEqual({ status: 'ready', inventory });
    expect(
      workspaceInventory(
        AsyncResult.fail(error, {
          previousSuccess: Option.some(AsyncResult.success(inventory)),
        }),
      ),
    ).toEqual({ status: 'ready', inventory });
  });
  it('shows an inventory failure only when no inventory has been read', () => {
    const error = new ConnectionError({ message: 'The server is offline.' });
    expect(workspaceInventory(AsyncResult.fail(error))).toEqual({
      status: 'failed',
      message: 'The server is offline.',
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
