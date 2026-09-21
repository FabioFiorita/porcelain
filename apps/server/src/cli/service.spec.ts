import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, onTestFinished } from 'vitest';
import type { CommandRunner } from '../lifecycle/service/manager.ts';
import { runServiceCommand } from './service.ts';

it('reports enabled, running, linger, unit and log state through the CLI', async () => {
  const home = await mkdtemp(join(tmpdir(), 'porcelain-service-cli-'));
  onTestFinished(() => rm(home, { recursive: true, force: true }));
  const runner: CommandRunner = async (command, args) => {
    if (command === 'systemctl' && args.includes('is-enabled'))
      return { code: 0, stdout: 'enabled\n', stderr: '' };
    if (command === 'systemctl' && args.includes('is-active'))
      return { code: 0, stdout: 'active\n', stderr: '' };
    if (command === 'loginctl') return { code: 0, stdout: 'yes\n', stderr: '' };
    return { code: 0, stdout: '', stderr: '' };
  };
  let output = '';
  await runServiceCommand(
    {
      action: 'status',
      allowDowngrade: false,
      dataDirectory: join(home, '.porcelain'),
      host: '127.0.0.1',
      port: 3000,
      allowedHosts: [],
    },
    {
      homeDirectory: home,
      stdout: (message) => {
        output += message;
      },
      platform: 'linux',
      uid: 501,
      runner,
      packageRoot: '/fixture/package',
      packageVersion: '1.2.3',
    },
  );
  expect(output).toContain('Installed: no');
  expect(output).toContain('Enabled: yes');
  expect(output).toContain('Running: yes');
  expect(output).toContain('Linger: enabled');
  expect(output).toContain('/.config/systemd/user/porcelain.service');
  expect(output).toContain('/logs/stdout.log');
  expect(output).toContain('/logs/stderr.log');
});
