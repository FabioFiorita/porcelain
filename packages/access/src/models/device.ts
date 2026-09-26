export type Device = {
  id: string;
  label: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  lastSeenAddress?: string | undefined;
};

export type StoredDevice = Device & {
  secretHash: string;
  revokedAt?: string | undefined;
};

export type DeviceDetailLimits = {
  labelLength: number;
  platformLength: number;
};

export type DeviceKey = { deviceId: string };

export type DeviceSighting = { device: StoredDevice };

export type DeviceRevocation = { device: StoredDevice; revokedAt: string };
