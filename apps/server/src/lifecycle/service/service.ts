import { randomUUID } from 'node:crypto';
import {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { ownerSocketPath, probeOwnerSocket } from '../owner-socket.ts';
import {
  type CommandRunner,
  runCommand,
  type ServicePlan,
  serviceManager,
} from './manager.ts';

const packageName = '@fabiofiorita/porcelain';
const databaseFiles = [
  'inventory.sqlite',
  'inventory.sqlite-wal',
  'inventory.sqlite-shm',
];

type InstalledMetadata = { version: string };

type UpdateJournal = {
  installed: InstalledMetadata;
  backup: string;
};

export type ServiceConfiguration = {
  dataDirectory: string;
  host: string;
  port: number;
  allowedHosts: string[];
};

export type ServiceStatus = {
  installed: boolean;
  version?: string;
  enabled: boolean;
  running: boolean;
  linger: 'enabled' | 'disabled' | 'unavailable' | 'not-applicable';
  unitPath: string;
  stdoutLog: string;
  stderrLog: string;
};

export type ServiceDependencies = {
  platform?: NodeJS.Platform;
  uid?: number;
  runner?: CommandRunner;
  packageRoot: string;
  packageVersion: string;
  nodeExecutable?: string;
  healthCheck?: (dataDirectory: string) => Promise<boolean>;
  environmentPath?: string;
  beforeLockPublish?: () => Promise<void>;
};

export class ServiceDowngradeError extends Error {
  override readonly name = 'ServiceDowngradeError';
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function processIsAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function acquireManagementLock(
  root: string,
  beforePublish?: () => Promise<void>,
) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const lock = join(root, 'management.lock');
  const token = randomUUID();
  const candidate = `${lock}.candidate-${token}`;
  await mkdir(candidate, { mode: 0o700 });
  await writeFile(
    join(candidate, 'owner.json'),
    `${JSON.stringify({ pid: process.pid, createdAt: Date.now(), token })}\n`,
    { mode: 0o600 },
  );
  await beforePublish?.();
  let acquired = false;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await rename(candidate, lock);
        acquired = true;
        return async () => {
          try {
            const owner = JSON.parse(
              await readFile(join(lock, 'owner.json'), 'utf8'),
            ) as { token?: unknown };
            if (owner.token === token)
              await rm(lock, { recursive: true, force: true });
          } catch {
            // A missing or replaced lock no longer belongs to this command.
          }
        };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'EEXIST' && code !== 'ENOTEMPTY') throw error;
        let stale = true;
        try {
          const owner = JSON.parse(
            await readFile(join(lock, 'owner.json'), 'utf8'),
          ) as { pid?: unknown; createdAt?: unknown };
          stale =
            typeof owner.pid !== 'number' ||
            typeof owner.createdAt !== 'number' ||
            !processIsAlive(owner.pid);
        } catch {
          // Locks from older versions may have crashed before writing ownership.
        }
        if (!stale)
          throw new Error(
            'Another Porcelain service command is already running. Wait for it to finish.',
          );
        await rm(lock, { recursive: true, force: true });
      }
    }
    throw new Error('Could not acquire the Porcelain service management lock.');
  } finally {
    if (!acquired) await rm(candidate, { recursive: true, force: true });
  }
}

function serviceRoot(homeDirectory: string) {
  return join(homeDirectory, '.local/share/porcelain/service');
}

function paths(homeDirectory: string) {
  const root = serviceRoot(homeDirectory);
  return {
    root,
    runtime: join(root, 'runtime'),
    nextRuntime: join(root, 'runtime.next'),
    previousRuntime: join(root, 'runtime.previous'),
    updateJournal: join(root, 'update.json'),
    metadata: join(root, 'installed.json'),
    config: join(root, 'config.json'),
    backups: join(root, 'database-backups'),
    stdoutLog: join(root, 'logs/stdout.log'),
    stderrLog: join(root, 'logs/stderr.log'),
  };
}

function entryPoint(runtime: string) {
  return join(runtime, 'node_modules/@fabiofiorita/porcelain/bin/porcelain.js');
}

function compareVersions(left: string, right: string) {
  const parse = (value: string) => {
    const matched =
      /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
        value,
      );
    if (!matched) throw new Error(`Invalid package version: ${value}`);
    return {
      numbers: [Number(matched[1]), Number(matched[2]), Number(matched[3])],
      prerelease: matched[4]?.split('.'),
    };
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index++) {
    const difference = (a.numbers[index] ?? 0) - (b.numbers[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  if (!a.prerelease && !b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  for (
    let index = 0;
    index < Math.max(a.prerelease.length, b.prerelease.length);
    index++
  ) {
    const av = a.prerelease[index];
    const bv = b.prerelease[index];
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    if (av === bv) continue;
    const an = /^\d+$/.test(av) ? Number(av) : null;
    const bn = /^\d+$/.test(bv) ? Number(bv) : null;
    if (an !== null && bn !== null) return Math.sign(an - bn);
    if (an !== null) return -1;
    if (bn !== null) return 1;
    return av < bv ? -1 : 1;
  }
  return 0;
}

async function readMetadata(path: string): Promise<InstalledMetadata | null> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { version?: unknown }).version === 'string'
    )
      return { version: (value as { version: string }).version };
  } catch {
    // Missing or invalid metadata is repaired by install/update.
  }
  return null;
}

async function readUpdateJournal(path: string): Promise<UpdateJournal | null> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { backup?: unknown }).backup === 'string' &&
      typeof (value as { installed?: { version?: unknown } }).installed
        ?.version === 'string'
    )
      return value as UpdateJournal;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  throw new Error(
    `The interrupted update record at ${path} is invalid. Preserve it and the service runtime for manual recovery.`,
  );
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporary, path);
}

async function installRuntime(
  runner: CommandRunner,
  source: string,
  destination: string,
  version: string,
) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const result = await runner('npm', [
    'install',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
    '--install-links=true',
    '--prefix',
    destination,
    source,
  ]);
  if (result.code !== 0)
    throw new Error(
      `Could not install the persistent runtime: ${result.stderr.trim()}`,
    );
  const manifest = JSON.parse(
    await readFile(
      join(
        destination,
        'node_modules',
        ...packageName.split('/'),
        'package.json',
      ),
      'utf8',
    ),
  ) as { version?: string };
  if (manifest.version !== version)
    throw new Error(
      `Persistent runtime reported ${manifest.version ?? 'no version'} instead of ${version}.`,
    );
}

async function backupDatabase(dataDirectory: string, destination: string) {
  await mkdir(destination, { recursive: true, mode: 0o700 });
  for (const file of databaseFiles) {
    const source = join(dataDirectory, file);
    if (await exists(source)) await copyFile(source, join(destination, file));
  }
}

async function restoreDatabase(dataDirectory: string, backup: string) {
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  for (const file of databaseFiles) {
    await rm(join(dataDirectory, file), { force: true });
    const source = join(backup, file);
    if (await exists(source)) await copyFile(source, join(dataDirectory, file));
  }
}

async function readConfig(path: string): Promise<ServiceConfiguration> {
  const value = JSON.parse(await readFile(path, 'utf8')) as unknown;
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof (value as { dataDirectory?: unknown }).dataDirectory !== 'string' ||
    typeof (value as { host?: unknown }).host !== 'string' ||
    typeof (value as { port?: unknown }).port !== 'number' ||
    !Array.isArray((value as { allowedHosts?: unknown }).allowedHosts) ||
    !(value as { allowedHosts: unknown[] }).allowedHosts.every(
      (host) => typeof host === 'string',
    )
  )
    throw new Error(
      'The saved service configuration is invalid. Uninstall and install the service again.',
    );
  return value as ServiceConfiguration;
}

function plan(
  location: ReturnType<typeof paths>,
  nodeExecutable: string,
  environmentPath: string,
  settings: ServiceConfiguration,
): ServicePlan {
  return {
    nodeExecutable,
    entryPoint: entryPoint(location.runtime),
    dataDirectory: settings.dataDirectory,
    host: settings.host,
    port: settings.port,
    allowedHosts: settings.allowedHosts,
    stdoutLog: location.stdoutLog,
    stderrLog: location.stderrLog,
    environmentPath,
  };
}

export class PorcelainService {
  readonly #packageRoot: string;
  readonly #packageVersion: string;
  readonly #runner: CommandRunner;
  readonly #uid: number;
  readonly #manager: ReturnType<typeof serviceManager>;
  readonly #paths: ReturnType<typeof paths>;
  readonly #nodeExecutable: string;
  readonly #healthCheck: (dataDirectory: string) => Promise<boolean>;
  readonly #environmentPath: string;
  readonly #beforeLockPublish?: () => Promise<void>;

  constructor(homeDirectory: string, dependencies: ServiceDependencies) {
    const uid = dependencies.uid ?? process.getuid?.();
    if (uid === undefined)
      throw new Error('Porcelain services require a user id.');
    this.#packageRoot = dependencies.packageRoot;
    this.#packageVersion = dependencies.packageVersion;
    this.#runner = dependencies.runner ?? runCommand;
    this.#uid = uid;
    this.#paths = paths(homeDirectory);
    this.#nodeExecutable = dependencies.nodeExecutable ?? process.execPath;
    this.#beforeLockPublish = dependencies.beforeLockPublish;
    this.#environmentPath =
      dependencies.environmentPath ??
      [
        dirname(this.#nodeExecutable),
        ...(process.env.PATH ?? '')
          .split(delimiter)
          .filter(
            (directory) =>
              directory.length > 0 &&
              !directory.includes('node_modules/.bin') &&
              !directory.includes('/.npm/_npx/'),
          ),
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
      ]
        .filter((directory, index, all) => all.indexOf(directory) === index)
        .join(delimiter);
    this.#manager = serviceManager({
      platform: dependencies.platform ?? process.platform,
      homeDirectory,
      uid,
      runner: this.#runner,
    });
    this.#healthCheck =
      dependencies.healthCheck ??
      (async (dataDirectory) => {
        const socket = ownerSocketPath(dataDirectory);
        for (let attempt = 0; attempt < 60; attempt++) {
          const [probe, servicePid] = await Promise.all([
            probeOwnerSocket(socket, 500),
            this.#manager.processId(),
          ]);
          if (
            probe.kind === 'running' &&
            probe.status.dataDirectory === dataDirectory &&
            servicePid !== null &&
            probe.status.pid === servicePid
          )
            return true;
          await new Promise<void>((resolve) => setTimeout(resolve, 250));
        }
        return false;
      });
  }

  #assertUser() {
    if (this.#uid === 0)
      throw new Error(
        'Refusing to manage Porcelain as root. Run this command as the user who will use Porcelain.',
      );
  }

  async #withLock<T>(work: () => Promise<T>): Promise<T> {
    const release = await acquireManagementLock(
      this.#paths.root,
      this.#beforeLockPublish,
    );
    try {
      return await work();
    } finally {
      await release();
    }
  }

  async status(): Promise<ServiceStatus> {
    this.#assertUser();
    return this.#withLock(() => this.#status());
  }

  async #status(): Promise<ServiceStatus> {
    this.#assertUser();
    const [metadata, probe] = await Promise.all([
      readMetadata(this.#paths.metadata),
      this.#manager.probe(),
    ]);
    return {
      installed: metadata !== null && (await exists(this.#manager.unitPath)),
      ...(metadata ? { version: metadata.version } : {}),
      ...probe,
      unitPath: this.#manager.unitPath,
      stdoutLog: this.#paths.stdoutLog,
      stderrLog: this.#paths.stderrLog,
    };
  }

  async #recoverInterruptedUpdate(): Promise<boolean> {
    const journal = await readUpdateJournal(this.#paths.updateJournal);
    if (!journal) {
      if (
        (await exists(this.#paths.runtime)) &&
        (await exists(this.#paths.previousRuntime))
      )
        await rm(this.#paths.previousRuntime, { recursive: true, force: true });
      return false;
    }
    const config = await readConfig(this.#paths.config);
    const probe = await this.#manager.probe();
    if (probe.running) await this.#manager.stop();
    if (await exists(this.#paths.previousRuntime)) {
      await rm(this.#paths.runtime, { recursive: true, force: true });
      await rename(this.#paths.previousRuntime, this.#paths.runtime);
    } else if (!(await exists(this.#paths.runtime))) {
      throw new Error(
        'An interrupted update has neither the installed nor previous runtime. Preserve the service directory for manual recovery.',
      );
    }
    await restoreDatabase(config.dataDirectory, journal.backup);
    await writeJson(this.#paths.metadata, journal.installed);
    await this.#manager.write(
      plan(this.#paths, this.#nodeExecutable, this.#environmentPath, config),
    );
    await this.#manager.start();
    if (!(await this.#healthCheck(config.dataDirectory)))
      throw new Error(
        'The previous service was restored after an interrupted update but did not become healthy.',
      );
    await rm(this.#paths.nextRuntime, { recursive: true, force: true });
    await rm(this.#paths.updateJournal, { force: true });
    return true;
  }

  async install(
    settings: ServiceConfiguration & { allowDowngrade: boolean },
  ): Promise<{ lingerCommand?: string; backup?: string }> {
    this.#assertUser();
    return this.#withLock(() => this.#install(settings));
  }

  async #install(
    settings: ServiceConfiguration & { allowDowngrade: boolean },
  ): Promise<{ lingerCommand?: string; backup?: string }> {
    this.#assertUser();
    await this.#recoverInterruptedUpdate();
    if ((await readMetadata(this.#paths.metadata)) !== null) {
      return this.#update(settings.allowDowngrade);
    }
    if (await exists(this.#manager.unitPath))
      throw new Error(
        `Refusing to replace the existing service unit at ${this.#manager.unitPath}.`,
      );
    const socket = await probeOwnerSocket(
      ownerSocketPath(settings.dataDirectory),
    );
    if (socket.kind !== 'absent')
      throw new Error(
        `Refusing to install while the data directory is ${socket.kind === 'running' ? 'owned by a running Porcelain server' : 'not safely readable'}. Stop it first.`,
      );
    const staging = `${this.#paths.runtime}.next-${randomUUID()}`;
    const backup = join(
      this.#paths.backups,
      `preinstall-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`,
    );
    let backupComplete = false;
    let unitWritten = false;
    try {
      await installRuntime(
        this.#runner,
        this.#packageRoot,
        staging,
        this.#packageVersion,
      );
      await mkdir(dirname(this.#paths.stdoutLog), {
        recursive: true,
        mode: 0o700,
      });
      for (const log of [this.#paths.stdoutLog, this.#paths.stderrLog]) {
        await writeFile(log, '', { flag: 'a', mode: 0o600 });
        await chmod(log, 0o600);
      }
      await rename(staging, this.#paths.runtime);
      await writeJson(this.#paths.config, {
        dataDirectory: settings.dataDirectory,
        host: settings.host,
        port: settings.port,
        allowedHosts: settings.allowedHosts,
      });
      await writeJson(this.#paths.metadata, { version: this.#packageVersion });
      await backupDatabase(settings.dataDirectory, backup);
      backupComplete = true;
      await this.#manager.write(
        plan(
          this.#paths,
          this.#nodeExecutable,
          this.#environmentPath,
          settings,
        ),
      );
      unitWritten = true;
      let lingerCommand: string | undefined;
      if (
        this.#manager.kind === 'systemd' &&
        !(await this.#manager.enableLinger())
      )
        lingerCommand = 'sudo loginctl enable-linger "$(id -un)"';
      await this.#manager.enableAndStart();
      if (!(await this.#healthCheck(settings.dataDirectory)))
        throw new Error('The installed service did not become healthy.');
      return {
        backup,
        ...(lingerCommand ? { lingerCommand } : {}),
      };
    } catch (error) {
      if (unitWritten) {
        try {
          await this.#manager.uninstall();
        } catch (cleanupError) {
          throw new Error(
            `Porcelain installation failed and the service could not be stopped safely. The runtime and backup were retained. ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        }
      }
      if (backupComplete) await restoreDatabase(settings.dataDirectory, backup);
      await rm(this.#paths.runtime, { recursive: true, force: true });
      await rm(this.#paths.metadata, { force: true });
      await rm(staging, { recursive: true, force: true });
      throw error;
    }
  }

  async update(allowDowngrade = false): Promise<{ backup?: string }> {
    this.#assertUser();
    return this.#withLock(() => this.#update(allowDowngrade));
  }

  async #update(allowDowngrade = false): Promise<{ backup?: string }> {
    this.#assertUser();
    await this.#recoverInterruptedUpdate();
    const installed = await readMetadata(this.#paths.metadata);
    if (!installed)
      throw new Error(
        'Porcelain service is not installed. Run `porcelain service install`.',
      );
    if (
      !allowDowngrade &&
      compareVersions(this.#packageVersion, installed.version) < 0
    )
      throw new ServiceDowngradeError(
        `Refusing to replace Porcelain ${installed.version} with older ${this.#packageVersion}. Run again with --allow-downgrade to continue.`,
      );
    const config = await readConfig(this.#paths.config);
    const staging = this.#paths.nextRuntime;
    const previous = this.#paths.previousRuntime;
    const backup = join(
      this.#paths.backups,
      `${new Date().toISOString().replaceAll(':', '-')}-${installed.version}-${randomUUID()}`,
    );
    await installRuntime(
      this.#runner,
      this.#packageRoot,
      staging,
      this.#packageVersion,
    );
    let stopped = false;
    let previousMoved = false;
    let nextMoved = false;
    try {
      await this.#manager.stop();
      stopped = true;
      const socket = await probeOwnerSocket(
        ownerSocketPath(config.dataDirectory),
      );
      if (socket.kind !== 'absent')
        throw new Error(
          `The data directory remained ${socket.kind === 'running' ? 'owned by a running Porcelain server' : 'not safely readable'} after stopping the service.`,
        );
      await backupDatabase(config.dataDirectory, backup);
      await writeJson(this.#paths.updateJournal, { installed, backup });
      await rename(this.#paths.runtime, previous);
      previousMoved = true;
      await rename(staging, this.#paths.runtime);
      nextMoved = true;
      await writeJson(this.#paths.metadata, { version: this.#packageVersion });
      await this.#manager.write(
        plan(this.#paths, this.#nodeExecutable, this.#environmentPath, config),
      );
      await this.#manager.enableAndStart();
      if (!(await this.#healthCheck(config.dataDirectory)))
        throw new Error('The updated service did not become healthy.');
      await rm(this.#paths.updateJournal, { force: true });
      await rm(previous, { recursive: true, force: true });
      return { backup };
    } catch (error) {
      if (await exists(this.#paths.updateJournal)) {
        try {
          await this.#recoverInterruptedUpdate();
        } catch (recoveryError) {
          throw new Error(
            `Porcelain update failed and automatic recovery could not finish. The update record, previous runtime, and database backup were retained. ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
          );
        }
      } else if (stopped) {
        try {
          await this.#manager.start();
          if (!(await this.#healthCheck(config.dataDirectory)))
            throw new Error('The previous service did not become healthy.');
        } catch (recoveryError) {
          throw new Error(
            `Porcelain update failed before replacement and the previous service could not restart. ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
          );
        }
      }
      const recovery =
        previousMoved || nextMoved
          ? 'the previous runtime and database were restored'
          : stopped
            ? 'the previous runtime was restarted before replacement'
            : 'the installed service was left unchanged';
      throw new Error(
        `Porcelain update failed; ${recovery}. ${error instanceof Error ? error.message : ''}`.trim(),
      );
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }

  async uninstall(): Promise<boolean> {
    this.#assertUser();
    return this.#withLock(() => this.#uninstall());
  }

  async #uninstall(): Promise<boolean> {
    this.#assertUser();
    await this.#recoverInterruptedUpdate();
    const installed = await readMetadata(this.#paths.metadata);
    if (!installed && (await exists(this.#manager.unitPath)))
      throw new Error(
        `Refusing to remove an unrecognized service unit at ${this.#manager.unitPath}.`,
      );
    if (!installed) return false;
    await this.#manager.uninstall();
    await rm(this.#paths.runtime, { recursive: true, force: true });
    await rm(this.#paths.metadata, { force: true });
    // Deliberately retain config, logs, backups, and the data directory.
    return true;
  }
}
