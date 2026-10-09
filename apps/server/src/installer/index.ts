export { Installer, InstallerOptions } from './installer.ts';
export { readPackageIdentity, readPackageVersion } from './package-identity.ts';
export { openServiceUpdateRunner } from './service-update-runner.ts';
export { openAppManagedUpdateRunner } from './app-managed-update-runner.ts';
export type { CommandOutcome } from './porcelain-command.ts';
export type { ServiceStatus } from './status.ts';
export { isInstallerError } from './errors/installer-error.ts';
