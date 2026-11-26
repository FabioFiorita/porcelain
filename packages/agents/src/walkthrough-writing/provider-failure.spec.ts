import { expect, it } from 'vite-plus/test';
import {
  classifyProviderFailure,
  providerFailure,
} from './provider-failure.ts';

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

const turn = {
  provider: 'claude' as const,
  model: 'claude-opus-5-5',
  stopped: 'The selected agent CLI stopped before finishing the walkthrough.',
};

it.each([
  'TypeError: Cannot read properties of undefined (reading "login")',
  'Error: assigning the session failed',
  'Usage: claude [options] [command]\n  auth login   Sign in to your account',
  'The authentication module crashed while loading plugins',
])('does not call an unrelated crash a sign-out: %s', (detail) => {
  expect(classifyProviderFailure(turn, detail)).toMatchObject({
    kind: 'other',
    message: 'The selected agent CLI stopped before finishing the walkthrough.',
  });
});

it.each([
  'Not logged in',
  'OAuth token expired. Please sign in again',
  'Not logged in. Please run claude auth login.',
  'API Error: 401 Invalid API key · Please run /login',
  'Your session has expired. Please run /login to sign in again.',
  'Login expired · Please run /login',
  '401 authentication_error',
  'not signed in',
  'Codex account has no refresh token; sign in again',
  'ChatGPT account ID not available, please re-run `codex login`',
])('recognises a signed-out CLI: %s', (detail) => {
  expect(classifyProviderFailure(turn, detail).kind).toBe('signed_out');
});

it('names an unavailable model before the generic stop', () => {
  expect(
    classifyProviderFailure(turn, 'model claude-opus-5-5 is not available')
      .message,
  ).toBe(
    'The walkthrough model claude/claude-opus-5-5 is unavailable. Install the CLI and sign in, or choose another model in walkthrough settings.',
  );
});
