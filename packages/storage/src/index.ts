export { openStorageSession } from './db/connection.ts';
export { databaseFiles } from './db/database-files.ts';
export type { StorageSession } from './db/session.ts';
export { InvalidDataDirectoryError } from './errors/invalid-data-directory-error.ts';
export { UnsupportedDatabaseVersionError } from './errors/unsupported-database-version-error.ts';
