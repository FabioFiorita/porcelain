import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  PairingRedemption,
  StoredPairingGrant,
} from '@porcelain/access/models';
import type { PairingGrantStore } from '@porcelain/access/ports';
import { devices } from '../../db/schema/devices.ts';
import { pairingGrants } from '../../db/schema/pairing-grants.ts';

type GrantRow = typeof pairingGrants.$inferSelect;

function storedGrant({
  redeemedAt,
  revokedAt,
  ...grant
}: GrantRow): StoredPairingGrant {
  return {
    ...grant,
    ...(redeemedAt === null ? {} : { redeemedAt }),
    ...(revokedAt === null ? {} : { revokedAt }),
  };
}

export class SqlitePairingGrantStore implements PairingGrantStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  add(input: { grants: readonly StoredPairingGrant[] }): void {
    const { grants } = input;
    if (grants.length === 0) return;
    this.db.transaction(
      (tx) => {
        tx.insert(pairingGrants)
          .values(
            grants.map((grant) => ({
              id: grant.id,
              label: grant.label,
              secretHash: grant.secretHash,
              addresses: grant.addresses,
              createdAt: grant.createdAt,
              expiresAt: grant.expiresAt,
              redeemedAt: grant.redeemedAt ?? null,
              revokedAt: grant.revokedAt ?? null,
            })),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  find(input: { grantId: string }): StoredPairingGrant | undefined {
    const row = this.db
      .select()
      .from(pairingGrants)
      .where(eq(pairingGrants.id, input.grantId))
      .get();
    return row ? storedGrant(row) : undefined;
  }

  list(): StoredPairingGrant[] {
    return this.db
      .select()
      .from(pairingGrants)
      .orderBy(asc(pairingGrants.createdAt))
      .all()
      .map(storedGrant);
  }

  markRevoked(input: { grant: StoredPairingGrant; revokedAt: string }): void {
    this.db.transaction(
      (tx) => {
        tx.update(pairingGrants)
          .set({ revokedAt: input.revokedAt })
          .where(eq(pairingGrants.id, input.grant.id))
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  redeem(input: PairingRedemption): void {
    const { device } = input;
    this.db.transaction(
      (tx) => {
        tx.update(pairingGrants)
          .set({ redeemedAt: input.redeemedAt })
          .where(eq(pairingGrants.id, input.grant.id))
          .run();
        tx.insert(devices)
          .values({
            id: device.id,
            label: device.label,
            platform: device.platform,
            secretHash: device.secretHash,
            createdAt: device.createdAt,
            lastSeenAt: device.lastSeenAt,
            lastSeenAddress: device.lastSeenAddress ?? null,
            revokedAt: device.revokedAt ?? null,
          })
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}
