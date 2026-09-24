import type {
  DeviceStore,
  EnvironmentIdentityReader,
  PairingGrantStore,
} from '@porcelain/access/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { SqliteDeviceStore } from './sqlite-device-store.ts';
import { SqliteEnvironmentIdentityReader } from './sqlite-environment-identity-store.ts';
import { SqlitePairingGrantStore } from './sqlite-pairing-grant-store.ts';

export function createPairingGrantStore(
  session: StorageSession,
): PairingGrantStore {
  return new SqlitePairingGrantStore(databaseOf(session));
}

export function createDeviceStore(session: StorageSession): DeviceStore {
  return new SqliteDeviceStore(databaseOf(session));
}

export function createEnvironmentIdentityStore(
  session: StorageSession,
): EnvironmentIdentityReader {
  return new SqliteEnvironmentIdentityReader(databaseOf(session));
}
