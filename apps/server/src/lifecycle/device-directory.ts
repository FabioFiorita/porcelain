import { parseCredential, secretMatches } from '../models/credential.ts';
import type {
  LastSeen,
  PairingStore,
  StoredDevice,
} from '../repositories/interfaces/pairing-store.ts';

/** 90 days without a request and a credential stops working. */
export const UNUSED_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

type Entry = {
  secretHash: string;
  createdAt: number;
  lastSeenAt: number;
  lastSeenAddress: string | null;
  revoked: boolean;
  dirty: boolean;
};

/** Something holding a response open for a device that may be revoked. */
export type LiveConnection = { close(): void };

/**
 * Who authenticated, and how long they had been away before this request. The
 * idle time has to come back with the answer: reading it afterwards would
 * always be zero, because authenticating is what moves last seen forward.
 */
export type DeviceAuthentication = { deviceId: string; idleMs: number };

/**
 * Device authentication, in memory.
 *
 * The review forbids per-request SQL, so the digest map is built once and every
 * write goes through here. That is only safe because one server owns a data
 * directory: there is no second writer whose changes this cache could miss.
 * Revocation is therefore immediate rather than eventually consistent — the
 * same process owns the row and the entry.
 */
export class DeviceDirectory {
  private readonly store: PairingStore;
  private readonly entries = new Map<string, Entry>();
  private readonly connections = new Map<string, Set<LiveConnection>>();
  private readonly now: () => number;

  constructor(store: PairingStore, now: () => number = Date.now) {
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
      revoked: device.revokedAt !== null,
      dirty: false,
    });
  }

  /** After a redemption, so the new device works on its very next request. */
  add(device: StoredDevice): void {
    this.remember(device);
  }

  /**
   * Resolve a credential to a device id, or null. Returns null for every
   * failure alike: an unknown id, a wrong secret, a revoked device and a
   * dormant one are one answer, so nothing here is an oracle.
   */
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
    // Checked on every authentication, not only when this map was built, so a
    // long-running server still retires a dormant credential.
    if (now - entry.lastSeenAt >= UNUSED_LIFETIME_MS) return null;
    // A clock that moved backwards must not rewind last seen, and one that is
    // ahead of the record must not be trusted to extend it.
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

  /**
   * Persist first, then mark in memory, then cut the live connections. The
   * order matters: a crash after the row is written still leaves the device
   * revoked, while marking memory first could lose the revocation entirely.
   */
  revoke(deviceId: string, now: string): boolean {
    const removed = this.store.revokeDevice(deviceId, now);
    const entry = this.entries.get(deviceId);
    if (entry) {
      entry.revoked = true;
      // Nothing should flush for it afterwards, and the flush ignores revoked
      // rows anyway; this closes the window twice.
      entry.dirty = false;
    }
    for (const connection of this.connections.get(deviceId) ?? [])
      connection.close();
    this.connections.delete(deviceId);
    return removed;
  }

  /** Write only what moved, and only for devices that are still valid. */
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
