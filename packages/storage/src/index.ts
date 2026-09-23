export { openStorageSession, type StorageOptions } from './db/connection.ts';
export type { StorageSession } from './db/session.ts';
export { InvalidDataDirectoryError } from './models/invalid-data-directory-error.ts';
export { MissingEnvironmentIdentityError } from './models/missing-environment-identity-error.ts';
export { UnsupportedDatabaseVersionError } from './models/unsupported-database-version-error.ts';
