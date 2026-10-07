import { InstallerOperationError } from './installer-operation-error.ts';
import { Schema } from 'effect';
import { AlreadyInstalledError } from './already-installed-error.ts';
import { AppManagedUpdateError } from './app-managed-update-error.ts';
import { DataDirectoryBusyError } from './data-directory-busy-error.ts';
import { InstallCleanupError } from './install-cleanup-error.ts';
import { InstalledServiceUnhealthyError } from './installed-service-unhealthy-error.ts';
import { InterruptedUpdateUnrecoverableError } from './interrupted-update-unrecoverable-error.ts';
import { InvalidInstalledRecordError } from './invalid-installed-record-error.ts';
import { InvalidPackageVersionError } from './invalid-package-version-error.ts';
import { InvalidServiceConfigurationError } from './invalid-service-configuration-error.ts';
import { InvalidUpdateJournalError } from './invalid-update-journal-error.ts';
import { ManagementLockHeldError } from './management-lock-held-error.ts';
import { NoUserIdError } from './no-user-id-error.ts';
import { NotInstalledError } from './not-installed-error.ts';
import { NotPackagedCliError } from './not-packaged-cli-error.ts';
import { PreviousServiceUnhealthyError } from './previous-service-unhealthy-error.ts';
import { RestoredServiceUnhealthyError } from './restored-service-unhealthy-error.ts';
import { RootUserError } from './root-user-error.ts';
import { RuntimeInstallError } from './runtime-install-error.ts';
import { RuntimeNativeModulesError } from './runtime-native-modules-error.ts';
import { RuntimeVersionMismatchError } from './runtime-version-mismatch-error.ts';
import { ServiceCommandFailedError } from './service-command-failed-error.ts';
import { ServiceDowngradeError } from './service-downgrade-error.ts';
import { ServiceStillActiveError } from './service-still-active-error.ts';
import { UnitExistsError } from './unit-exists-error.ts';
import { UnrecognizedUnitError } from './unrecognized-unit-error.ts';
import { UpdateFailedError } from './update-failed-error.ts';
import { UpdateHandOffError } from './update-hand-off-error.ts';
import { UpdateRecoveryError } from './update-recovery-error.ts';
import { UpdateRestartError } from './update-restart-error.ts';
import { UpdatedServiceUnhealthyError } from './updated-service-unhealthy-error.ts';

const installerErrorSchema = Schema.Union([
  InstallerOperationError,
  AlreadyInstalledError,
  AppManagedUpdateError,
  DataDirectoryBusyError,
  InstallCleanupError,
  InstalledServiceUnhealthyError,
  InterruptedUpdateUnrecoverableError,
  InvalidInstalledRecordError,
  InvalidPackageVersionError,
  InvalidServiceConfigurationError,
  InvalidUpdateJournalError,
  ManagementLockHeldError,
  NoUserIdError,
  NotInstalledError,
  NotPackagedCliError,
  PreviousServiceUnhealthyError,
  RestoredServiceUnhealthyError,
  RootUserError,
  RuntimeInstallError,
  RuntimeNativeModulesError,
  RuntimeVersionMismatchError,
  ServiceCommandFailedError,
  ServiceDowngradeError,
  ServiceStillActiveError,
  UnitExistsError,
  UnrecognizedUnitError,
  UpdateFailedError,
  UpdateHandOffError,
  UpdateRecoveryError,
  UpdateRestartError,
  UpdatedServiceUnhealthyError,
]);
export type InstallerError = typeof installerErrorSchema.Type;
export const isInstallerError = Schema.is(installerErrorSchema);
