import type {
  DeviceStore,
  EnvironmentIdentityStore,
  PairingGrantStore,
} from '@porcelain/access/ports';
import { databaseOf, type StorageSession } from '../../db/session.ts';
import { EnvironmentIdentityRepository } from './environment-identity-repository.ts';
import { PairingRepository } from './pairing-repository.ts';

export function createPairingGrantStore(
  session: StorageSession,
): PairingGrantStore {
  return new PairingRepository(databaseOf(session));
}

export function createDeviceStore(session: StorageSession): DeviceStore {
  return new PairingRepository(databaseOf(session));
}

export function createEnvironmentIdentityStore(
  session: StorageSession,
): EnvironmentIdentityStore {
  return new EnvironmentIdentityRepository(databaseOf(session));
}
