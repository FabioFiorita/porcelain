import { Context } from 'effect';
import type {
  DeviceKey,
  DeviceSighting,
  StoredDevice,
} from '../models/device.ts';

export interface DeviceSightingStore {
  find(input: DeviceKey): StoredDevice | undefined;
  save(input: DeviceSighting): void;
  take(): StoredDevice[];
  remove(input: DeviceKey): void;
}

export const DeviceSightingStore = Context.Service<
  '@porcelain/access/DeviceSightingStore',
  DeviceSightingStore
>('@porcelain/access/DeviceSightingStore');
