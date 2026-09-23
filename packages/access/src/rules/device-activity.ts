import type { StoredDevice } from '../models/device.ts';

const unusedLifetimeMs = 90 * 24 * 60 * 60 * 1000;

export function idleMilliseconds(device: StoredDevice, now: string): number {
  return Date.parse(now) - Date.parse(device.lastSeenAt);
}

export function deviceUsable(device: StoredDevice, now: string): boolean {
  if (device.revokedAt !== undefined) return false;
  if (Date.parse(device.createdAt) > Date.parse(now)) return false;
  const idle = idleMilliseconds(device, now);
  return idle >= 0 && idle < unusedLifetimeMs;
}
