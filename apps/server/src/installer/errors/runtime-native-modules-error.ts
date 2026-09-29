import { InstallerError } from './installer-error.ts';

export class RuntimeNativeModulesError extends InstallerError {
  override readonly name = 'RuntimeNativeModulesError';
  constructor(detail: string) {
    super(
      `The persistent runtime cannot load its native modules (better-sqlite3, @parcel/watcher): ${detail}`,
    );
  }
}
