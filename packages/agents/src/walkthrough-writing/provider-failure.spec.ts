import { expect, it } from 'vitest';
import { providerFailure } from './provider-failure.ts';

it('keeps invalid schemas distinct from sign-in and discards provider text', () => {
  const error = providerFailure(
    'codex',
    'invalid_request_error invalid_json_schema authentication prompt SECRET file contents',
  );
  expect(error.kind).toBe('other');
  expect(error.message).toBe(
    'Codex rejected the request: invalid output format.',
  );
});

it('bounds unknown provider failures without exposing tokens or output', () => {
  expect(providerFailure('codex', 'secret '.repeat(10000)).message).toBe(
    'Codex stopped before completing the request.',
  );
});

it('preserves the turn-specific retry guidance for an unknown local failure', () => {
  expect(
    providerFailure(
      'claude',
      'local failure',
      'The selected agent CLI stopped before answering. Ask again.',
    ).message,
  ).toBe('The selected agent CLI stopped before answering. Ask again.');
});
