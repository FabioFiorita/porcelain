import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { EnvironmentIdentityStore } from '@porcelain/access/ports';
import { environments } from '../../db/schema/environments.ts';
import { MissingEnvironmentIdentityError } from '../../models/missing-environment-identity-error.ts';

export class EnvironmentIdentityRepository implements EnvironmentIdentityStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  environmentId(): string {
    const environment = this.db.select().from(environments).get();
    if (!environment) throw new MissingEnvironmentIdentityError();
    return environment.id;
  }
}
