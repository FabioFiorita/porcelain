import { runCommand, type CommandRunner } from './command-runner.ts';
import type { InstallerContext } from './context.ts';
import { NoUserIdError } from './errors/no-user-id-error.ts';
import { RootUserError } from './errors/root-user-error.ts';
import {
  install,
  type InstallOutcome,
  type InstallSettings,
} from './install.ts';
import { join } from 'node:path';
import { LIMITS } from '../config/limits.ts';
import { acquireDirectoryLock } from '../runtime/directory-lock.ts';
import { ManagementLockHeldError } from './errors/management-lock-held-error.ts';
import { servicePaths } from './paths.ts';
import { serviceSearchPath } from './search-path.ts';
import type { Clock } from '@porcelain/kernel/ports';
import type { OwnerProbe } from '../ports/owner-probe.ts';
import { readServiceStatus, type ServiceStatus } from './status.ts';
import { SystemdService } from './systemd-service.ts';
import { uninstall } from './uninstall.ts';
import { update, type UpdateOutcome } from './update.ts';

export type InstallerOptions = {
  homeDirectory: string;
  packageRoot: string;
  packageVersion: string;
  searchPath: string;
  ownerProbe: OwnerProbe;
  clock: Clock;
  uid?: number | undefined;
  runner?: CommandRunner | undefined;
  nodeExecutable?: string | undefined;
};

export class Installer {
  private readonly context: InstallerContext;

  constructor(context: InstallerContext) {
    this.context = context;
  }

  status(): Promise<ServiceStatus> {
    return this.locked(() => readServiceStatus(this.context));
  }

  install(settings: InstallSettings): Promise<InstallOutcome> {
    return this.locked(() => install(this.context, settings));
  }

  update(allowDowngrade: boolean): Promise<UpdateOutcome> {
    return this.locked(() => update(this.context, allowDowngrade));
  }

  uninstall(): Promise<boolean> {
    return this.locked(() => uninstall(this.context));
  }

  private async locked<T>(work: () => Promise<T>): Promise<T> {
    const lock = await acquireDirectoryLock({
      path: join(this.context.paths.root, 'management.lock'),
      waitMs: 0,
      pollMs: LIMITS.locks.pollMs,
      clock: this.context.clock,
      held: () => new ManagementLockHeldError(),
    });
    try {
      return await work();
    } finally {
      await lock.release();
    }
  }
}

export function openInstaller(options: InstallerOptions): Installer {
  const uid = options.uid ?? process.getuid?.();
  if (uid === undefined) throw new NoUserIdError();
  if (uid === 0) throw new RootUserError();
  const runner = options.runner ?? runCommand;
  const nodeExecutable = options.nodeExecutable ?? process.execPath;
  return new Installer({
    paths: servicePaths(options.homeDirectory),
    runner,
    systemd: new SystemdService(options.homeDirectory, uid, runner),
    packageRoot: options.packageRoot,
    packageVersion: options.packageVersion,
    nodeExecutable,
    searchPath: serviceSearchPath(nodeExecutable, options.searchPath),
    ownerProbe: options.ownerProbe,
    clock: options.clock,
  });
}
