import { ServiceUpdateRunningError } from '@porcelain/access/errors';
import { NodeServices } from '@effect/platform-node';
import { Clock, Effect, FileSystem, Layer, Schema } from 'effect';
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
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { OwnerProbe } from '../ports/owner-probe.ts';
import { acquireDirectoryLock } from '../runtime/directory-lock.ts';
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
let rejectRetention: boolean;
let rejectStart: boolean;
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

function writeDatabase(file: string, value: string) {
  for (const suffix of ['', '-wal', '-shm'])
    rmSync(`${file}${suffix}`, { force: true });
  const db = new DatabaseSync(file);
  try {
    db.exec(
      "CREATE TABLE saved(value TEXT); CREATE TABLE porcelain_migrations(migration_id INTEGER PRIMARY KEY, name TEXT NOT NULL); INSERT INTO porcelain_migrations VALUES (1, 'adopt_legacy_schema')",
    );
    db.prepare('INSERT INTO saved VALUES (?)').run(value);
  } finally {
    db.close();
  }
}

function readDatabase(file: string) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare('SELECT value FROM saved').get()?.value;
  } finally {
    db.close();
  }
}

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
        if (rejectStart)
          return { code: 1, stdout: '', stderr: 'service startup failed' };
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
          writeDatabase(database(), 'candidate changed the database');
        if (
          rejectRetention &&
          readFileSync(manifest(runtime()), 'utf8').includes('2.0.0')
        ) {
          rmSync(join(root, 'database-backups'), { recursive: true });
          writeFileSync(join(root, 'database-backups'), 'not a directory');
        }
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
  packageRoot = source,
  fileSystem?: FileSystem.FileSystem,
  probe?: OwnerProbe['probe'],
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
                  packageRoot,
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
                      health: { attempts: 3, intervalMs: 1 },
                    },
                    locks: { startupWaitMs: 25, pollMs: 1, staleTakeovers: 1 },
                    owner: {
                      requestTimeoutMs: 100,
                      probeTimeoutMs: 100,
                      quickProbeTimeoutMs: 100,
                      mcpTimeoutMs: 100,
                      socketPathBytes: 100,
                    },
                  },
                  ownerProbe: {
                    probe:
                      probe ??
                      (() =>
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
                        })),
                  },
                };
              }),
            ),
          ),
          Layer.provide(
            fileSystem === undefined
              ? Layer.empty
              : Layer.succeed(FileSystem.FileSystem, fileSystem),
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
  writeDatabase(database(), 'database before update');
  writeFileSync(
    join(source, 'package.json'),
    JSON.stringify({ name: packageName, version: '1.0.0' }),
  );
  rejectDownload = false;
  rejectCandidate = false;
  mutateDatabase = false;
  rejectRetention = false;
  rejectStart = false;
  commands = [];
  searchPath = '/usr/bin';
});

afterEach(async () => {
  await stopService();
  rmSync(home, { recursive: true, force: true });
});

it.each(['corrupt', 'zero-byte'] as const)(
  'failed initial install with %s preinstall data remains retryable and retains the data and backup',
  async (state) => {
    candidate();
    rejectCandidate = true;
    mutateDatabase = false;
    const original = state === 'corrupt' ? 'corrupt SQLite data' : '';
    writeFileSync(database(), original);
    await expect(
      execute(
        { action: 'install', settings: { dataDirectory: data, port: 4737 } },
        '2.0.0',
      ),
    ).rejects.toThrow('Could not prepare database backup');
    expect(existsSync(runtime())).toBe(false);
    expect(existsSync(join(root, 'installed.json'))).toBe(false);
    expect(
      existsSync(join(home, '.config/systemd/user/porcelain.service')),
    ).toBe(false);
    expect(readFileSync(database(), 'utf8')).toBe(original);
    const backups = readdirSync(join(root, 'database-backups'));
    expect(backups).toHaveLength(1);
    expect(
      readFileSync(
        join(
          root,
          'database-backups',
          backups[0] ?? 'missing-backup',
          'inventory.sqlite',
        ),
        'utf8',
      ),
    ).toBe(original);
    writeDatabase(database(), 'repaired data');
    rejectCandidate = false;
    await execute(
      { action: 'install', settings: { dataDirectory: data, port: 4737 } },
      '2.0.0',
    );
    expect(record('installed.json')).toEqual({ version: '2.0.0' });
    expect(readDatabase(database())).toBe('repaired data');
  },
);

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
  expect(readDatabase(join(updated.result.backup, 'inventory.sqlite'))).toBe(
    'database before update',
  );
  expect(readDatabase(database())).toBe('candidate changed the database');
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
  expect(readDatabase(database())).toBe('database before update');
  expect(existsSync(`${database()}-wal`)).toBe(false);
  expect(existsSync(`${database()}-shm`)).toBe(false);
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
    writeDatabase(join(backup, 'inventory.sqlite'), 'saved database');
    if (plan !== 'restart-current') {
      renameSync(runtime(), join(root, 'runtime.previous'));
      writeRuntime(runtime(), '2.0.0');
      writeFileSync(
        join(root, 'installed.json'),
        JSON.stringify({ version: '2.0.0' }),
      );
    }
    writeDatabase(database(), 'interrupted database');
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
    expect(readDatabase(database())).toBe(
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
  expect(await execute({ action: 'recover' })).toEqual({
    action: 'recover',
    result: { recovered: true },
  });
  expect(record('update-record.json')).toEqual({
    from: '1.0.0',
    target: '2.0.0',
    stage: 'updated',
  });
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
  expect(readDatabase(database())).toBe('database before update');
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
  writeDatabase(join(backup, 'inventory.sqlite'), 'saved database');
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
  expect(readDatabase(join(backup, 'inventory.sqlite'))).toBe('saved database');
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
  expect(readDatabase(join(outcome.result.backup, 'inventory.sqlite'))).toBe(
    'database before update',
  );
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

const withUpdaterLock = (
  task: (
    lock: Effect.Success<ReturnType<typeof acquireDirectoryLock>>,
  ) => Promise<void>,
) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const lock = yield* acquireDirectoryLock({
          path: join(root, 'updater.lock'),
          waitMs: 0,
          pollMs: 1,
          staleTakeovers: 1,
          clock: yield* Clock.Clock,
          held: () => new ServiceUpdateRunningError(),
        });
        yield* Effect.promise(() => task(lock));
      }),
    ).pipe(Effect.provide(NodeServices.layer)),
  );

it.each(['install', 'update', 'uninstall', 'recover'] as const)(
  'refuses %s while a live updater is preparing and leaves its record untouched',
  async (action) => {
    await install();
    const progress = { from: '1.0.0', target: '2.0.0', stage: 'downloading' };
    writeFileSync(join(root, 'update-record.json'), JSON.stringify(progress));
    const before = commands.slice();
    await withUpdaterLock(async () => {
      const request =
        action === 'install'
          ? { action, settings: { dataDirectory: data, port: 4737 } }
          : action === 'update'
            ? { action, allowDowngrade: false }
            : { action };
      const error = await execute(request, '2.0.0').catch(
        (error: unknown) => error,
      );
      expect(error).toMatchObject({
        _tag: 'ServiceUpdateRunningError',
        message: 'An update is already running',
      });
      expect(commands).toEqual(before);
      expect(record('update-record.json')).toEqual(progress);
      expect(record('installed.json')).toEqual({ version: '1.0.0' });
      expect(existsSync(join(root, 'updater.lock'))).toBe(true);
    });
    expect(existsSync(join(root, 'updater.lock'))).toBe(false);
  },
);

it('clears a stale updater lock during service recovery without replacing the installed service', async () => {
  await install();
  await withUpdaterLock(async () => {
    const path = join(root, 'updater.lock/owner.json');
    const owner = Schema.decodeUnknownSync(
      Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
    )(readFileSync(path, 'utf8'));
    writeFileSync(path, JSON.stringify({ ...owner, startTime: 'reused PID' }));
    if (process.platform !== 'linux') {
      await expect(execute({ action: 'recover' })).rejects.toThrow(
        'An update is already running',
      );
      expect(existsSync(join(root, 'updater.lock'))).toBe(true);
      return;
    }
    expect(await execute({ action: 'recover' })).toEqual({
      action: 'recover',
      result: { recovered: false },
    });
    expect(existsSync(join(root, 'updater.lock'))).toBe(false);
    expect(record('installed.json')).toEqual({ version: '1.0.0' });
  });
});

it('reports a healthy update as updated even when backup retention fails', async () => {
  await install();
  candidate();
  rejectRetention = true;
  expect(
    await execute({ action: 'update', allowDowngrade: false }, '2.0.0'),
  ).toMatchObject({ action: 'update' });
  expect(record('installed.json')).toEqual({ version: '2.0.0' });
  expect(record('update-record.json')).toEqual({
    from: '1.0.0',
    target: '2.0.0',
    stage: 'updated',
  });
  expect(service?.pid ?? 0).toBeGreaterThan(0);
});

it.each(['update', 'recover'] as const)(
  'lets the designated updater %s wait for its parent to release preparation ownership',
  async (action) => {
    await install();
    candidate();
    let observedParent = false;
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* Effect.promise(() =>
            withUpdaterLock(async (lock) => {
              const observedFiles: FileSystem.FileSystem = {
                ...fs,
                readFileString: (path, encoding) =>
                  fs.readFileString(path, encoding).pipe(
                    Effect.tap(() => {
                      if (
                        path !== join(root, 'updater.lock/owner.json') ||
                        observedParent
                      )
                        return Effect.void;
                      observedParent = true;
                      return lock.release;
                    }),
                  ),
              };
              const request =
                action === 'update'
                  ? { action, allowDowngrade: false }
                  : { action };
              const outcome = await execute(
                request,
                '2.0.0',
                join(root, 'updater/node_modules', packageName),
                observedFiles,
              );
              expect(outcome.action).toBe(action);
              expect(record('installed.json')).toEqual({
                version: action === 'update' ? '2.0.0' : '1.0.0',
              });
            }),
          );
        }),
      ).pipe(Effect.provide(NodeServices.layer)),
    );
    expect(observedParent).toBe(true);
    expect(existsSync(join(root, 'updater.lock'))).toBe(false);
  },
);

it('refuses a designated updater if its parent never releases preparation ownership', async () => {
  await install();
  const before = commands.slice();
  await withUpdaterLock(async () => {
    await expect(
      execute(
        { action: 'update', allowDowngrade: false },
        '2.0.0',
        join(root, 'updater/node_modules', packageName),
      ),
    ).rejects.toThrow('An update is already running');
    expect(commands).toEqual(before);
    expect(record('installed.json')).toEqual({ version: '1.0.0' });
    expect(existsSync(join(root, 'updater.lock'))).toBe(true);
  });
});

it.each([
  'missing',
  'corrupt',
  'zero-byte',
  'truncated-1',
  'truncated-99',
  'truncated-page-minus-one',
  'no-migrations',
  'empty-migrations',
  'copy-failure',
  'promotion-failure',
] as const)(
  'retains both runtimes, current data, journal and backup after %s restore failure and allows retry',
  async (failure) => {
    await install();
    await stopService();
    renameSync(runtime(), join(root, 'runtime.previous'));
    writeRuntime(runtime(), '2.0.0');
    writeDatabase(database(), 'newer surviving data');
    const currentBytes = readFileSync(database());
    writeRuntime(join(root, 'runtime.next'), '2.0.0');
    writeFileSync(join(root, 'installed.json'), '{"version":"2.0.0"}');
    const backup = join(root, 'saved-database');
    if (failure !== 'missing') {
      mkdirSync(backup);
      if (failure === 'corrupt')
        writeFileSync(join(backup, 'inventory.sqlite'), 'corrupt');
      else writeDatabase(join(backup, 'inventory.sqlite'), 'saved database');
      if (failure === 'zero-byte')
        writeFileSync(join(backup, 'inventory.sqlite'), '');
      if (failure.startsWith('truncated-')) {
        const file = join(backup, 'inventory.sqlite');
        truncateSync(
          file,
          failure === 'truncated-1'
            ? 1
            : failure === 'truncated-99'
              ? 99
              : readFileSync(file).readUInt16BE(16) - 1,
        );
      }
      if (failure === 'no-migrations' || failure === 'empty-migrations') {
        const db = new DatabaseSync(join(backup, 'inventory.sqlite'));
        try {
          db.exec(
            failure === 'no-migrations'
              ? 'DROP TABLE porcelain_migrations'
              : 'DELETE FROM porcelain_migrations',
          );
        } finally {
          db.close();
        }
      }
    }
    const journal = JSON.stringify({
      installed: { version: '1.0.0' },
      backup,
      target: '2.0.0',
    });
    writeFileSync(join(root, 'update.json'), journal);
    const backupBytes =
      failure === 'missing'
        ? undefined
        : readFileSync(join(backup, 'inventory.sqlite'));
    let failRename = true;
    const files = await Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        return {
          ...fs,
          copyFile: (from: string, to: string) =>
            failure === 'copy-failure' && from.startsWith(backup)
              ? fs.copyFile(join(root, 'missing-copy-source'), to)
              : fs.copyFile(from, to),
          rename: (from: string, to: string) => {
            if (
              failure === 'promotion-failure' &&
              failRename &&
              to === database()
            ) {
              failRename = false;
              return fs.rename(join(root, 'missing-rename-source'), to);
            }
            return fs.rename(from, to);
          },
        };
      }).pipe(Effect.provide(NodeServices.layer)),
    );
    const commandCount = commands.length;
    await expect(
      execute({ action: 'recover' }, '2.0.0', source, files),
    ).rejects.toThrow(
      failure === 'promotion-failure'
        ? 'Could not promote database backup'
        : 'Could not prepare database backup',
    );
    failRename = true;
    await expect(
      execute({ action: 'recover' }, '2.0.0', source, files),
    ).rejects.toThrow(
      failure === 'promotion-failure'
        ? 'Could not promote database backup'
        : 'Could not prepare database backup',
    );
    expect(existsSync(database())).toBe(true);
    expect(readFileSync(database())).toEqual(currentBytes);
    expect(readDatabase(database())).toBe('newer surviving data');
    expect(JSON.parse(readFileSync(manifest(runtime()), 'utf8'))).toMatchObject(
      { version: '2.0.0' },
    );
    expect(
      JSON.parse(
        readFileSync(manifest(join(root, 'runtime.previous')), 'utf8'),
      ),
    ).toMatchObject({ version: '1.0.0' });
    expect(
      JSON.parse(readFileSync(manifest(join(root, 'runtime.next')), 'utf8')),
    ).toMatchObject({ version: '2.0.0' });
    expect(
      commands
        .slice(commandCount)
        .filter((command) => command.includes(' start ')),
    ).toEqual([]);
    expect(record('installed.json')).toEqual({ version: '2.0.0' });
    expect(readFileSync(join(root, 'update.json'), 'utf8')).toBe(journal);
    if (backupBytes !== undefined)
      expect(readFileSync(join(backup, 'inventory.sqlite'))).toEqual(
        backupBytes,
      );
    mkdirSync(backup, { recursive: true });
    writeDatabase(join(backup, 'inventory.sqlite'), 'saved database');
    expect(await execute({ action: 'recover' })).toEqual({
      action: 'recover',
      result: { recovered: true },
    });
    expect(readDatabase(database())).toBe('saved database');
    expect(record('installed.json')).toEqual({ version: '1.0.0' });
    expect(await execute({ action: 'recover' })).toEqual({
      action: 'recover',
      result: { recovered: false },
    });
  },
);

function healthyJournal() {
  renameSync(runtime(), join(root, 'runtime.previous'));
  writeRuntime(runtime(), '2.0.0');
  writeRuntime(join(root, 'runtime.next'), '2.0.0');
  writeDatabase(database(), 'newer writes after healthy update');
  writeFileSync(join(root, 'installed.json'), '{"version":"2.0.0"}');
  const backup = join(root, 'saved-database');
  mkdirSync(backup);
  writeDatabase(join(backup, 'inventory.sqlite'), 'older snapshot');
  const journal = JSON.stringify({
    installed: { version: '1.0.0' },
    backup,
    target: '2.0.0',
    healthy: true,
  });
  writeFileSync(join(root, 'update.json'), journal);
  return { backup, journal };
}

const recoveryProbe =
  (
    failure: 'absent' | 'unreadable' | 'wrong-pid' | 'wrong-directory',
  ): OwnerProbe['probe'] =>
  () =>
    Effect.sync(() => {
      if (failure === 'absent') return { kind: 'absent' as const };
      if (failure === 'unreadable')
        return {
          kind: 'unreadable' as const,
          reason: 'owner response unavailable',
        };
      return {
        kind: 'running' as const,
        status: {
          address: 'http://127.0.0.1:4737',
          pid:
            failure === 'wrong-pid'
              ? (service?.pid ?? 0) + 1
              : (service?.pid ?? 0),
          dataDirectory:
            failure === 'wrong-directory' ? join(home, 'different-data') : data,
        },
      };
    });

it.each([
  'absent',
  'unreadable',
  'wrong-pid',
  'wrong-directory',
  'startup-failure',
] as const)(
  'healthy journal restart must prove current readiness after %s and remain retryable',
  async (failure) => {
    await install();
    await stopService();
    const { backup, journal } = healthyJournal();
    writeFileSync(
      join(root, 'update-record.json'),
      '{"from":"1.0.0","target":"2.0.0","stage":"restarting"}',
    );
    const probe =
      failure === 'startup-failure' ? undefined : recoveryProbe(failure);
    rejectStart = failure === 'startup-failure';
    await expect(
      execute({ action: 'recover' }, '2.0.0', source, undefined, probe),
    ).rejects.toThrow(
      failure === 'startup-failure'
        ? 'service startup failed'
        : 'did not become healthy',
    );
    await expect(
      execute({ action: 'recover' }, '2.0.0', source, undefined, probe),
    ).rejects.toThrow(
      failure === 'startup-failure'
        ? 'service startup failed'
        : 'did not become healthy',
    );
    expect(readDatabase(database())).toBe('newer writes after healthy update');
    expect(readDatabase(join(backup, 'inventory.sqlite'))).toBe(
      'older snapshot',
    );
    expect(readFileSync(join(root, 'update.json'), 'utf8')).toBe(journal);
    expect(existsSync(join(root, 'runtime.previous'))).toBe(true);
    expect(existsSync(join(root, 'runtime.next'))).toBe(true);
    expect(record('installed.json')).toEqual({ version: '2.0.0' });
    expect(record('update-record.json')).toEqual({
      from: '1.0.0',
      target: '2.0.0',
      stage: 'restarting',
    });
    rejectStart = false;
    expect(await execute({ action: 'recover' })).toEqual({
      action: 'recover',
      result: { recovered: true },
    });
    expect(readDatabase(database())).toBe('newer writes after healthy update');
    expect(existsSync(join(root, 'runtime.previous'))).toBe(false);
    expect(existsSync(join(root, 'runtime.next'))).toBe(false);
    expect(existsSync(join(root, 'update.json'))).toBe(false);
    expect(record('update-record.json')).toEqual({
      from: '1.0.0',
      target: '2.0.0',
      stage: 'updated',
    });
    expect(await execute({ action: 'recover' })).toEqual({
      action: 'recover',
      result: { recovered: false },
    });
  },
);

it('retains healthy recovery state until the expected owner eventually answers', async () => {
  await install();
  await stopService();
  healthyJournal();
  const observed: boolean[] = [];
  const probe: OwnerProbe['probe'] = () =>
    Effect.sync(() => {
      observed.push(
        existsSync(join(root, 'runtime.previous')) &&
          existsSync(join(root, 'update.json')) &&
          existsSync(join(root, 'runtime.next')),
      );
      if (observed.length < 3) return { kind: 'absent' as const };
      return {
        kind: 'running' as const,
        status: {
          address: 'http://127.0.0.1:4737',
          pid: service?.pid ?? 0,
          dataDirectory: data,
        },
      };
    });
  expect(
    await execute({ action: 'recover' }, '2.0.0', source, undefined, probe),
  ).toEqual({ action: 'recover', result: { recovered: true } });
  expect(observed).toEqual([true, true, true]);
  expect(readDatabase(database())).toBe('newer writes after healthy update');
  expect(existsSync(join(root, 'update.json'))).toBe(false);
});

it.each([
  'absent',
  'unreadable',
  'wrong-pid',
  'wrong-directory',
  'startup-failure',
] as const)(
  'ordinary service recovery rejects %s instead of reporting readiness',
  async (failure) => {
    await install();
    await stopService();
    rejectStart = failure === 'startup-failure';
    const probe =
      failure === 'startup-failure' ? undefined : recoveryProbe(failure);
    await expect(
      execute({ action: 'recover' }, '1.0.0', source, undefined, probe),
    ).rejects.toThrow(
      failure === 'startup-failure'
        ? 'service startup failed'
        : 'did not become healthy',
    );
    await expect(
      execute({ action: 'recover' }, '1.0.0', source, undefined, probe),
    ).rejects.toThrow(
      failure === 'startup-failure'
        ? 'service startup failed'
        : 'did not become healthy',
    );
    expect(readDatabase(database())).toBe('database before update');
    expect(record('installed.json')).toEqual({ version: '1.0.0' });
    expect(existsSync(join(root, 'update.json'))).toBe(false);
  },
);

it('reports ordinary recovery only after the restarted owner eventually answers', async () => {
  await install();
  await stopService();
  let attempts = 0;
  const probe: OwnerProbe['probe'] = () =>
    Effect.sync(() => {
      attempts++;
      if (attempts < 3) return { kind: 'absent' as const };
      return {
        kind: 'running' as const,
        status: {
          address: 'http://127.0.0.1:4737',
          pid: service?.pid ?? 0,
          dataDirectory: data,
        },
      };
    });
  expect(
    await execute({ action: 'recover' }, '1.0.0', source, undefined, probe),
  ).toEqual({ action: 'recover', result: { recovered: true } });
  expect(attempts).toBe(3);
  expect(readDatabase(database())).toBe('database before update');
  expect(await execute({ action: 'recover' })).toEqual({
    action: 'recover',
    result: { recovered: false },
  });
});

it.each(['absent', 'unreadable', 'wrong-pid', 'wrong-directory'] as const)(
  'already running service recovery rejects %s without restarting or changing data',
  async (failure) => {
    await install();
    const pid = service?.pid;
    await expect(
      execute(
        { action: 'recover' },
        '1.0.0',
        source,
        undefined,
        recoveryProbe(failure),
      ),
    ).rejects.toThrow('did not become healthy');
    expect(service?.pid).toBe(pid);
    expect(readDatabase(database())).toBe('database before update');
    expect(record('installed.json')).toEqual({ version: '1.0.0' });
  },
);
