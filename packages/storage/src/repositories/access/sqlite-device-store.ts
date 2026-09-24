import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { DeviceSighting, StoredDevice } from '@porcelain/access/models';
import type { DeviceStore } from '@porcelain/access/ports';
import { devices } from '../../db/schema/devices.ts';

type DeviceRow = typeof devices.$inferSelect;

function storedDevice({
  lastSeenAddress,
  revokedAt,
  ...device
}: DeviceRow): StoredDevice {
  return {
    ...device,
    ...(lastSeenAddress === null ? {} : { lastSeenAddress }),
    ...(revokedAt === null ? {} : { revokedAt }),
  };
}

export class SqliteDeviceStore implements DeviceStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  find(deviceId: string): StoredDevice | undefined {
    const row = this.db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .get();
    return row ? storedDevice(row) : undefined;
  }

  list(): StoredDevice[] {
    return this.db
      .select()
      .from(devices)
      .orderBy(asc(devices.createdAt))
      .all()
      .map(storedDevice);
  }

  markRevoked(deviceId: string, revokedAt: string): void {
    this.db.transaction(
      (tx) => {
        tx.update(devices)
          .set({ revokedAt })
          .where(eq(devices.id, deviceId))
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  recordSightings(sightings: readonly DeviceSighting[]): void {
    if (sightings.length === 0) return;
    this.db.transaction(
      (tx) => {
        for (const sighting of sightings)
          tx.update(devices)
            .set({
              lastSeenAt: sighting.seenAt,
              lastSeenAddress: sighting.address ?? null,
            })
            .where(eq(devices.id, sighting.deviceId))
            .run();
      },
      { behavior: 'immediate' },
    );
  }
}
