import { expect, it } from 'vitest';
import { claudeEnvironment } from './claude-environment.ts';

it('uses the normal macOS home and Keychain identity without inventing a config override', () => {
  const environment = claudeEnvironment(
    { HOME: '/temporary/writer', ZDOTDIR: '/temporary/writer' },
    'darwin',
    '/users/developer',
  );
  expect(environment).not.toHaveProperty('CLAUDE_CONFIG_DIR');
  expect(environment.HOME).toBe('/users/developer');
  expect(environment.ZDOTDIR).toBe('/temporary/writer');
});

it('keeps the isolated Linux home while finding the real credentials directory', () => {
  const environment = claudeEnvironment(
    { HOME: '/temporary/writer' },
    'linux',
    '/users/developer',
  );
  expect(environment.HOME).toBe('/temporary/writer');
  expect(environment.CLAUDE_CONFIG_DIR).toBe('/users/developer/.claude');
});

it.each(['darwin', 'linux'] as const)(
  'preserves explicit CLI directories on %s',
  (platform) => {
    const environment = claudeEnvironment(
      {
        HOME: '/temporary/writer',
        CLAUDE_CONFIG_DIR: '/selected/claude',
        CODEX_HOME: '/selected/codex',
      },
      platform,
      '/users/developer',
    );
    expect(environment.CLAUDE_CONFIG_DIR).toBe('/selected/claude');
    expect(environment.CODEX_HOME).toBe('/selected/codex');
  },
);
