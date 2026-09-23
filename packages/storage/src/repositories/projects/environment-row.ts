import { randomUUID } from 'node:crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { environments } from '../../db/schema/environments.ts';

export function insertEnvironmentRow(db: BetterSQLite3Database): void {
  db.insert(environments)
    .values({ singleton: 1, id: randomUUID() })
    .onConflictDoNothing()
    .run();
}
