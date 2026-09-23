import { parseCredential, secretMatches } from '@porcelain/access/models';
import type {
  DeviceStore,
  LastSeen,
  StoredDevice,
} from '@porcelain/access/ports';

export const UNUSED_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

type Entry = {
  secretHash: string;
  createdAt: number;
  lastSeenAt: number;
  lastSeenAddress: string | null;
  revoked: boolean;
  dirty: boolean;
};

export type LiveConnection = { close(): void };

export type DeviceAuthentication = { deviceId: string; idleMs: number };

export class DeviceDirectory {
  private readonly store: DeviceStore;
  private readonly entries = new Map<string, Entry>();
  private readonly connections = new Map<string, Set<LiveConnection>>();
  private readonly now: () => number;

  constructor(store: DeviceStore, now: () => number = Date.now) {
    this.store = store;
    this.now = now;
    for (const device of store.allDevices()) this.remember(device);
  }

  private remember(device: StoredDevice): void {
    this.entries.set(device.id, {
      secretHash: device.secretHash,
      createdAt: Date.parse(device.createdAt),
      lastSeenAt: Date.parse(device.lastSeenAt),
      lastSeenAddress: device.lastSeenAddress,
      revoked: device.revokedAt !== undefined,
      dirty: false,
    });
  }

  add(device: StoredDevice): void {
    this.remember(device);
  }

  authenticate(
    credential: string,
    address: string | null,
  ): DeviceAuthentication | null {
    const parsed = parseCredential('pcd', credential);
    if (!parsed) return null;
    const entry = this.entries.get(parsed.id);
    if (!entry || entry.revoked) return null;
    if (!secretMatches(entry.secretHash, parsed.secret)) return null;
    const now = this.now();
    if (now - entry.lastSeenAt >= UNUSED_LIFETIME_MS) return null;
    if (entry.createdAt > now || entry.lastSeenAt > now) return null;
    const idleMs = now - entry.lastSeenAt;
    if (now > entry.lastSeenAt) {
      entry.lastSeenAt = now;
      entry.lastSeenAddress = address;
      entry.dirty = true;
    }
    return { deviceId: parsed.id, idleMs };
  }

  lastSeenAt(deviceId: string): number | null {
    return this.entries.get(deviceId)?.lastSeenAt ?? null;
  }

  register(deviceId: string, connection: LiveConnection): () => void {
    const live = this.connections.get(deviceId) ?? new Set<LiveConnection>();
    live.add(connection);
    this.connections.set(deviceId, live);
    return () => {
      live.delete(connection);
      if (live.size === 0) this.connections.delete(deviceId);
    };
  }

  revoke(deviceId: string, now: string): boolean {
    const removed = this.store.revokeDevice(deviceId, now);
    const entry = this.entries.get(deviceId);
    if (entry) {
      entry.revoked = true;
      entry.dirty = false;
    }
    for (const connection of this.connections.get(deviceId) ?? [])
      connection.close();
    this.connections.delete(deviceId);
    return removed;
  }

  flush(): void {
    const pending: LastSeen[] = [];
    for (const [deviceId, entry] of this.entries) {
      if (!entry.dirty || entry.revoked) continue;
      pending.push({
        deviceId,
        lastSeenAt: new Date(entry.lastSeenAt).toISOString(),
        lastSeenAddress: entry.lastSeenAddress,
      });
      entry.dirty = false;
    }
    this.store.recordLastSeen(pending);
  }
}
