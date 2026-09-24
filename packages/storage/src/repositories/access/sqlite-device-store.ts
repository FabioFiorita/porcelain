import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { StoredDevice } from '@porcelain/access/models';
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

  find(input: { deviceId: string }): StoredDevice | undefined {
    const row = this.db
      .select()
      .from(devices)
      .where(eq(devices.id, input.deviceId))
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

  markRevoked(input: { device: StoredDevice; revokedAt: string }): void {
    this.db.transaction(
      (tx) => {
        tx.update(devices)
          .set({ revokedAt: input.revokedAt })
          .where(eq(devices.id, input.device.id))
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  recordSighting(input: { device: StoredDevice }): void {
    this.db.transaction(
      (tx) => {
        tx.update(devices)
          .set({
            lastSeenAt: input.device.lastSeenAt,
            lastSeenAddress: input.device.lastSeenAddress ?? null,
          })
          .where(eq(devices.id, input.device.id))
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}
