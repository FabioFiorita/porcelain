import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, it, onTestFinished } from 'vitest';
import type { ServiceSettings } from '../../cli/arguments.ts';
import { type CommandRunner, runCommand } from './manager.ts';
import { PorcelainService, ServiceDowngradeError } from './service.ts';

type Control = {
  commands: string[];
  enabled: boolean;
  active: boolean;
  linger: boolean;
  allowLinger: boolean;
  failActivation: boolean;
  failDisable: boolean;
  failLaunchdProbe: boolean;
};

async function fixture(version = '1.2.3') {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-service-'));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const home = join(root, 'home');
  const source = join(root, `package-${version}`);
  await mkdir(source, { recursive: true });
  await writeFile(
    join(source, 'package.json'),
    JSON.stringify({ name: '@fabiofiorita/porcelain', version }),
  );
  const control: Control = {
    commands: [],
    enabled: false,
    active: false,
    linger: false,
    allowLinger: true,
    failActivation: false,
    failDisable: false,
    failLaunchdProbe: false,
  };
  const runner: CommandRunner = async (command, args) => {
    control.commands.push(`${command} ${args.join(' ')}`);
    if (command === 'npm') {
      const prefix = args[args.indexOf('--prefix') + 1];
      const packageSource = args.at(-1);
      if (!prefix || !packageSource)
        return { code: 1, stdout: '', stderr: 'bad npm fixture' };
      const manifest = JSON.parse(
        await readFile(join(packageSource, 'package.json'), 'utf8'),
      ) as {
        version: string;
      };
      const target = join(prefix, 'node_modules/@fabiofiorita/porcelain');
      await mkdir(target, { recursive: true });
      await mkdir(join(prefix, 'node_modules/.bin'), { recursive: true });
      await writeFile(
        join(target, 'package.json'),
        JSON.stringify({
          name: '@fabiofiorita/porcelain',
          version: manifest.version,
        }),
      );
      await writeFile(
        join(prefix, 'node_modules/.bin/porcelain'),
        '# fixture\n',
      );
      return { code: 0, stdout: '', stderr: '' };
    }
    if (command === 'loginctl' && args[0] === 'enable-linger') {
      if (control.allowLinger) control.linger = true;
      return { code: control.allowLinger ? 0 : 1, stdout: '', stderr: '' };
    }
    if (command === 'loginctl')
      return {
        code: 0,
        stdout: control.linger ? 'yes\n' : 'no\n',
        stderr: '',
      };
    if (command === 'systemctl' && args.includes('is-enabled'))
      return {
        code: control.enabled ? 0 : 1,
        stdout: control.enabled ? 'enabled\n' : 'disabled\n',
        stderr: '',
      };
    if (command === 'systemctl' && args.includes('is-active'))
      return {
        code: control.active ? 0 : 3,
        stdout: control.active ? 'active\n' : 'inactive\n',
        stderr: '',
      };
    if (command === 'systemctl' && args.includes('enable')) {
      if (control.failActivation) {
        control.failActivation = false;
        return { code: 1, stdout: '', stderr: 'fixture activation failure' };
      }
      control.enabled = true;
      control.active = true;
    }
    if (command === 'systemctl' && args.includes('disable')) {
      if (control.failDisable)
        return { code: 1, stdout: '', stderr: 'fixture disable failure' };
      control.enabled = false;
      control.active = false;
    }
    if (command === 'systemctl' && args.includes('stop'))
      control.active = false;
    if (command === 'systemctl' && args.includes('start'))
      control.active = true;
    if (command === 'launchctl' && args[0] === 'print') {
      if (control.failLaunchdProbe)
        return { code: 1, stdout: '', stderr: 'fixture domain I/O failure' };
      return {
        code: control.active ? 0 : 113,
        stdout: control.active ? 'state = running\n\tpid = 4321\n' : '',
        stderr: control.active ? '' : 'Could not find service',
      };
    }
    if (command === 'launchctl' && args[0] === 'bootstrap')
      control.active = true;
    if (command === 'launchctl' && args[0] === 'bootout')
      control.active = false;
    return { code: 0, stdout: '', stderr: '' };
  };
  const settings: ServiceSettings = {
    action: 'install',
    allowDowngrade: false,
    dataDirectory: join(home, '.porcelain'),
    host: '127.0.0.1',
    port: 3000,
    allowedHosts: [],
  };
  return { root, home, source, version, control, runner, settings };
}

it('installs a stable systemd user runtime and reports service state and logs', async () => {
  const value = await fixture();
  await mkdir(value.settings.dataDirectory, { recursive: true });
  const database = new DatabaseSync(
    join(value.settings.dataDirectory, 'inventory.sqlite'),
  );
  database.exec(
    "CREATE TABLE fixture (value TEXT); INSERT INTO fixture VALUES ('before')",
  );
  database.close();
  const service = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    nodeExecutable: '/opt/node/bin/node',
    healthCheck: async () => true,
  });
  const installed = await service.install(value.settings);
  expect(installed.backup).toBeTruthy();
  const backup = new DatabaseSync(
    join(installed.backup ?? '', 'inventory.sqlite'),
    { readOnly: true },
  );
  expect(backup.prepare('SELECT value FROM fixture').get()).toEqual({
    value: 'before',
  });
  backup.close();
  const unit = await readFile(
    join(value.home, '.config/systemd/user/porcelain.service'),
    'utf8',
  );
  expect(unit).toContain('"/opt/node/bin/node"');
  expect(unit).toContain(
    `${value.home}/.local/share/porcelain/service/runtime/node_modules/@fabiofiorita/porcelain/bin/porcelain.js`,
  );
  expect(unit).toContain(`"--data-directory" "${value.home}/.porcelain"`);
  expect(unit).not.toContain(value.source);
  expect(await service.status()).toMatchObject({
    installed: true,
    version: '1.2.3',
    enabled: true,
    running: true,
    linger: 'enabled',
    stdoutLog: expect.stringContaining('/logs/stdout.log'),
    stderrLog: expect.stringContaining('/logs/stderr.log'),
  });
});

it('prints the exact lingering recovery command without abandoning a usable login service', async () => {
  const value = await fixture();
  value.control.allowLinger = false;
  const service = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  expect(await service.install(value.settings)).toEqual({
    backup: expect.stringContaining('/database-backups/preinstall-'),
    lingerCommand: 'sudo loginctl enable-linger "$(id -un)"',
  });
  expect(value.control.active).toBe(true);
});

it('restores preinstall SQLite when the first service start is unhealthy', async () => {
  const value = await fixture('1.3.0');
  await mkdir(value.settings.dataDirectory, { recursive: true });
  const database = new DatabaseSync(
    join(value.settings.dataDirectory, 'inventory.sqlite'),
  );
  database.exec(
    "CREATE TABLE fixture (value TEXT); INSERT INTO fixture VALUES ('before')",
  );
  database.close();
  const service = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => {
      const migrated = new DatabaseSync(
        join(value.settings.dataDirectory, 'inventory.sqlite'),
      );
      migrated.prepare('UPDATE fixture SET value = ?').run('migrated');
      migrated.close();
      return false;
    },
  });
  await expect(service.install(value.settings)).rejects.toThrow(
    'did not become healthy',
  );
  const restored = new DatabaseSync(
    join(value.settings.dataDirectory, 'inventory.sqlite'),
    { readOnly: true },
  );
  expect(restored.prepare('SELECT value FROM fixture').get()).toEqual({
    value: 'before',
  });
  restored.close();
  expect(await service.status()).toMatchObject({ installed: false });
});

it('keeps the old runtime until health and restores SQLite when the new server is unhealthy', async () => {
  const first = await fixture('2.0.0');
  const initial = new PorcelainService(first.home, {
    platform: 'linux',
    uid: 501,
    runner: first.runner,
    packageRoot: first.source,
    packageVersion: first.version,
    healthCheck: async () => true,
  });
  await initial.install(first.settings);
  await mkdir(first.settings.dataDirectory, { recursive: true });
  const database = new DatabaseSync(
    join(first.settings.dataDirectory, 'inventory.sqlite'),
  );
  database.exec(
    "CREATE TABLE fixture (value TEXT); INSERT INTO fixture VALUES ('before migration')",
  );
  database.close();

  const nextSource = join(first.root, 'package-2.1.0');
  await mkdir(nextSource);
  await writeFile(
    join(nextSource, 'package.json'),
    JSON.stringify({ name: '@fabiofiorita/porcelain', version: '2.1.0' }),
  );
  let healthChecks = 0;
  const update = new PorcelainService(first.home, {
    platform: 'linux',
    uid: 501,
    runner: first.runner,
    packageRoot: nextSource,
    packageVersion: '2.1.0',
    healthCheck: async () => {
      healthChecks++;
      if (healthChecks > 1) return true;
      const migrated = new DatabaseSync(
        join(first.settings.dataDirectory, 'inventory.sqlite'),
      );
      migrated.prepare('UPDATE fixture SET value = ?').run('migrated');
      migrated.close();
      return false;
    },
  });
  await expect(update.update()).rejects.toThrow(
    'previous runtime and database were restored',
  );
  expect(
    JSON.parse(
      await readFile(
        join(
          first.home,
          '.local/share/porcelain/service/runtime/node_modules/@fabiofiorita/porcelain/package.json',
        ),
        'utf8',
      ),
    ),
  ).toMatchObject({ version: '2.0.0' });
  const restored = new DatabaseSync(
    join(first.settings.dataDirectory, 'inventory.sqlite'),
    { readOnly: true },
  );
  expect(restored.prepare('SELECT value FROM fixture').get()).toEqual({
    value: 'before migration',
  });
  restored.close();
  expect(first.control.active).toBe(true);
});

it('refuses downgrades before stopping or backing up and uninstall retains user data', async () => {
  const value = await fixture('3.0.0');
  const installed = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  await installed.install(value.settings);
  await mkdir(value.settings.dataDirectory, { recursive: true });
  await writeFile(
    join(value.settings.dataDirectory, 'inventory.sqlite'),
    'user data',
  );
  const olderSource = join(value.root, 'package-2.9.0');
  await mkdir(olderSource);
  await writeFile(
    join(olderSource, 'package.json'),
    JSON.stringify({ name: '@fabiofiorita/porcelain', version: '2.9.0' }),
  );
  const older = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: olderSource,
    packageVersion: '2.9.0',
    healthCheck: async () => true,
  });
  const before = value.control.commands.length;
  await expect(older.update()).rejects.toBeInstanceOf(ServiceDowngradeError);
  expect(value.control.commands).toHaveLength(before);
  await expect(older.update(true)).resolves.toMatchObject({
    backup: expect.stringContaining('/database-backups/'),
  });
  expect(
    JSON.parse(
      await readFile(
        join(
          value.home,
          '.local/share/porcelain/service/runtime/node_modules/@fabiofiorita/porcelain/package.json',
        ),
        'utf8',
      ),
    ),
  ).toMatchObject({ version: '2.9.0' });
  expect(await installed.uninstall()).toBe(true);
  expect(
    await readFile(
      join(value.settings.dataDirectory, 'inventory.sqlite'),
      'utf8',
    ),
  ).toBe('user data');
  expect(
    await readFile(
      join(value.home, '.local/share/porcelain/service/config.json'),
      'utf8',
    ),
  ).toContain(value.settings.dataDirectory);
});

it('restarts the untouched old runtime when database backup fails', async () => {
  const value = await fixture('5.0.0');
  const installed = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  await installed.install(value.settings);
  const backups = join(
    value.home,
    '.local/share/porcelain/service/database-backups',
  );
  await rm(backups, { recursive: true, force: true });
  await writeFile(backups, 'blocks child backup directories');
  const nextSource = join(value.root, 'package-5.1.0');
  await mkdir(nextSource);
  await writeFile(
    join(nextSource, 'package.json'),
    JSON.stringify({ name: '@fabiofiorita/porcelain', version: '5.1.0' }),
  );
  const update = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: nextSource,
    packageVersion: '5.1.0',
    healthCheck: async () => true,
  });
  await expect(update.update()).rejects.toThrow('update failed');
  expect(value.control.active).toBe(true);
  expect(
    JSON.parse(
      await readFile(
        join(
          value.home,
          '.local/share/porcelain/service/runtime/node_modules/@fabiofiorita/porcelain/package.json',
        ),
        'utf8',
      ),
    ),
  ).toMatchObject({ version: '5.0.0' });
});

it('recovers a runtime stranded by an interrupted update before trying the next update', async () => {
  const value = await fixture('5.2.0');
  const installed = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  const result = await installed.install(value.settings);
  const serviceRoot = join(value.home, '.local/share/porcelain/service');
  value.control.active = false;
  await rename(
    join(serviceRoot, 'runtime'),
    join(serviceRoot, 'runtime.previous'),
  );
  await writeFile(
    join(serviceRoot, 'update.json'),
    JSON.stringify({
      installed: { version: value.version },
      backup: result.backup,
    }),
  );
  const failingRunner: CommandRunner = async (command, args, options) =>
    command === 'npm'
      ? { code: 1, stdout: '', stderr: 'fixture staging failure' }
      : value.runner(command, args, options);
  const retry = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: failingRunner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  await expect(retry.update()).rejects.toThrow('fixture staging failure');
  expect(value.control.active).toBe(true);
  expect(
    JSON.parse(
      await readFile(
        join(
          serviceRoot,
          'runtime/node_modules/@fabiofiorita/porcelain/package.json',
        ),
        'utf8',
      ),
    ),
  ).toMatchObject({ version: '5.2.0' });
  await expect(
    readFile(join(serviceRoot, 'update.json')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});

it('clears interrupted update residue through uninstall and preserves later install data', async () => {
  const value = await fixture('5.3.0');
  const service = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  await service.install(value.settings);
  await mkdir(value.settings.dataDirectory, { recursive: true });
  const databasePath = join(value.settings.dataDirectory, 'inventory.sqlite');
  const database = new DatabaseSync(databasePath);
  database.exec(
    "CREATE TABLE fixture (value TEXT); INSERT INTO fixture VALUES ('before crash')",
  );
  database.close();
  const serviceRoot = join(value.home, '.local/share/porcelain/service');
  const backup = join(serviceRoot, 'database-backups/interrupted');
  await mkdir(backup, { recursive: true });
  await copyFile(databasePath, join(backup, 'inventory.sqlite'));
  value.control.active = false;
  await rename(
    join(serviceRoot, 'runtime'),
    join(serviceRoot, 'runtime.previous'),
  );
  await writeFile(
    join(serviceRoot, 'update.json'),
    JSON.stringify({ installed: { version: value.version }, backup }),
  );

  await expect(service.uninstall()).resolves.toBe(true);
  await service.install(value.settings);
  const afterReinstall = new DatabaseSync(databasePath);
  afterReinstall
    .prepare('INSERT INTO fixture VALUES (?)')
    .run('after reinstall');
  afterReinstall.close();
  await service.update();

  const verified = new DatabaseSync(databasePath, { readOnly: true });
  expect(
    verified.prepare('SELECT value FROM fixture ORDER BY rowid').all(),
  ).toEqual([{ value: 'before crash' }, { value: 'after reinstall' }]);
  verified.close();
});

it('serializes concurrent installs so a loser cannot delete the winner', async () => {
  const value = await fixture('6.0.0');
  let releaseNpm: (() => void) | undefined;
  let reportNpmStarted: (() => void) | undefined;
  const npmStarted = new Promise<void>((resolve) => {
    reportNpmStarted = resolve;
  });
  const npmReleased = new Promise<void>((resolve) => {
    releaseNpm = resolve;
  });
  let delayed = false;
  const runner: CommandRunner = async (command, args, options) => {
    if (command === 'npm' && !delayed) {
      delayed = true;
      reportNpmStarted?.();
      await npmReleased;
    }
    return value.runner(command, args, options);
  };
  const service = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  const winner = service.install(value.settings);
  await npmStarted;
  await expect(service.install(value.settings)).rejects.toThrow(
    'service command is already running',
  );
  releaseNpm?.();
  await expect(winner).resolves.toMatchObject({
    backup: expect.stringContaining('/database-backups/'),
  });
  expect(await service.status()).toMatchObject({
    installed: true,
    version: '6.0.0',
  });
});

it('publishes lock ownership atomically before another command can inspect it', async () => {
  const value = await fixture('6.0.1');
  let releasePublish: (() => void) | undefined;
  let reportCandidateReady: (() => void) | undefined;
  const candidateReady = new Promise<void>((resolve) => {
    reportCandidateReady = resolve;
  });
  const publishReleased = new Promise<void>((resolve) => {
    releasePublish = resolve;
  });
  const paused = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
    beforeLockPublish: async () => {
      reportCandidateReady?.();
      await publishReleased;
    },
  });
  let releaseNpm: (() => void) | undefined;
  let reportNpmStarted: (() => void) | undefined;
  const npmStarted = new Promise<void>((resolve) => {
    reportNpmStarted = resolve;
  });
  const npmReleased = new Promise<void>((resolve) => {
    releaseNpm = resolve;
  });
  const winningRunner: CommandRunner = async (command, args, options) => {
    if (command === 'npm') {
      reportNpmStarted?.();
      await npmReleased;
    }
    return value.runner(command, args, options);
  };
  const winner = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: winningRunner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });

  const contender = paused.install(value.settings);
  await candidateReady;
  const installation = winner.install(value.settings);
  await npmStarted;
  releasePublish?.();
  await expect(contender).rejects.toThrow('service command is already running');
  releaseNpm?.();
  await expect(installation).resolves.toMatchObject({
    backup: expect.stringContaining('/database-backups/'),
  });
});

it('recovers a dead management lock before installing', async () => {
  const value = await fixture('6.1.0');
  const lock = join(
    value.home,
    '.local/share/porcelain/service/management.lock',
  );
  await mkdir(lock, { recursive: true });
  await writeFile(
    join(lock, 'owner.json'),
    JSON.stringify({ pid: 2_147_483_647, createdAt: 1, token: 'dead' }),
  );
  const service = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  await expect(service.install(value.settings)).resolves.toMatchObject({
    backup: expect.stringContaining('/database-backups/'),
  });
});

it('retains the unit, runtime and metadata when systemd cannot disable a running service', async () => {
  const value = await fixture('6.2.0');
  const service = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  await service.install(value.settings);
  value.control.failDisable = true;
  await expect(service.uninstall()).rejects.toThrow('service disable failed');
  expect(value.control.active).toBe(true);
  expect(
    await readFile(
      join(value.home, '.config/systemd/user/porcelain.service'),
      'utf8',
    ),
  ).toContain('ExecStart=');
  expect(
    JSON.parse(
      await readFile(
        join(value.home, '.local/share/porcelain/service/installed.json'),
        'utf8',
      ),
    ),
  ).toEqual({ version: '6.2.0' });
  expect(
    await readFile(
      join(
        value.home,
        '.local/share/porcelain/service/runtime/node_modules/@fabiofiorita/porcelain/package.json',
      ),
      'utf8',
    ),
  ).toContain('6.2.0');
});

it('retains a macOS unit and runtime when launchd cannot determine job state', async () => {
  const value = await fixture('6.3.0');
  const service = new PorcelainService(value.home, {
    platform: 'darwin',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  await service.install(value.settings);
  value.control.failLaunchdProbe = true;
  await expect(service.uninstall()).rejects.toThrow(
    'Could not determine whether',
  );
  expect(
    await readFile(
      join(value.home, 'Library/LaunchAgents/com.fabiofiorita.porcelain.plist'),
      'utf8',
    ),
  ).toContain('ProgramArguments');
  expect(
    await readFile(
      join(
        value.home,
        '.local/share/porcelain/service/runtime/node_modules/@fabiofiorita/porcelain/package.json',
      ),
      'utf8',
    ),
  ).toContain('6.3.0');
});

it('does not touch interrupted update state when launchd status is unavailable', async () => {
  const value = await fixture('6.4.0');
  const service = new PorcelainService(value.home, {
    platform: 'darwin',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  await service.install(value.settings);
  await mkdir(value.settings.dataDirectory, { recursive: true });
  const databasePath = join(value.settings.dataDirectory, 'inventory.sqlite');
  const database = new DatabaseSync(databasePath);
  database.exec(
    "CREATE TABLE fixture (value TEXT); INSERT INTO fixture VALUES ('backup')",
  );
  database.close();
  const serviceRoot = join(value.home, '.local/share/porcelain/service');
  const backup = join(serviceRoot, 'database-backups/interrupted-launchd');
  await mkdir(backup, { recursive: true });
  await copyFile(databasePath, join(backup, 'inventory.sqlite'));
  const changed = new DatabaseSync(databasePath);
  changed.prepare('INSERT INTO fixture VALUES (?)').run('must survive');
  changed.close();
  value.control.active = false;
  await rename(
    join(serviceRoot, 'runtime'),
    join(serviceRoot, 'runtime.previous'),
  );
  await writeFile(
    join(serviceRoot, 'update.json'),
    JSON.stringify({ installed: { version: value.version }, backup }),
  );
  value.control.failLaunchdProbe = true;

  await expect(service.update()).rejects.toThrow('Could not determine whether');
  expect(
    await readFile(
      join(
        serviceRoot,
        'runtime.previous/node_modules/@fabiofiorita/porcelain/package.json',
      ),
      'utf8',
    ),
  ).toContain('6.4.0');
  const verified = new DatabaseSync(databasePath, { readOnly: true });
  expect(
    verified.prepare('SELECT value FROM fixture ORDER BY rowid').all(),
  ).toEqual([{ value: 'backup' }, { value: 'must survive' }]);
  verified.close();
});

it('copies a local invoked package into the persistent runtime instead of linking its source', async () => {
  const value = await fixture('4.0.0');
  await mkdir(join(value.source, 'bin'));
  await writeFile(
    join(value.source, 'bin/porcelain.js'),
    '#!/usr/bin/env node\n',
  );
  await writeFile(
    join(value.source, 'package.json'),
    JSON.stringify({
      name: '@fabiofiorita/porcelain',
      version: value.version,
      bin: { porcelain: 'bin/porcelain.js' },
      files: ['bin'],
    }),
  );
  const runner: CommandRunner = (command, args, options) =>
    command === 'npm'
      ? runCommand(command, args, options)
      : value.runner(command, args, options);
  const service = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  await service.install(value.settings);
  await rm(value.source, { recursive: true, force: true });
  expect(
    await readFile(
      join(
        value.home,
        '.local/share/porcelain/service/runtime/node_modules/@fabiofiorita/porcelain/bin/porcelain.js',
      ),
      'utf8',
    ),
  ).toContain('/usr/bin/env node');
});

it('refuses to overwrite an unrecognized unit or take over a live data directory', async () => {
  const value = await fixture();
  const service = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 501,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  const unit = join(value.home, '.config/systemd/user/porcelain.service');
  await mkdir(join(value.home, '.config/systemd/user'), { recursive: true });
  await writeFile(unit, 'foreign unit');
  await expect(service.install(value.settings)).rejects.toThrow(
    'Refusing to replace the existing service unit',
  );
  expect(value.control.commands).toEqual([]);
  await rm(unit);

  await mkdir(value.settings.dataDirectory, { recursive: true });
  const socket = join(value.settings.dataDirectory, 'server.sock');
  const owner = createServer((request, response) => {
    if (request.url === '/status') {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          address: 'http://127.0.0.1:3000',
          dataDirectory: value.settings.dataDirectory,
          pid: process.pid,
        }),
      );
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve, reject) => {
    owner.once('error', reject);
    owner.listen(socket, resolve);
  });
  onTestFinished(
    () => new Promise<void>((resolve) => owner.close(() => resolve())),
  );
  await expect(service.install(value.settings)).rejects.toThrow(
    'owned by a running Porcelain server',
  );
  expect(value.control.commands).toEqual([]);
});

it('refuses service management as root before touching the host', async () => {
  const value = await fixture();
  const service = new PorcelainService(value.home, {
    platform: 'linux',
    uid: 0,
    runner: value.runner,
    packageRoot: value.source,
    packageVersion: value.version,
    healthCheck: async () => true,
  });
  await expect(service.status()).rejects.toThrow(
    'Refusing to manage Porcelain as root',
  );
  expect(value.control.commands).toEqual([]);
});
