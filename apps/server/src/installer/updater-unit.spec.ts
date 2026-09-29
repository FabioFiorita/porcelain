import { describe, expect, it } from 'vitest';
import { updaterUnitArguments } from './updater-unit.ts';

const unit = updaterUnitArguments({
  nodeExecutable: '/usr/bin/node',
  entryPoint: '/home/u/updater/bin/porcelain.js',
  searchPath: '/usr/bin:/bin',
});

describe('updaterUnitArguments', () => {
  it('runs the updated CLI as its own transient unit, outside the service it stops', () => {
    expect(unit.slice(0, 4)).toEqual([
      '--user',
      '--unit=porcelain-update.service',
      '--collect',
      '--quiet',
    ]);
    expect(unit.slice(-4)).toEqual([
      '/usr/bin/node',
      '/home/u/updater/bin/porcelain.js',
      'service',
      'update',
    ]);
  });

  it('repairs the service with the installer recovery whenever the updater stops, never with a plain start', () => {
    expect(unit).toContain(
      '--property=ExecStopPost="/usr/bin/node" "/home/u/updater/bin/porcelain.js" "service" "recover"',
    );
    expect(unit.join(' ')).not.toContain('systemctl');
  });

  it('quotes a path with spaces so systemd keeps it one argument', () => {
    expect(
      updaterUnitArguments({
        nodeExecutable: '/opt/my node/bin/node',
        entryPoint: '/e.js',
        searchPath: '/bin',
      }),
    ).toContain(
      '--property=ExecStopPost="/opt/my node/bin/node" "/e.js" "service" "recover"',
    );
  });

  it('gives the updater the service search path', () => {
    expect(unit).toContain('--setenv=PATH=/usr/bin:/bin');
  });
});
