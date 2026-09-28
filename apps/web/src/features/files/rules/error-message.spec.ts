import { describe, expect, it } from 'vitest';
import { surfaceErrorMessage } from './error-message.ts';

describe('surfaceErrorMessage', () => {
  it('shows the reason a connection error gives', () => {
    const error = new Error('Reopen Porcelain to continue safely.');
    error.name = 'ConnectionError';
    expect(surfaceErrorMessage(error)).toBe(
      'Reopen Porcelain to continue safely.',
    );
  });

  it('asks to try again after any other failure', () => {
    expect([
      surfaceErrorMessage(new Error('boom')),
      surfaceErrorMessage('x'),
    ]).toEqual([
      'This review surface could not be loaded. Try again.',
      'This review surface could not be loaded. Try again.',
    ]);
  });
});
