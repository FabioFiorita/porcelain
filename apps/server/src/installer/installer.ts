import { Context, Effect, FileSystem, Layer, Path, type Clock } from 'effect';
import { ChildProcessSpawner } from 'effect/process';
import type { PlatformError } from 'effect/PlatformError';
import type { Scope } from 'effect/Scope';
import { commandRunner, type CommandRunner } from './command-runner.ts';
import type { InstallerContext } from './context.ts';
import { NoUserIdError } from './errors/no-user-id-error.ts';
import { RootUserError } from './errors/root-user-error.ts';
import { InstallerOperationError } from './errors/installer-operation-error.ts';
import {
  isInstallerError,
  type InstallerError,
} from './errors/installer-error.ts';
import { failureDetail } from './failure-detail.ts';
import {
  install,
  type InstallOutcome,
  type InstallSettings,
} from './install.ts';
import type { Limits } from '../config/limits.ts';
import { acquireDirectoryLock } from '../runtime/directory-lock.ts';
import { ManagementLockHeldError } from './errors/management-lock-held-error.ts';
import { servicePaths } from './paths.ts';
import { serviceSearchPath } from './search-path.ts';
import type { OwnerProbe } from '../ports/owner-probe.ts';
import { readServiceStatus, type ServiceStatus } from './status.ts';
import { openSystemdService } from './systemd-service.ts';
import { uninstall } from './uninstall.ts';
import { update, type UpdateOutcome } from './update.ts';
import {
  recoverService,
  type RecoveryOutcome,
} from './recover-interrupted-update.ts';

export class InstallerOptions extends Context.Service<
  InstallerOptions,
  {
    readonly homeDirectory: string;
    readonly packageRoot: string;
    readonly packageVersion: string;
    readonly searchPath: string;
    readonly ownerProbe: OwnerProbe;
    readonly clock: Clock.Clock;
    readonly limits: Pick<Limits, 'installer' | 'locks' | 'owner'>;
    readonly uid?: number | undefined;
    readonly runner?: CommandRunner | undefined;
    readonly nodeExecutable?: string | undefined;
  }
>()('@porcelain/server/InstallerOptions') {}

type InstallerRequest =
  | { action: 'status' }
  | { action: 'install'; settings: InstallSettings }
  | { action: 'update'; allowDowngrade: boolean }
  | { action: 'recover' }
  | { action: 'uninstall' };

type InstallerOutcome =
  | { action: 'status'; status: ServiceStatus }
  | { action: 'install'; result: InstallOutcome }
  | { action: 'update'; result: UpdateOutcome }
  | { action: 'recover'; result: RecoveryOutcome }
  | { action: 'uninstall'; removed: boolean };

export class Installer extends Context.Service<
  Installer,
  {
    readonly execute: (
      request: InstallerRequest,
    ) => Effect.Effect<InstallerOutcome, InstallerError>;
  }
>()('@porcelain/server/Installer') {
  static readonly layer = Layer.effect(
    Installer,
    Effect.gen(function* () {
      const options = yield* InstallerOptions;
      const fs = yield* FileSystem.FileSystem;
      const pathApi = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const uid = options.uid ?? process.getuid?.();
      if (uid === undefined) return yield* Effect.fail(new NoUserIdError());
      if (uid === 0) return yield* Effect.fail(new RootUserError());
      const runner =
        options.runner ??
        (yield* commandRunner(options.limits.installer.command));
      const nodeExecutable = options.nodeExecutable ?? process.execPath;
      const context: InstallerContext = {
        paths: servicePaths(options.homeDirectory, pathApi),
        pathApi,
        runner,
        systemd: yield* openSystemdService(options.homeDirectory, uid, runner),
        packageRoot: options.packageRoot,
        packageVersion: options.packageVersion,
        nodeExecutable,
        searchPath: serviceSearchPath(
          nodeExecutable,
          options.searchPath,
          pathApi,
        ),
        ownerProbe: options.ownerProbe,
        clock: options.clock,
        limits: options.limits,
      };
      return Installer.of({
        execute: Effect.fn('Installer.execute')(
          function* (
            request,
          ): Effect.fn.Return<
            InstallerOutcome,
            InstallerError | Error | PlatformError,
            FileSystem.FileSystem | Path.Path | Scope
          > {
            yield* acquireDirectoryLock({
              path: pathApi.join(context.paths.root, 'management.lock'),
              waitMs: 0,
              pollMs: context.limits.locks.pollMs,
              staleTakeovers: context.limits.locks.staleTakeovers,
              clock: context.clock,
              held: () => new ManagementLockHeldError(),
            });
            switch (request.action) {
              case 'status':
                return {
                  action: 'status',
                  status: yield* readServiceStatus(context),
                };
              case 'install':
                return {
                  action: 'install',
                  result: yield* install(context, request.settings),
                };
              case 'update':
                return {
                  action: 'update',
                  result: yield* update(context, request.allowDowngrade),
                };
              case 'recover':
                return {
                  action: 'recover',
                  result: yield* recoverService(context),
                };
              case 'uninstall':
                return {
                  action: 'uninstall',
                  removed: yield* uninstall(context),
                };
            }
          },
          Effect.scoped,
          Effect.mapError((cause) =>
            isInstallerError(cause)
              ? cause
              : new InstallerOperationError({
                  message: failureDetail(cause),
                  cause,
                }),
          ),
          Effect.provideService(FileSystem.FileSystem, fs),
          Effect.provideService(Path.Path, pathApi),
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            spawner,
          ),
        ),
      });
    }),
  );
}
