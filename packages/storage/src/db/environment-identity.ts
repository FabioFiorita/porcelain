import { randomUUID } from 'node:crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { environment } from './schema/environment.ts';

export function createEnvironmentIdentity(db: BetterSQLite3Database): void {
  db.transaction(
    (tx) => {
      tx.insert(environment)
        .values({ singleton: 1, id: randomUUID() })
        .onConflictDoNothing()
        .run();
    },
    { behavior: 'immediate' },
  );
}
