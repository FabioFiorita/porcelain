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
