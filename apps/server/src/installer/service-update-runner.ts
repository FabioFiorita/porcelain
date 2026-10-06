import { Cause, Effect, Exit, Scope } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import { join } from 'node:path';
import type { ServiceUpdateRunner } from '../ports/service-update-runner.ts';
import { commandRunner, type CommandRunner } from './command-runner.ts';
import { UpdateHandOffError } from './errors/update-hand-off-error.ts';
import { failureDetail } from './failure-detail.ts';
import { exists, writeJsonFile } from './json-file.ts';
import { readPackageVersion } from './package-identity.ts';
import { servicePaths, type ServicePaths } from './paths.ts';
import {
  installRuntime,
  PACKAGE_NAME,
  runtimeEntryPoint,
} from './persistent-runtime.ts';
import { readUpdateRecord } from './records.ts';
import { presentedUpdate, publishedVersion } from './update-record.ts';
import { serviceSearchPath } from './search-path.ts';
import { UPDATE_UNIT_NAME } from './systemd-unit.ts';
import { updaterUnitArguments } from './updater-unit.ts';
import { compareVersions } from './version-policy.ts';

type ServiceUpdateState = Effect.Success<
  ReturnType<ServiceUpdateRunner['read']>
>;
type ServiceUpdateCheck = Parameters<ServiceUpdateRunner['read']>[0];
type ServiceUpdateTarget = Parameters<ServiceUpdateRunner['start']>[0];

type ServiceUpdateRunnerOptions = {
  homeDirectory: string;
  packageRoot: string;
  searchPath: string;
  command: Parameters<typeof commandRunner>[0];
  nodeExecutable?: string | undefined;
  runner?: CommandRunner | undefined;
};

function newer(latest: string | undefined, version: string | undefined) {
  return (
    latest !== undefined &&
    version !== undefined &&
    compareVersions(latest, version) > 0
  );
}

class InstalledServiceUpdateRunner implements ServiceUpdateRunner {
  private readonly paths: ServicePaths;
  private readonly options: ServiceUpdateRunnerOptions;
  private readonly runner: CommandRunner;
  private readonly nodeExecutable: string;
  private latest:
    | { version: string | undefined; checkedAt: string }
    | undefined;
  private preparing = false;
  private readonly scope = Scope.makeUnsafe();
  private closing = false;

  constructor(options: ServiceUpdateRunnerOptions) {
    this.options = options;
    this.paths = servicePaths(options.homeDirectory);
    this.runner = options.runner ?? commandRunner(options.command);
    this.nodeExecutable = options.nodeExecutable ?? process.execPath;
  }

  read(input: ServiceUpdateCheck): Effect.Effect<ServiceUpdateState> {
    return nativeOperation((signal) => this.readNative(input, signal));
  }

  private async readNative(
    input: ServiceUpdateCheck,
    signal?: AbortSignal,
  ): Promise<ServiceUpdateState> {
    const version = await this.runningVersion();
    const managed = version !== undefined && (await this.managed());
    const running = this.preparing || (managed && (await this.updaterActive()));
    const latest = managed
      ? await this.latestVersion(input, running, signal)
      : undefined;
    return {
      managed,
      version,
      latest,
      available: newer(latest, version),
      running,
      last: presentedUpdate(
        await readUpdateRecord(this.paths.updateRecord),
        running,
      ),
    };
  }

  start(input: ServiceUpdateTarget): Effect.Effect<void> {
    return Effect.uninterruptibleMask((restore) =>
      Effect.gen({ self: this }, function* () {
        if (this.closing) return yield* Effect.interrupt;
        const from = yield* restore(
          nativeOperation(() => this.runningVersion()),
        );
        if (this.closing) return yield* Effect.interrupt;
        const progress = { from: from ?? '', target: input.version };
        yield* nativeOperation(() =>
          writeJsonFile(this.paths.updateRecord, {
            ...progress,
            stage: 'downloading',
          }),
        );
        this.preparing = true;
        const preparation = nativeOperation((signal) =>
          this.prepareAndHandOff(input.version, signal),
        ).pipe(
          Effect.onExit((exit) =>
            Exit.isSuccess(exit)
              ? Effect.void
              : nativeOperation(() =>
                  writeJsonFile(this.paths.updateRecord, {
                    ...progress,
                    stage: 'failed',
                    reason: Cause.hasInterruptsOnly(exit.cause)
                      ? 'The server stopped before the update was handed off.'
                      : failureDetail(Cause.squash(exit.cause)),
                  }),
                ).pipe(Effect.ignoreCause),
          ),
          Effect.ensuring(
            Effect.sync(() => {
              this.preparing = false;
            }),
          ),
        );
        yield* Effect.forkIn(preparation, this.scope, {
          startImmediately: true,
        });
      }),
    );
  }

  close(): Effect.Effect<void> {
    return Effect.sync(() => {
      this.closing = true;
    }).pipe(Effect.andThen(Scope.close(this.scope, Exit.void)));
  }

  private async prepareAndHandOff(
    target: string,
    signal: AbortSignal,
  ): Promise<void> {
    await installRuntime(
      this.runner,
      this.nodeExecutable,
      `${PACKAGE_NAME}@${target}`,
      this.paths.updater,
      target,
      signal,
    );
    signal.throwIfAborted();
    const handedOff = await this.runner(
      'systemd-run',
      updaterUnitArguments({
        nodeExecutable: this.nodeExecutable,
        entryPoint: runtimeEntryPoint(this.paths.updater),
        searchPath: serviceSearchPath(
          this.nodeExecutable,
          this.options.searchPath,
        ),
      }),
      { signal },
    );
    signal.throwIfAborted();
    if (handedOff.code !== 0)
      throw new UpdateHandOffError(handedOff.stderr.trim());
  }

  private runningVersion(): Promise<string | undefined> {
    return readPackageVersion(this.options.packageRoot);
  }

  private async managed(): Promise<boolean> {
    return (
      this.options.packageRoot ===
        join(this.paths.runtime, 'node_modules', PACKAGE_NAME) &&
      (await exists(this.paths.installed))
    );
  }

  private async latestVersion(
    input: ServiceUpdateCheck,
    running: boolean,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    const known = this.latest;
    if (
      known !== undefined &&
      (running || known.checkedAt >= input.staleBefore)
    )
      return known.version;
    if (running) return undefined;
    const viewed = await this.runner(
      'npm',
      ['view', PACKAGE_NAME, 'version', '--json'],
      { signal },
    );
    signal?.throwIfAborted();
    const version =
      viewed.code === 0 ? publishedVersion(viewed.stdout) : undefined;
    this.latest = { version, checkedAt: input.now };
    return version;
  }

  private async updaterActive(): Promise<boolean> {
    const state = await this.runner('systemctl', [
      '--user',
      'is-active',
      UPDATE_UNIT_NAME,
    ]);
    const answer = state.stdout.trim();
    return answer === 'active' || answer === 'activating';
  }
}

export function openServiceUpdateRunner(
  options: ServiceUpdateRunnerOptions,
): ServiceUpdateRunner {
  return new InstalledServiceUpdateRunner(options);
}
