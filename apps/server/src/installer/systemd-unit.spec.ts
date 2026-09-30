import { describe, expect, it } from 'vitest';
import { renderSystemdUnit } from './systemd-unit.ts';

const unit = renderSystemdUnit({
  nodeExecutable: '/usr/bin/node',
  entryPoint: '/home/u/.local/share/porcelain/runtime/bin/porcelain.js',
  dataDirectory: '/home/u/.porcelain',
  port: 4738,
  stdoutLog: '/home/u/.local/state/porcelain/stdout.log',
  stderrLog: '/home/u/.local/state/porcelain/stderr.log',
  searchPath: '/usr/bin:/bin',
});

function execStart(text: string): string | undefined {
  return text
    .split('\n')
    .find((line) => line.startsWith('ExecStart='))
    ?.slice('ExecStart='.length);
}

describe('renderSystemdUnit', () => {
  it('serves the data directory on the chosen port and names no listen host, so the service listens on this computer only and reaches the network through Sharing', () => {
    expect(execStart(unit)).toBe(
      '"/usr/bin/node" "/home/u/.local/share/porcelain/runtime/bin/porcelain.js" "serve" "--data-directory" "/home/u/.porcelain" "--port" "4738"',
    );
  });
});
