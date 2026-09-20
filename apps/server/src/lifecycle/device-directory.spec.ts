import { expect, it } from 'vitest';
import { hashSecret, mintCredential } from '../models/credential.ts';
import type {
  LastSeen,
  PairingStore,
  StoredDevice,
} from '../repositories/interfaces/pairing-store.ts';
import { DeviceDirectory, UNUSED_LIFETIME_MS } from './device-directory.ts';

class MemoryStore implements PairingStore {
  rows: StoredDevice[] = [];
  flushed: LastSeen[][] = [];
  issueGrant() {}
  listGrants() {
    return [];
  }
  revokeGrant() {
    return false;
  }
  redeem() {
    return null;
  }
  listDevices() {
    return this.rows.filter((row) => row.revokedAt === null);
  }
  allDevices() {
    return this.rows;
  }
  revokeDevice(id: string, now: string) {
    const row = this.rows.find((entry) => entry.id === id);
    if (!row || row.revokedAt !== null) return false;
    row.revokedAt = now;
    return true;
  }
  recordLastSeen(entries: LastSeen[]) {
    this.flushed.push(entries);
  }
}

function paired(store: MemoryStore, at: number) {
  const credential = mintCredential('pcd');
  store.rows.push({
    id: credential.id,
    label: 'iPhone',
    platform: 'iOS',
    secretHash: hashSecret(credential.secret),
    createdAt: new Date(at).toISOString(),
    lastSeenAt: new Date(at).toISOString(),
    lastSeenAddress: null,
    revokedAt: null,
  });
  return credential;
}

it('accepts a credential, moves last seen forward, and flushes only what moved', () => {
  const store = new MemoryStore();
  const start = Date.parse('2026-02-01T00:00:00.000Z');
  const credential = paired(store, start);
  let now = start;
  const directory = new DeviceDirectory(store, () => now);

  expect(directory.authenticate(credential.token, '10.0.0.4')?.deviceId).toBe(
    credential.id,
  );
  now = start + 5_000;
  expect(directory.authenticate(credential.token, '10.0.0.5')?.deviceId).toBe(
    credential.id,
  );
  directory.flush();
  expect(store.flushed.at(-1)).toEqual([
    {
      deviceId: credential.id,
      lastSeenAt: new Date(start + 5_000).toISOString(),
      lastSeenAddress: '10.0.0.5',
    },
  ]);
  // Nothing moved since, so the next flush writes nothing.
  directory.flush();
  expect(store.flushed.at(-1)).toEqual([]);
});

it('refuses an unknown id, a wrong secret and a foreign credential alike', () => {
  const store = new MemoryStore();
  const start = Date.now();
  const credential = paired(store, start);
  const directory = new DeviceDirectory(store, () => start);

  const other = mintCredential('pcd');
  expect(directory.authenticate(other.token, null)).toBeNull();
  expect(
    directory.authenticate(`pcd_${credential.id}_${other.secret}`, null),
  ).toBeNull();
  expect(directory.authenticate('not-a-credential', null)).toBeNull();
  // A pairing code is not a device credential, whatever its entropy.
  expect(directory.authenticate(mintCredential('pcp').token, null)).toBeNull();
});

it('retires a credential unused for ninety days, checked on every request', () => {
  const store = new MemoryStore();
  const start = Date.parse('2026-02-01T00:00:00.000Z');
  const credential = paired(store, start);
  let now = start;
  const directory = new DeviceDirectory(store, () => now);

  // The cache was built while the device was fresh; the boundary still bites.
  now = start + UNUSED_LIFETIME_MS - 1;
  expect(directory.authenticate(credential.token, null)?.deviceId).toBe(
    credential.id,
  );
  // Using it moved last seen, so the window starts again from here.
  now = now + UNUSED_LIFETIME_MS - 1;
  expect(directory.authenticate(credential.token, null)?.deviceId).toBe(
    credential.id,
  );
  now = now + UNUSED_LIFETIME_MS;
  expect(directory.authenticate(credential.token, null)).toBeNull();
});

it('refuses a credential whose record is in the future and never rewinds last seen', () => {
  const store = new MemoryStore();
  const start = Date.parse('2026-02-01T00:00:00.000Z');
  const credential = paired(store, start);
  let now = start + 60_000;
  const directory = new DeviceDirectory(store, () => now);
  expect(directory.authenticate(credential.token, '10.0.0.1')?.deviceId).toBe(
    credential.id,
  );
  directory.flush();

  // The clock jumps backwards behind the recorded last-seen time.
  now = start - 60_000;
  expect(directory.authenticate(credential.token, '10.0.0.2')).toBeNull();
  directory.flush();
  // The refused request left nothing dirty, so the regressed time and its
  // address cannot reach the database.
  expect(store.flushed.at(-1)).toEqual([]);
  expect(directory.lastSeenAt(credential.id)).toBe(start + 60_000);
});

it('revokes immediately, closes what is held, and cannot be resurrected by a flush', () => {
  const store = new MemoryStore();
  const start = Date.now();
  const credential = paired(store, start);
  const directory = new DeviceDirectory(store, () => start);
  expect(directory.authenticate(credential.token, '10.0.0.7')?.deviceId).toBe(
    credential.id,
  );

  const closed: string[] = [];
  directory.register(credential.id, { close: () => closed.push('held') });
  const otherDevice = paired(store, start);
  const second = new DeviceDirectory(store, () => start);
  second.register(otherDevice.id, {
    close: () => closed.push('someone else'),
  });

  expect(directory.revoke(credential.id, new Date(start).toISOString())).toBe(
    true,
  );
  // The held response was cut, and only that device's.
  expect(closed).toEqual(['held']);
  expect(directory.authenticate(credential.token, null)).toBeNull();

  // A flush that was pending when the revocation landed writes nothing for it.
  directory.flush();
  expect(store.flushed.at(-1)).toEqual([]);
  expect(store.listDevices().map((row) => row.id)).toEqual([otherDevice.id]);
});

it('stops holding a connection once it closes on its own', () => {
  const store = new MemoryStore();
  const start = Date.now();
  const credential = paired(store, start);
  const directory = new DeviceDirectory(store, () => start);
  let closes = 0;
  const release = directory.register(credential.id, {
    close: () => {
      closes += 1;
    },
  });
  release();
  directory.revoke(credential.id, new Date(start).toISOString());
  expect(closes).toBe(0);
});

it('reports how long a device was idle, so a cookie can refresh before it ages out', () => {
  const store = new MemoryStore();
  const start = Date.parse('2026-02-01T00:00:00.000Z');
  const credential = paired(store, start);
  let now = start;
  const directory = new DeviceDirectory(store, () => now);

  // Busy: nothing to refresh, and the idle time must not be read after the
  // fact, where authenticating has already reset it to zero.
  now = start + 1_000;
  expect(directory.authenticate(credential.token, null)?.idleMs).toBe(1_000);

  const day = 24 * 60 * 60 * 1000;
  now = now + day + 1;
  expect(directory.authenticate(credential.token, null)?.idleMs).toBe(day + 1);
});

it('makes a device usable on its next request as soon as it is added', () => {
  const store = new MemoryStore();
  const start = Date.now();
  const directory = new DeviceDirectory(store, () => start);
  const credential = mintCredential('pcd');
  expect(directory.authenticate(credential.token, null)).toBeNull();
  directory.add({
    id: credential.id,
    label: 'iPad',
    platform: 'iPadOS',
    secretHash: hashSecret(credential.secret),
    createdAt: new Date(start).toISOString(),
    lastSeenAt: new Date(start).toISOString(),
    lastSeenAddress: null,
    revokedAt: null,
  });
  expect(directory.authenticate(credential.token, null)?.deviceId).toBe(
    credential.id,
  );
});
