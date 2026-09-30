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

type ServiceUpdateState = Awaited<ReturnType<ServiceUpdateRunner['read']>>;
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

  constructor(options: ServiceUpdateRunnerOptions) {
    this.options = options;
    this.paths = servicePaths(options.homeDirectory);
    this.runner = options.runner ?? commandRunner(options.command);
    this.nodeExecutable = options.nodeExecutable ?? process.execPath;
  }

  async read(
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

  async start(input: ServiceUpdateTarget, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    this.preparing = true;
    const from = await this.runningVersion().catch((error: unknown) => {
      this.preparing = false;
      throw error;
    });
    const progress = { from: from ?? '', target: input.version };
    try {
      await writeJsonFile(this.paths.updateRecord, {
        ...progress,
        stage: 'downloading',
      });
    } catch (error) {
      this.preparing = false;
      throw error;
    }
    void this.prepareAndHandOff(input.version)
      .catch((error: unknown) =>
        writeJsonFile(this.paths.updateRecord, {
          ...progress,
          stage: 'failed',
          reason: failureDetail(error),
        }),
      )
      .catch(() => undefined)
      .finally(() => {
        this.preparing = false;
      });
  }

  private async prepareAndHandOff(target: string): Promise<void> {
    await installRuntime(
      this.runner,
      this.nodeExecutable,
      `${PACKAGE_NAME}@${target}`,
      this.paths.updater,
      target,
    );
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
    );
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
