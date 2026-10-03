export const DATABASE_FILE = 'inventory.sqlite';

export const databaseFiles: readonly string[] = [
  DATABASE_FILE,
  `${DATABASE_FILE}-wal`,
  `${DATABASE_FILE}-shm`,
];
