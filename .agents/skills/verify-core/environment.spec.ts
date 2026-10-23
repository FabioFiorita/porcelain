import { expect, it } from 'vitest';
import { verificationEnvironment } from './environment.ts';

it.each(['none', '', '/tmp/fixture bin'])(
  'removes provider credentials and configuration with coding directory %j',
  (directory) => {
    const inherited = {
      PATH: '/usr/bin:/host/tools',
      HOME: '/host/home',
      ANTHROPIC_API_KEY: 'synthetic',
      ANTHROPIC_BASE_URL: 'synthetic',
      OPENAI_API_KEY: 'synthetic',
      OPENAI_BASE_URL: 'synthetic',
      CODEX_HOME: '/host/config',
      CODEX_API_KEY: 'synthetic',
      CLAUDE_CONFIG_DIR: '/host/config',
      CLAUDE_CODE_OAUTH_TOKEN: 'synthetic',
      claude_custom: 'synthetic',
      PORCELAIN_CODING_TOOL_DIRECTORY: '/host/tools',
    };
    expect(verificationEnvironment(inherited, directory)).toEqual({
      PATH: '/usr/bin:/host/tools',
      HOME: '/host/home',
      PORCELAIN_CODING_TOOL_DIRECTORY: directory || 'none',
    });
  },
);

it('disables coding tools by default without mutating the inherited environment', () => {
  const inherited = {
    CODEX_HOME: '/host/config',
    PORCELAIN_CODING_TOOL_DIRECTORY: '/host/tools',
  };
  expect(verificationEnvironment(inherited)).toEqual({
    PORCELAIN_CODING_TOOL_DIRECTORY: 'none',
  });
  expect(inherited).toEqual({
    CODEX_HOME: '/host/config',
    PORCELAIN_CODING_TOOL_DIRECTORY: '/host/tools',
  });
});
