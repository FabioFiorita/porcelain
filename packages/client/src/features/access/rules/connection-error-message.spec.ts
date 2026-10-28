import { describe, expect, it } from 'vitest';
import { connectionErrorMessage } from './connection-error-message.ts';

describe('connectionErrorMessage', () => {
  it('shows the server reason for a refused request', () => {
    expect(
      connectionErrorMessage(
        Object.assign(new Error('Project has moved.'), {
          name: 'RequestError',
        }),
      ),
    ).toBe('Project has moved.');
  });

  it('shows the connection reason when the server cannot be reached', () => {
    expect(
      connectionErrorMessage(
        Object.assign(new Error('Could not reach Porcelain.'), {
          name: 'ConnectionError',
        }),
      ),
    ).toBe('Could not reach Porcelain.');
  });

  it('shows the reason of an error the server contract declares', () => {
    expect(
      connectionErrorMessage(
        Object.assign(new Error('The ways in changed since you last looked.'), {
          name: 'WaysInChangedError',
          _tag: 'WaysInChangedError',
        }),
      ),
    ).toBe('The ways in changed since you last looked.');
  });

  it('hides unexpected errors and non-errors behind a stable message', () => {
    expect(connectionErrorMessage(new Error('parser detail'))).toBe(
      'Could not connect to the environment. Try again.',
    );
    expect(connectionErrorMessage('unexpected')).toBe(
      'Could not connect to the environment. Try again.',
    );
  });
});
