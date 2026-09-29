import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { RemoteAccessSettings } from '@porcelain/access/models';
import type { RemoteAccessStore } from '@porcelain/access/ports';
import { remoteAccess } from '../../db/schema/remote-access.ts';

export class SqliteRemoteAccessStore implements RemoteAccessStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  read(): RemoteAccessSettings {
    const row = this.db.select().from(remoteAccess).get();
    if (!row) return { lan: false, tailnet: false, cloudflare: false };
    return {
      lan: row.lan,
      ...(row.lanInterface === null || row.lanSubnet === null
        ? {}
        : {
            lanNetwork: {
              interfaceName: row.lanInterface,
              subnet: row.lanSubnet,
            },
          }),
      tailnet: row.tailnet,
      ...(row.tailnetServeTarget === null
        ? {}
        : { tailnetServeTarget: row.tailnetServeTarget }),
      cloudflare: row.cloudflare,
      ...(row.cloudflareHostname === null
        ? {}
        : { cloudflareHostname: row.cloudflareHostname }),
    };
  }

  save(input: RemoteAccessSettings): void {
    const row = {
      lan: input.lan,
      lanInterface: input.lanNetwork?.interfaceName ?? null,
      lanSubnet: input.lanNetwork?.subnet ?? null,
      tailnet: input.tailnet,
      tailnetServeTarget: input.tailnetServeTarget ?? null,
      cloudflare: input.cloudflare,
      cloudflareHostname: input.cloudflareHostname ?? null,
    };
    this.db
      .insert(remoteAccess)
      .values({ singleton: 1, ...row })
      .onConflictDoUpdate({ target: remoteAccess.singleton, set: row })
      .run();
  }
}
