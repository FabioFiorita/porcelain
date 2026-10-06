import { InstallerError } from './installer-error.ts';

export class RuntimeNativeModulesError extends InstallerError {
  override readonly name = 'RuntimeNativeModulesError';
  constructor(detail: string) {
    super(
      `The persistent runtime cannot load its native modules (node:sqlite, @parcel/watcher): ${detail}`,
    );
  }
}
