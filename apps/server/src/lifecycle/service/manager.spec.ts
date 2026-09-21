import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, onTestFinished } from 'vitest';
import { type CommandRunner, launchdLabel, serviceManager } from './manager.ts';

it('quotes every systemd argument and encodes directive-breaking characters', async () => {
  const home = await mkdtemp(join(tmpdir(), 'porcelain-systemd-'));
  onTestFinished(() => rm(home, { recursive: true, force: true }));
  const runner: CommandRunner = async () => ({
    code: 0,
    stdout: '',
    stderr: '',
  });
  const manager = serviceManager({
    platform: 'linux',
    homeDirectory: home,
    uid: 501,
    runner,
  });
  await manager.write({
    nodeExecutable: '/opt/Node 100%/node',
    entryPoint: '/runtime/porcelain.js',
    dataDirectory: '/data\nEnvironment=INJECTED',
    host: '127.0.0.1',
    port: 3000,
    allowedHosts: [],
    stdoutLog: '/logs/porcelain output.log',
    stderrLog: '/logs/porcelain error.log',
    environmentPath: '/usr/local/bin:/usr/bin',
  });
  const unit = await readFile(manager.unitPath, 'utf8');
  expect(unit).toContain('"/opt/Node 100%%/node"');
  expect(unit).toContain('"/data\\x0aEnvironment=INJECTED"');
  expect(unit).not.toContain('\nEnvironment=INJECTED');
  expect(unit).toContain('append:/logs/porcelain\\x20output.log');
  expect(unit).toContain('Environment="PATH=/usr/local/bin:/usr/bin"');
});

it('writes and controls a per-login macOS LaunchAgent', async () => {
  const home = await mkdtemp(join(tmpdir(), 'porcelain-launchd-'));
  onTestFinished(() => rm(home, { recursive: true, force: true }));
  const commands: string[] = [];
  const runner: CommandRunner = async (command, args) => {
    commands.push(`${command} ${args.join(' ')}`);
    return {
      code: 0,
      stdout:
        command === 'launchctl' && args[0] === 'print'
          ? 'state = running\n\tpid = 4321\n'
          : '',
      stderr: '',
    };
  };
  const manager = serviceManager({
    platform: 'darwin',
    homeDirectory: home,
    uid: 501,
    runner,
  });
  await manager.write({
    nodeExecutable: '/opt/node/bin/node',
    entryPoint: '/stable runtime/porcelain.js',
    dataDirectory: '/user data',
    host: '127.0.0.1',
    port: 3000,
    allowedHosts: ['porcelain.example.test'],
    stdoutLog: '/logs/out',
    stderrLog: '/logs/error',
    environmentPath: '/opt/homebrew/bin:/usr/bin',
  });
  await manager.enableAndStart();
  const plist = await readFile(manager.unitPath, 'utf8');
  expect(plist).toContain('<string>/opt/node/bin/node</string>');
  expect(plist).toContain('<string>/stable runtime/porcelain.js</string>');
  expect(plist).toContain('<key>RunAtLoad</key><true/>');
  expect(plist).toContain(
    '<key>PATH</key><string>/opt/homebrew/bin:/usr/bin</string>',
  );
  expect(commands).toContain(
    `launchctl bootstrap gui/501 ${home}/Library/LaunchAgents/${launchdLabel}.plist`,
  );
  expect(await manager.probe()).toEqual({
    enabled: true,
    running: true,
    linger: 'not-applicable',
  });
  expect(await manager.processId()).toBe(4321);
});

it('keeps a macOS unit when launchd cannot stop its running job', async () => {
  const home = await mkdtemp(join(tmpdir(), 'porcelain-launchd-stop-'));
  onTestFinished(() => rm(home, { recursive: true, force: true }));
  const runner: CommandRunner = async (command, args) => ({
    code: command === 'launchctl' && args[0] === 'bootout' ? 1 : 0,
    stdout:
      command === 'launchctl' && args[0] === 'print'
        ? 'state = running\n\tpid = 4321\n'
        : '',
    stderr:
      command === 'launchctl' && args[0] === 'bootout'
        ? 'fixture stop failure'
        : '',
  });
  const manager = serviceManager({
    platform: 'darwin',
    homeDirectory: home,
    uid: 501,
    runner,
  });
  await manager.write({
    nodeExecutable: '/usr/local/bin/node',
    entryPoint: '/runtime/porcelain.js',
    dataDirectory: '/data',
    host: '127.0.0.1',
    port: 3000,
    allowedHosts: [],
    stdoutLog: '/logs/out',
    stderrLog: '/logs/error',
    environmentPath: '/usr/local/bin:/usr/bin',
  });
  await expect(manager.uninstall()).rejects.toThrow('launch agent stop failed');
  expect(await readFile(manager.unitPath, 'utf8')).toContain(launchdLabel);
});

it('keeps a macOS unit when launchd cannot determine whether its job exists', async () => {
  const home = await mkdtemp(join(tmpdir(), 'porcelain-launchd-probe-'));
  onTestFinished(() => rm(home, { recursive: true, force: true }));
  const runner: CommandRunner = async (command, args) => ({
    code: command === 'launchctl' && args[0] === 'print' ? 1 : 0,
    stdout: '',
    stderr:
      command === 'launchctl' && args[0] === 'print'
        ? 'I/O error contacting launchd domain'
        : '',
  });
  const manager = serviceManager({
    platform: 'darwin',
    homeDirectory: home,
    uid: 501,
    runner,
  });
  await manager.write({
    nodeExecutable: '/usr/local/bin/node',
    entryPoint: '/runtime/porcelain.js',
    dataDirectory: '/data',
    host: '127.0.0.1',
    port: 3000,
    allowedHosts: [],
    stdoutLog: '/logs/out',
    stderrLog: '/logs/error',
    environmentPath: '/usr/local/bin:/usr/bin',
  });
  await expect(manager.uninstall()).rejects.toThrow(
    'Could not determine whether',
  );
  expect(await readFile(manager.unitPath, 'utf8')).toContain(launchdLabel);
});
