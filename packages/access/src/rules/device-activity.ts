import type { StoredDevice } from '../models/device.ts';

export function idleMilliseconds(device: StoredDevice, now: string): number {
  return Date.parse(now) - Date.parse(device.lastSeenAt);
}

export function deviceUsable(
  device: StoredDevice,
  now: string,
  unusedLifetimeMs: number,
): boolean {
  if (device.revokedAt !== undefined) return false;
  if (Date.parse(device.createdAt) > Date.parse(now)) return false;
  const idle = idleMilliseconds(device, now);
  return idle >= 0 && idle < unusedLifetimeMs;
}

export function sighted(
  device: StoredDevice,
  seenAt: string,
  address: string | undefined,
): StoredDevice {
  return { ...device, lastSeenAt: seenAt, lastSeenAddress: address };
}
