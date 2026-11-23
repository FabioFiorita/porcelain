import { describe, expect, it } from 'vite-plus/test';
import { surfaceErrorMessage } from './error-message.ts';

describe('surfaceErrorMessage', () => {
  it('shows the reason a connection error gives', () => {
    const error = new Error('Reopen Porcelain to continue safely.');
    error.name = 'ConnectionError';
    expect(surfaceErrorMessage(error)).toBe(
      'Reopen Porcelain to continue safely.',
    );
  });
});
