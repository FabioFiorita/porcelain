import { join } from 'node:path';
import type { Limits } from '../config/limits.ts';
import type { ServiceUpdateRunner } from '../ports/service-update-runner.ts';
import { commandRunner, type CommandRunner } from './command-runner.ts';
import { UpdateHandOffError } from './errors/update-hand-off-error.ts';
import { failureDetail } from './failure-detail.ts';
import { exists, writeJsonFile } from './json-file.ts';
import { readPackageIdentity } from './package-identity.ts';
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
import { NotPackagedCliError } from './errors/not-packaged-cli-error.ts';

type ServiceUpdateState = Awaited<ReturnType<ServiceUpdateRunner['read']>>;
type ServiceUpdateTarget = Parameters<ServiceUpdateRunner['start']>[0];

type ServiceUpdateRunnerOptions = {
  homeDirectory: string;
  packageRoot: string;
  searchPath: string;
  limits: Limits;
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
  private latest: string | undefined;
  private preparing = false;

  constructor(options: ServiceUpdateRunnerOptions) {
    this.options = options;
    this.paths = servicePaths(options.homeDirectory);
    this.runner =
      options.runner ?? commandRunner(options.limits.installer.command);
    this.nodeExecutable = options.nodeExecutable ?? process.execPath;
  }

  async read(): Promise<ServiceUpdateState> {
    const version = await this.runningVersion();
    const managed = version !== undefined && (await this.managed());
    const running = this.preparing || (managed && (await this.updaterActive()));
    const latest = managed ? await this.latestVersion(running) : undefined;
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

  async start(input: ServiceUpdateTarget): Promise<void> {
    const from = await this.runningVersion();
    this.preparing = true;
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

  private async runningVersion(): Promise<string | undefined> {
    try {
      return (await readPackageIdentity(this.options.packageRoot))
        .packageVersion;
    } catch (error) {
      if (error instanceof NotPackagedCliError) return undefined;
      throw error;
    }
  }

  private async managed(): Promise<boolean> {
    return (
      this.options.packageRoot ===
        join(this.paths.runtime, 'node_modules', PACKAGE_NAME) &&
      (await exists(this.paths.installed))
    );
  }

  private async latestVersion(running: boolean): Promise<string | undefined> {
    if (running) return this.latest;
    const viewed = await this.runner('npm', [
      'view',
      PACKAGE_NAME,
      'version',
      '--json',
    ]);
    this.latest =
      viewed.code === 0 ? publishedVersion(viewed.stdout) : undefined;
    return this.latest;
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
