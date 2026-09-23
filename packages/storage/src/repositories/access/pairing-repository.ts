import { and, asc, eq, gt, isNull, lte } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { devices } from '../../db/schema/devices.ts';
import { pairingGrants } from '../../db/schema/pairing-grants.ts';
import { secretMatches } from '@porcelain/access/models';
import type { Device, PairingGrant } from '@porcelain/access/models';
import type {
  DeviceRecord,
  GrantRecord,
  PairingGrantStore,
  DeviceStore,
  StoredDevice,
  LastSeen,
} from '@porcelain/access/ports';

export class PairingRepository implements PairingGrantStore, DeviceStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  issueGrant(record: GrantRecord): void {
    this.db
      .insert(pairingGrants)
      .values({
        id: record.id,
        label: record.label,
        secretHash: record.secretHash,
        addresses: record.addresses,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
      })
      .run();
  }

  listGrants(now: string): PairingGrant[] {
    return this.db
      .select({
        id: pairingGrants.id,
        label: pairingGrants.label,
        addresses: pairingGrants.addresses,
        createdAt: pairingGrants.createdAt,
        expiresAt: pairingGrants.expiresAt,
      })
      .from(pairingGrants)
      .where(
        and(
          isNull(pairingGrants.redeemedAt),
          isNull(pairingGrants.revokedAt),
          gt(pairingGrants.expiresAt, now),
        ),
      )
      .orderBy(asc(pairingGrants.createdAt))
      .all();
  }

  revokeGrant(id: string, now: string): boolean {
    const result = this.db
      .update(pairingGrants)
      .set({ revokedAt: now })
      .where(
        and(
          eq(pairingGrants.id, id),
          isNull(pairingGrants.redeemedAt),
          isNull(pairingGrants.revokedAt),
        ),
      )
      .run();
    return result.changes === 1;
  }

  redeem(input: {
    grantId: string;
    secret: string;
    now: string;
    device: DeviceRecord;
  }): Device | undefined {
    return this.db.transaction(
      () => {
        const grant = this.db
          .select({
            secretHash: pairingGrants.secretHash,
            label: pairingGrants.label,
          })
          .from(pairingGrants)
          .where(eq(pairingGrants.id, input.grantId))
          .get();
        if (!grant || !secretMatches(grant.secretHash, input.secret))
          return undefined;
        const consumed = this.db
          .update(pairingGrants)
          .set({ redeemedAt: input.now })
          .where(
            and(
              eq(pairingGrants.id, input.grantId),
              isNull(pairingGrants.redeemedAt),
              isNull(pairingGrants.revokedAt),
              gt(pairingGrants.expiresAt, input.now),
              lte(pairingGrants.createdAt, input.now),
            ),
          )
          .run();
        if (consumed.changes !== 1) return undefined;
        const record = {
          id: input.device.id,
          label: input.device.label || grant.label,
          platform: input.device.platform,
          secretHash: input.device.secretHash,
          createdAt: input.device.createdAt,
          lastSeenAt: input.device.createdAt,
          lastSeenAddress: null,
        };
        this.db.insert(devices).values(record).run();
        const { secretHash: _secretHash, ...device } = record;
        return device;
      },
      { behavior: 'immediate' },
    );
  }

  listDevices(): Device[] {
    return this.db
      .select({
        id: devices.id,
        label: devices.label,
        platform: devices.platform,
        createdAt: devices.createdAt,
        lastSeenAt: devices.lastSeenAt,
        lastSeenAddress: devices.lastSeenAddress,
      })
      .from(devices)
      .where(isNull(devices.revokedAt))
      .orderBy(asc(devices.createdAt))
      .all();
  }

  allDevices(): StoredDevice[] {
    return this.db
      .select()
      .from(devices)
      .all()
      .map(({ revokedAt, ...device }) => ({
        ...device,
        ...(revokedAt === null ? {} : { revokedAt }),
      }));
  }

  revokeDevice(id: string, now: string): boolean {
    const result = this.db
      .update(devices)
      .set({ revokedAt: now })
      .where(and(eq(devices.id, id), isNull(devices.revokedAt)))
      .run();
    return result.changes === 1;
  }

  recordLastSeen(entries: LastSeen[]): void {
    if (entries.length === 0) return;
    this.db.transaction(() => {
      for (const entry of entries)
        this.db
          .update(devices)
          .set({
            lastSeenAt: entry.lastSeenAt,
            lastSeenAddress: entry.lastSeenAddress,
          })
          .where(and(eq(devices.id, entry.deviceId), isNull(devices.revokedAt)))
          .run();
    });
  }
}
