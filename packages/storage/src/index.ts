export { openStorageSession, type StorageOptions } from './db/connection.ts';
export { databaseFiles } from './db/database-files.ts';
export type { StorageSession } from './db/session.ts';
export { InvalidDataDirectoryError } from './models/invalid-data-directory-error.ts';
export { UnsupportedDatabaseVersionError } from './models/unsupported-database-version-error.ts';
