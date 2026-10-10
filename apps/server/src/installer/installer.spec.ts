import { NodeServices } from '@effect/platform-node';
import { Clock, Effect, Layer, Schema } from 'effect';
import {
  execFileSync,
  spawn,
  spawnSync,
  type ChildProcess,
} from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Installer, InstallerOptions } from './installer.ts';

const packageName = '@fabiofiorita/porcelain';
let home: string;
let root: string;
let data: string;
let source: string;
let service: ChildProcess | undefined;
let rejectDownload: boolean;
let rejectCandidate: boolean;
let mutateDatabase: boolean;
let commands: string[];
let searchPath: string;

const runtime = () => join(root, 'runtime');
const manifest = (prefix: string) =>
  join(prefix, 'node_modules', packageName, 'package.json');
const record = (file: string): unknown =>
  JSON.parse(readFileSync(join(root, file), 'utf8'));
const database = () => join(data, 'inventory.sqlite');
const porcelainCommand = () => join(home, '.local/bin/porcelain');
const runPorcelain = (...args: string[]) =>
  execFileSync(porcelainCommand(), args, { encoding: 'utf8' });

function writeRuntime(prefix: string, version: string) {
  const folder = join(prefix, 'node_modules', packageName);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    manifest(prefix),
    JSON.stringify({ name: packageName, version }),
  );
  mkdirSync(join(folder, 'bin'));
  writeFileSync(
    join(folder, 'bin/porcelain.js'),
    "if (process.argv[2] === '--version') console.log(require('../package.json').version);\n",
  );
  mkdirSync(join(folder, 'node_modules/effect'), { recursive: true });
  writeFileSync(join(folder, 'node_modules/effect/package.json'), '{}');
  const watcher = join(prefix, 'node_modules/@parcel/watcher');
  mkdirSync(watcher, { recursive: true });
  writeFileSync(join(watcher, 'index.js'), 'module.exports = {};');
}

async function stopService() {
  const owned = service;
  service = undefined;
  if (
    owned === undefined ||
    owned.exitCode !== null ||
    owned.signalCode !== null
  )
    return;
  await new Promise<void>((resolve) => {
    owned.once('exit', () => resolve());
    owned.kill('SIGTERM');
  });
}

const command = Effect.fn('Test.installerCommand')(
  (executable: string, args: readonly string[]) =>
    Effect.promise(async () => {
      commands.push([executable, ...args].join(' '));
      const ok = (stdout = '') => ({ code: 0, stdout, stderr: '' });
      if (executable === 'npm') {
        if (rejectDownload)
          return { code: 1, stdout: '', stderr: 'npm error offline' };
        const prefix = args[args.indexOf('--prefix') + 1];
        if (prefix === undefined) throw new Error('Missing runtime prefix');
        const candidate = Schema.decodeUnknownSync(
          Schema.fromJsonString(Schema.Struct({ version: Schema.String })),
        )(readFileSync(join(source, 'package.json'), 'utf8'));
        writeRuntime(prefix, String(candidate.version));
        return ok();
      }
      if (executable === process.execPath) {
        const answer = spawnSync(executable, args, { encoding: 'utf8' });
        return {
          code: answer.status ?? 1,
          stdout: answer.stdout,
          stderr: answer.stderr,
        };
      }
      if (executable === 'loginctl') return ok('yes\n');
      if (executable !== 'systemctl')
        throw new Error(`Unexpected ${executable}`);
      if (args.includes('stop') || args.includes('disable')) {
        await stopService();
        return ok();
      }
      if (args.includes('enable') || args.includes('start')) {
        await stopService();
        service = spawn(
          process.execPath,
          ['-e', 'setInterval(() => {}, 1000)'],
          {
            stdio: 'ignore',
          },
        );
        if (
          mutateDatabase &&
          readFileSync(manifest(runtime()), 'utf8').includes('2.0.0')
        )
          writeFileSync(database(), 'candidate changed the database');
        return ok();
      }
      if (args.includes('show')) return ok(`${service?.pid ?? 0}\n`);
      if (args.includes('is-active'))
        return service === undefined
          ? { code: 3, stdout: 'inactive\n', stderr: '' }
          : ok('active\n');
      if (args.includes('is-enabled')) return ok('enabled\n');
      return ok();
    }),
);

const execute = (
  request: Parameters<Installer['Service']['execute']>[0],
  version = '1.0.0',
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const installer = yield* Installer;
      return yield* installer.execute(request);
    }).pipe(
      Effect.provide(
        Installer.layer.pipe(
          Layer.provide(
            Layer.effect(
              InstallerOptions,
              Effect.gen(function* () {
                return {
                  homeDirectory: home,
                  packageRoot: source,
                  packageVersion: version,
                  searchPath,
                  nodeExecutable: process.execPath,
                  uid: 501,
                  runner: command,
                  clock: yield* Clock.Clock,
                  limits: {
                    installer: {
                      command: {
                        timeoutMs: 1000,
                        maxBytes: 4096,
                        processGroup: {
                          lingerMs: 10,
                          cleanupMs: 100,
                          pollMs: 1,
                        },
                      },
                      health: { attempts: 1, intervalMs: 1 },
                    },
                    locks: { startupWaitMs: 0, pollMs: 1, staleTakeovers: 1 },
                    owner: {
                      requestTimeoutMs: 100,
                      probeTimeoutMs: 100,
                      quickProbeTimeoutMs: 100,
                      mcpTimeoutMs: 100,
                      socketPathBytes: 100,
                    },
                  },
                  ownerProbe: {
                    probe: () =>
                      Effect.sync(() => {
                        if (service === undefined)
                          return { kind: 'absent' as const };
                        if (
                          rejectCandidate &&
                          readFileSync(manifest(runtime()), 'utf8').includes(
                            '2.0.0',
                          )
                        )
                          return {
                            kind: 'unreadable' as const,
                            reason: 'candidate cannot start',
                          };
                        return {
                          kind: 'running' as const,
                          status: {
                            address: 'http://127.0.0.1:4737',
                            dataDirectory: data,
                            pid: service.pid ?? 0,
                          },
                        };
                      }),
                  },
                };
              }),
            ),
          ),
        ),
      ),
      Effect.provide(NodeServices.layer),
    ),
  );

const install = () =>
  execute({ action: 'install', settings: { dataDirectory: data, port: 4737 } });
function candidate() {
  mutateDatabase = true;
  writeFileSync(
    join(source, 'package.json'),
    JSON.stringify({ name: packageName, version: '2.0.0' }),
  );
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "porcelain installer's "));
  root = join(home, '.local/share/porcelain/service');
  data = join(home, 'data');
  source = join(home, 'package');
  mkdirSync(data);
  mkdirSync(source);
  writeFileSync(database(), 'database before update');
  writeFileSync(`${database()}-wal`, 'wal before update');
  writeFileSync(`${database()}-shm`, 'shm before update');
  writeFileSync(
    join(source, 'package.json'),
    JSON.stringify({ name: packageName, version: '1.0.0' }),
  );
  rejectDownload = false;
  rejectCandidate = false;
  mutateDatabase = false;
  commands = [];
  searchPath = '/usr/bin';
});

afterEach(async () => {
  await stopService();
  rmSync(home, { recursive: true, force: true });
});

it('installs the runtime, private logs, unit and persistent records and updates only after backing up the database', async () => {
  await install();
  expect(record('installed.json')).toEqual({ version: '1.0.0' });
  expect(record('config.json')).toEqual({ dataDirectory: data, port: 4737 });
  expect(statSync(join(root, 'logs/stdout.log')).mode & 0o777).toBe(0o600);
  expect(statSync(join(root, 'logs/stderr.log')).mode & 0o777).toBe(0o600);
  const unit = readFileSync(
    join(home, '.config/systemd/user/porcelain.service'),
    'utf8',
  );
  expect(unit).toContain(
    `"${join(runtime(), 'node_modules', packageName, 'bin/porcelain.js')}"`,
  );
  expect(unit).toContain(`"--data-directory" "${data}" "--port" "4737"`);
  expect(await execute({ action: 'status' })).toMatchObject({
    action: 'status',
    status: { version: '1.0.0', running: true },
  });
  candidate();
  const updated = await execute(
    { action: 'update', allowDowngrade: false },
    '2.0.0',
  );
  if (updated.action !== 'update') throw new Error('Expected update result');
  expect(
    readFileSync(join(updated.result.backup, 'inventory.sqlite'), 'utf8'),
  ).toBe('database before update');
  expect(
    readFileSync(join(updated.result.backup, 'inventory.sqlite-wal'), 'utf8'),
  ).toBe('wal before update');
  expect(
    readFileSync(join(updated.result.backup, 'inventory.sqlite-shm'), 'utf8'),
  ).toBe('shm before update');
  expect(readFileSync(database(), 'utf8')).toBe(
    'candidate changed the database',
  );
  expect(record('installed.json')).toEqual({ version: '2.0.0' });
  expect(record('update-record.json')).toEqual({
    from: '1.0.0',
    target: '2.0.0',
    stage: 'updated',
  });
  expect(existsSync(join(root, 'update.json'))).toBe(false);
  expect(existsSync(join(root, 'runtime.previous'))).toBe(false);
  expect(existsSync(join(root, 'management.lock'))).toBe(false);
});

it('keeps the same running process and records the reason when downloading an update fails', async () => {
  await install();
  const pid = service?.pid;
  candidate();
  rejectDownload = true;
  await expect(
    execute({ action: 'update', allowDowngrade: false }, '2.0.0'),
  ).rejects.toThrow('npm error offline');
  expect(service?.pid).toBe(pid);
  expect(record('installed.json')).toEqual({ version: '1.0.0' });
  expect(record('update-record.json')).toEqual({
    from: '1.0.0',
    target: '2.0.0',
    stage: 'failed',
    reason: 'Could not install the persistent runtime: npm error offline',
  });
});

it('restores the previous runtime and all database files when the replacement is unhealthy', async () => {
  await install();
  candidate();
  rejectCandidate = true;
  await expect(
    execute({ action: 'update', allowDowngrade: false }, '2.0.0'),
  ).rejects.toThrow('the previous runtime and database were restored');
  expect(record('installed.json')).toEqual({ version: '1.0.0' });
  expect(readFileSync(database(), 'utf8')).toBe('database before update');
  expect(readFileSync(`${database()}-wal`, 'utf8')).toBe('wal before update');
  expect(readFileSync(`${database()}-shm`, 'utf8')).toBe('shm before update');
  expect(record('update-record.json')).toMatchObject({ stage: 'failed' });
  expect(readFileSync(join(root, 'update-record.json'), 'utf8')).toContain(
    'did not become healthy',
  );
  expect(await execute({ action: 'status' })).toMatchObject({
    status: { version: '1.0.0', running: true },
  });
});

it.each(['restore-previous', 'restart-current', 'finish-update'] as const)(
  'recovers the persisted %s plan after interruption',
  async (plan) => {
    await install();
    const saved = oldBackups();
    await stopService();
    const backup = join(root, 'saved-database');
    mkdirSync(backup);
    writeFileSync(join(backup, 'inventory.sqlite'), 'saved database');
    if (plan !== 'restart-current') {
      renameSync(runtime(), join(root, 'runtime.previous'));
      writeRuntime(runtime(), '2.0.0');
      writeFileSync(
        join(root, 'installed.json'),
        JSON.stringify({ version: '2.0.0' }),
      );
    }
    writeFileSync(database(), 'interrupted database');
    writeFileSync(
      join(root, 'update.json'),
      JSON.stringify({
        installed: { version: '1.0.0' },
        backup,
        target: '2.0.0',
        healthy: plan === 'finish-update',
      }),
    );
    expect(await execute({ action: 'recover' })).toMatchObject({
      action: 'recover',
      result: { recovered: true },
    });
    expect(record('installed.json')).toEqual({
      version: plan === 'finish-update' ? '2.0.0' : '1.0.0',
    });
    expect(readFileSync(database(), 'utf8')).toBe(
      plan === 'finish-update' ? 'interrupted database' : 'saved database',
    );
    expect(record('update-record.json')).toMatchObject({
      stage: plan === 'finish-update' ? 'updated' : 'failed',
    });
    expect(service?.pid).toBeGreaterThan(0);
    expect(existsSync(join(root, 'update.json'))).toBe(false);
    expect(existsSync(join(root, 'runtime.previous'))).toBe(false);
    expect(readdirSync(join(root, 'database-backups')).sort()).toEqual(
      plan === 'finish-update' ? saved.slice(1) : saved,
    );
  },
);

it('restarts an interrupted healthy service even when backup retention fails', async () => {
  await install();
  await stopService();
  renameSync(runtime(), join(root, 'runtime.previous'));
  writeRuntime(runtime(), '2.0.0');
  writeFileSync(join(root, 'installed.json'), '{"version":"2.0.0"}');
  writeFileSync(
    join(root, 'update.json'),
    JSON.stringify({
      installed: { version: '1.0.0' },
      target: '2.0.0',
      backup: join(root, 'saved-database'),
      healthy: true,
    }),
  );
  rmSync(join(root, 'database-backups'), { recursive: true });
  writeFileSync(join(root, 'database-backups'), 'not a directory');
  await expect(execute({ action: 'recover' })).rejects.toThrow();
  expect(service?.pid ?? 0).toBeGreaterThan(0);
  expect(record('installed.json')).toEqual({ version: '2.0.0' });
  expect(existsSync(join(root, 'update.json'))).toBe(false);
  expect(readFileSync(join(root, 'database-backups'), 'utf8')).toBe(
    'not a directory',
  );
});

it('discards an obsolete previous runtime and uninstalls while retaining user data', async () => {
  await install();
  writeRuntime(join(root, 'runtime.previous'), '0.9.0');
  expect(await execute({ action: 'recover' })).toMatchObject({
    result: { recovered: false },
  });
  expect(existsSync(join(root, 'runtime.previous'))).toBe(false);
  expect(await execute({ action: 'uninstall' })).toEqual({
    action: 'uninstall',
    removed: true,
  });
  expect(service).toBeUndefined();
  expect(existsSync(join(root, 'installed.json'))).toBe(false);
  expect(readFileSync(database(), 'utf8')).toBe('database before update');
  expect(
    commands.some((entry) => entry.includes('disable --now porcelain.service')),
  ).toBe(true);
});

it('refuses recovery without either runtime and retains the journal and backup', async () => {
  await install();
  await stopService();
  rmSync(runtime(), { recursive: true });
  const backup = join(root, 'saved-database');
  mkdirSync(backup);
  writeFileSync(join(backup, 'inventory.sqlite'), 'saved database');
  writeFileSync(
    join(root, 'update.json'),
    JSON.stringify({
      installed: { version: '1.0.0' },
      backup,
      target: '2.0.0',
    }),
  );
  await expect(execute({ action: 'recover' })).rejects.toThrow(
    'neither the installed nor previous runtime',
  );
  expect(existsSync(join(root, 'update.json'))).toBe(true);
  expect(readFileSync(join(backup, 'inventory.sqlite'), 'utf8')).toBe(
    'saved database',
  );
  expect(service).toBeUndefined();
});

it('puts a porcelain command in ~/.local/bin that runs the installed version, adds it on update to a service installed without one and removes it on uninstall', async () => {
  expect(await install()).toMatchObject({
    action: 'install',
    result: {
      command: {
        kind: 'written',
        path: porcelainCommand(),
        onSearchPath: false,
      },
    },
  });
  expect(statSync(porcelainCommand()).mode & 0o100).toBe(0o100);
  expect(runPorcelain('--version')).toBe('1.0.0\n');
  rmSync(porcelainCommand());
  candidate();
  searchPath = `/usr/bin:${dirname(porcelainCommand())}/`;
  const updated = await execute(
    { action: 'update', allowDowngrade: false },
    '2.0.0',
  );
  if (updated.action !== 'update') throw new Error('Expected update result');
  expect(updated.result).toEqual({
    backup: updated.result.backup,
    command: { kind: 'written', path: porcelainCommand(), onSearchPath: true },
  });
  expect(runPorcelain('--version')).toBe('2.0.0\n');
  await execute({ action: 'uninstall' });
  expect(existsSync(porcelainCommand())).toBe(false);
});

it('leaves a porcelain command it did not write untouched through install, update and uninstall', async () => {
  const foreign = '#!/bin/sh\necho another porcelain\n';
  mkdirSync(dirname(porcelainCommand()), { recursive: true });
  writeFileSync(porcelainCommand(), foreign, { mode: 0o755 });
  const refused = { kind: 'foreign', path: porcelainCommand() };
  expect(await install()).toMatchObject({
    result: { command: refused },
  });
  candidate();
  expect(
    await execute({ action: 'update', allowDowngrade: false }, '2.0.0'),
  ).toMatchObject({ result: { command: refused } });
  await execute({ action: 'uninstall' });
  expect(readFileSync(porcelainCommand(), 'utf8')).toBe(foreign);
});

function oldBackups() {
  rmSync(join(root, 'database-backups'), { recursive: true, force: true });
  const directories = [1, 2, 3, 4].map(
    (day) => `2020-01-0${day}T00-00-00.000Z-1.0.0-id`,
  );
  for (const directory of directories) {
    const path = join(root, 'database-backups', directory);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'inventory.sqlite'), directory);
  }
  return directories;
}

it('prunes older database backups only after the updated service is healthy', async () => {
  await install();
  const saved = oldBackups();
  candidate();
  const outcome = await execute(
    { action: 'update', allowDowngrade: false },
    '2.0.0',
  );
  if (outcome.action !== 'update') throw new Error('Expected update');
  expect(readdirSync(join(root, 'database-backups')).sort()).toEqual([
    ...saved.slice(2),
    outcome.result.backup.split('/').at(-1),
  ]);
  expect(
    readFileSync(join(outcome.result.backup, 'inventory.sqlite'), 'utf8'),
  ).toBe('database before update');
});

it('retains every backup when an update must roll back', async () => {
  await install();
  const saved = oldBackups();
  candidate();
  rejectCandidate = true;
  await expect(
    execute({ action: 'update', allowDowngrade: false }, '2.0.0'),
  ).rejects.toThrow('did not become healthy');
  expect(
    saved.map((directory) =>
      readFileSync(
        join(root, 'database-backups', directory, 'inventory.sqlite'),
        'utf8',
      ),
    ),
  ).toEqual(saved);
  expect(readdirSync(join(root, 'database-backups'))).toHaveLength(5);
});

it('refuses an exact-version downgrade unless explicitly allowed', async () => {
  await install();
  writeFileSync(
    join(source, 'package.json'),
    JSON.stringify({ name: packageName, version: '0.9.0' }),
  );
  await expect(
    execute({ action: 'update', allowDowngrade: false }, '0.9.0'),
  ).rejects.toThrow('downgrade');
  expect(record('installed.json')).toEqual({ version: '1.0.0' });
  expect(
    await execute({ action: 'update', allowDowngrade: true }, '0.9.0'),
  ).toMatchObject({ action: 'update' });
  expect(record('installed.json')).toEqual({ version: '0.9.0' });
});
