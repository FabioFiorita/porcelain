export { openInstaller, type InstallerOptions } from './installer.ts';
export {
  readPackageIdentity,
  type PackageIdentity,
} from './package-identity.ts';
export type { InstallOutcome, InstallSettings } from './install.ts';
export type { UpdateOutcome } from './update.ts';
export type { ServiceStatus } from './status.ts';
export type { ServiceConfiguration } from './records.ts';
export type { OwnerProbe, OwnerProbeResult } from './service-health.ts';
export type { CommandRunner } from './command-runner.ts';
export { ServiceDowngradeError } from './errors/service-downgrade-error.ts';
