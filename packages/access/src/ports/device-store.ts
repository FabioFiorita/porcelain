import type { Effect } from 'effect';
import { Context } from 'effect';
import type {
  DeviceKey,
  DeviceRevocation,
  DeviceSighting,
  DeviceTrust,
  StoredDevice,
} from '../models/device.ts';

export interface DeviceStore {
  find(input: DeviceKey): Effect.Effect<StoredDevice | undefined>;
  list(): Effect.Effect<StoredDevice[]>;
  markRevoked(input: DeviceRevocation): Effect.Effect<void>;
  recordSighting(input: DeviceSighting): Effect.Effect<void>;
  recordTrust(input: DeviceTrust): Effect.Effect<void>;
}

export const DeviceStore = Context.Service<
  '@porcelain/access/DeviceStore',
  DeviceStore
>('@porcelain/access/DeviceStore');
