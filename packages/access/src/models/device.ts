export type Device = {
  id: string;
  label: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  lastSeenAddress?: string;
};

export type StoredDevice = Device & {
  secretHash: string;
  revokedAt?: string;
};

export type DeviceSighting = {
  deviceId: string;
  seenAt: string;
  address?: string;
};
