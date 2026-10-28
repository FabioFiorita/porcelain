import type { Brand } from 'effect';
import type { DeviceRoute } from './device.ts';
import type { RemoteAccess, RemoteAccessChange } from './remote-access.ts';

export type WaysInRoute = 'lan' | 'tailnet' | 'cloudflare';

export type WaysInFingerprint = Brand.Branded<string, 'WaysInFingerprint'>;

export type WaysInCaller = {
  viewer: { kind: 'owner' } | { kind: 'device'; deviceId: string };
  local: boolean;
  route: DeviceRoute;
};

export type WaysInEdit = {
  expected: WaysInFingerprint;
  change: RemoteAccessChange;
  caller: WaysInCaller;
};

export type WaysInSnapshot = {
  remote: RemoteAccess;
  fingerprint: WaysInFingerprint;
};

export type WaysInSaved = WaysInSnapshot & { applied: boolean };

export type SetWaysInPermissionInput = { id: string; allowed: boolean };

export type SetWaysInPermissionResult = { id: string; allowed: boolean };
