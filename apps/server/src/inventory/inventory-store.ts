import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Inventory, Project } from './inventory.ts';

export function openInventoryStore(dataDirectory: string) {
  if (!isAbsolute(dataDirectory))
    throw new Error('An absolute data directory is required');
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(join(dataDirectory, 'inventory.sqlite'));
  try {
    database.exec(
      'PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;',
    );
    database.exec('BEGIN IMMEDIATE');
    const version = database.prepare('PRAGMA user_version').get()?.user_version;
    if (version !== 0 && version !== 1)
      throw new Error('Unsupported inventory database version');
    database.exec(`
      CREATE TABLE IF NOT EXISTS environment (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, repository_identity TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
    `);
    database
      .prepare('INSERT OR IGNORE INTO environment VALUES (1, ?)')
      .run(randomUUID());
    database.exec('PRAGMA user_version = 1; COMMIT');
  } catch (error) {
    database.close();
    throw error;
  }
  return {
    read(): Inventory {
      const environmentId = database
        .prepare('SELECT id FROM environment')
        .get()?.id;
      if (typeof environmentId !== 'string')
        throw new Error('Missing environment identity');
      const projects = database
        .prepare('SELECT data FROM projects ORDER BY rowid')
        .all()
        .map((row) => {
          if (typeof row.data !== 'string')
            throw new Error('Invalid project record');
          return JSON.parse(row.data) as Project;
        });
      return { environmentId, projects };
    },
    save(project: Project): void {
      database
        .prepare(
          'INSERT INTO projects VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET repository_identity = excluded.repository_identity, data = excluded.data',
        )
        .run(project.id, project.repositoryIdentity, JSON.stringify(project));
    },
    close(): void {
      database.close();
    },
  };
}
