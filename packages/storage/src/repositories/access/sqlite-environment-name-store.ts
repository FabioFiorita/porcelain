import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { ChosenEnvironmentName } from '@porcelain/access/models';
import type { EnvironmentNameStore } from '@porcelain/access/ports';
import { environmentName } from '../../db/schema/environment-name.ts';

export class SqliteEnvironmentNameStore implements EnvironmentNameStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  read(): ChosenEnvironmentName {
    return { name: this.db.select().from(environmentName).get()?.name };
  }

  save(input: ChosenEnvironmentName): void {
    const { name } = input;
    if (name === undefined) {
      this.db.delete(environmentName).run();
      return;
    }
    this.db
      .insert(environmentName)
      .values({ singleton: 1, name })
      .onConflictDoUpdate({ target: environmentName.singleton, set: { name } })
      .run();
  }
}
