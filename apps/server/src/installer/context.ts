import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import type { CommandRunner } from './command-runner.ts';
import type { ServicePaths } from './paths.ts';
import { runtimeEntryPoint } from './persistent-runtime.ts';
import type { ServiceConfiguration } from './records.ts';
import type { Clock } from '@porcelain/kernel/ports';
import type { OwnerProbe } from '../ports/owner-probe.ts';
import { waitForHealthyService } from './service-health.ts';
import type { SystemdService } from './systemd-service.ts';
import type { ServicePlan } from './systemd-unit.ts';

export type InstallerContext = {
  paths: ServicePaths;
  runner: CommandRunner;
  systemd: SystemdService;
  packageRoot: string;
  packageVersion: string;
  nodeExecutable: string;
  searchPath: string;
  ownerProbe: OwnerProbe;
  clock: Clock;
};

export function servicePlan(
  context: InstallerContext,
  configuration: ServiceConfiguration,
): ServicePlan {
  return {
    nodeExecutable: context.nodeExecutable,
    entryPoint: runtimeEntryPoint(context.paths.runtime),
    dataDirectory: configuration.dataDirectory,
    host: configuration.host,
    port: configuration.port,
    allowedHosts: configuration.allowedHosts,
    stdoutLog: context.paths.stdoutLog,
    stderrLog: context.paths.stderrLog,
    searchPath: context.searchPath,
  };
}

export function serviceIsHealthy(
  context: InstallerContext,
  dataDirectory: string,
): Promise<boolean> {
  return waitForHealthyService({
    ownerProbe: context.ownerProbe,
    socketPath: ownerSocketPath(dataDirectory),
    dataDirectory,
    processId: () => context.systemd.processId(),
  });
}
