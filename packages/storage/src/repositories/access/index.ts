import type {
  DeviceStore,
  EnvironmentIdentityStore,
  PairingGrantStore,
} from '@porcelain/access/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { DeviceRepository } from './device-repository.ts';
import { EnvironmentIdentityRepository } from './environment-identity-repository.ts';
import { PairingGrantRepository } from './pairing-grant-repository.ts';

export function createPairingGrantStore(
  session: StorageSession,
): PairingGrantStore {
  return new PairingGrantRepository(databaseOf(session));
}

export function createDeviceStore(session: StorageSession): DeviceStore {
  return new DeviceRepository(databaseOf(session));
}

export function createEnvironmentIdentityStore(
  session: StorageSession,
): EnvironmentIdentityStore {
  return new EnvironmentIdentityRepository(databaseOf(session));
}
