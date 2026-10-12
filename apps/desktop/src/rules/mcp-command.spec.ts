import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { desktopMcpCommand } from './mcp-command.ts';

describe('desktopMcpCommand', () => {
  it('targets the packaged executable and explicit local server data', () => {
    expect(
      desktopMcpCommand(
        '/Applications/Porcelain.app/Contents/MacOS/Porcelain',
        undefined,
        '/Users/developer/Library/Application Support/Porcelain/server',
      ),
    ).toBe(
      "claude mcp add porcelain -- '/Applications/Porcelain.app/Contents/MacOS/Porcelain' '--porcelain-mcp' '--data-directory' '/Users/developer/Library/Application Support/Porcelain/server'",
    );
  });

  it('passes development paths and shell metacharacters as literal arguments', () => {
    const command = desktopMcpCommand(
      '/tmp/Electron Dev',
      '/tmp/stage/desktop/main.mjs',
      "/tmp/agent's $(printf injected); `printf injected`/server",
    );
    const output = execFileSync(
      '/bin/sh',
      ['-c', `claude() { printf '%s\\n' "$@"; }; ${command}`],
      { encoding: 'utf8' },
    );
    expect(output.split('\n')).toEqual([
      'mcp',
      'add',
      'porcelain',
      '--',
      '/tmp/Electron Dev',
      '/tmp/stage/desktop/main.mjs',
      '--porcelain-mcp',
      '--data-directory',
      "/tmp/agent's $(printf injected); `printf injected`/server",
      '',
    ]);
  });
});
