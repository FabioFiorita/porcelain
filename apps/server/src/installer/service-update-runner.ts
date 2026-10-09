import { Cause, Effect, Exit, FileSystem, Path, Scope } from 'effect';
import type { ServiceUpdateRunner } from '../ports/service-update-runner.ts';
import { commandRunner, type CommandRunner } from './command-runner.ts';
import { UpdateHandOffError } from './errors/update-hand-off-error.ts';
import { failureDetail } from './failure-detail.ts';
import { exists, writeJsonFile } from './json-file.ts';
import { readPackageVersion } from './package-identity.ts';
import { servicePaths } from './paths.ts';
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

export const openServiceUpdateRunner = Effect.fn('openServiceUpdateRunner')(
  function* (options: ServiceUpdateRunnerOptions) {
    const fs = yield* FileSystem.FileSystem;
    const pathApi = yield* Path.Path;
    const paths = servicePaths(options.homeDirectory, pathApi);
    const runner = options.runner ?? (yield* commandRunner(options.command));
    const nodeExecutable = options.nodeExecutable ?? process.execPath;
    const scope = yield* Scope.make();
    let latest: { version: string | undefined; checkedAt: string } | undefined;
    let preparing = false;
    let closing = false;
    const provideFiles = <A, E>(
      effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>,
    ) =>
      effect.pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, pathApi),
      );
    const runningVersion = () => readPackageVersion(options.packageRoot);
    const updaterActive = Effect.fn('ServiceUpdate.updaterActive')(
      function* () {
        const state = yield* runner('systemctl', [
          '--user',
          'is-active',
          UPDATE_UNIT_NAME,
        ]);
        const answer = state.stdout.trim();
        return answer === 'active' || answer === 'activating';
      },
    );
    const latestVersion = Effect.fn('ServiceUpdate.latestVersion')(function* (
      input: ServiceUpdateCheck,
      running: boolean,
    ) {
      const known = latest;
      if (
        known !== undefined &&
        (running || known.checkedAt >= input.staleBefore)
      )
        return known.version;
      if (running) return undefined;
      const viewed = yield* runner('npm', [
        'view',
        PACKAGE_NAME,
        'version',
        '--json',
      ]);
      const version =
        viewed.code === 0 ? publishedVersion(viewed.stdout) : undefined;
      latest = { version, checkedAt: input.now };
      return version;
    });
    const prepareAndHandOff = Effect.fn('ServiceUpdate.prepareAndHandOff')(
      function* (target: string) {
        yield* installRuntime(
          runner,
          nodeExecutable,
          `${PACKAGE_NAME}@${target}`,
          paths.updater,
          target,
        );
        const handedOff = yield* runner(
          'systemd-run',
          updaterUnitArguments({
            nodeExecutable,
            entryPoint: runtimeEntryPoint(paths.updater, pathApi),
            searchPath: serviceSearchPath(
              nodeExecutable,
              options.searchPath,
              pathApi,
            ),
          }),
        );
        if (handedOff.code !== 0)
          return yield* Effect.fail(
            new UpdateHandOffError({ detail: handedOff.stderr.trim() }),
          );
      },
    );
    const updates = {
      read: Effect.fn('ServiceUpdate.read')(
        function* (input: ServiceUpdateCheck) {
          const version = yield* runningVersion();
          const managed =
            version !== undefined &&
            options.packageRoot ===
              pathApi.join(paths.runtime, 'node_modules', PACKAGE_NAME) &&
            (yield* exists(paths.installed));
          const running = preparing || (managed && (yield* updaterActive()));
          const published = managed
            ? yield* latestVersion(input, running)
            : undefined;
          return {
            managed,
            version,
            latest: published,
            available:
              published !== undefined &&
              version !== undefined &&
              (yield* compareVersions(published, version)) > 0,
            running,
            last: presentedUpdate(
              yield* readUpdateRecord(paths.updateRecord),
              running,
            ),
          };
        },
        provideFiles,
        Effect.orDie,
      ),
      start: Effect.fn('ServiceUpdate.start')(
        (input: ServiceUpdateTarget) =>
          Effect.uninterruptibleMask((restore) =>
            Effect.gen(function* () {
              if (closing) return yield* Effect.interrupt;
              const from = yield* restore(runningVersion());
              if (closing) return yield* Effect.interrupt;
              const progress = { from: from ?? '', target: input.version };
              yield* writeJsonFile(paths.updateRecord, {
                ...progress,
                stage: 'downloading',
              });
              preparing = true;
              const preparation = prepareAndHandOff(input.version).pipe(
                Effect.onExit((exit) =>
                  Exit.isSuccess(exit)
                    ? Effect.void
                    : writeJsonFile(paths.updateRecord, {
                        ...progress,
                        stage: 'failed',
                        reason: Cause.hasInterruptsOnly(exit.cause)
                          ? 'The server stopped before the update was handed off.'
                          : failureDetail(Cause.squash(exit.cause)),
                      }).pipe(Effect.ignoreCause),
                ),
                Effect.ensuring(
                  Effect.sync(() => {
                    preparing = false;
                  }),
                ),
                provideFiles,
              );
              yield* Effect.forkIn(preparation, scope, {
                startImmediately: true,
              });
            }),
          ),
        provideFiles,
        Effect.orDie,
      ),
      close: Effect.fn('ServiceUpdate.close')(() =>
        Effect.sync(() => {
          closing = true;
        }).pipe(Effect.andThen(Scope.close(scope, Exit.void))),
      ),
    } satisfies ServiceUpdateRunner;
    const awaitUpdate = Effect.fn('ServiceUpdate.awaitUpdate')(
      function* (pollMs: number) {
        while (preparing || (yield* updaterActive()))
          yield* Effect.sleep(pollMs);
        return presentedUpdate(
          yield* readUpdateRecord(paths.updateRecord),
          false,
        );
      },
      provideFiles,
      Effect.orDie,
    );
    return { ...updates, awaitUpdate };
  },
);

export type ServiceUpdates = Effect.Success<
  ReturnType<typeof openServiceUpdateRunner>
>;
