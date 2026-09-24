export type AuthenticateDeviceInput = {
  credential: string;
  address?: string | undefined;
};

export type AuthenticatedDevice = { deviceId: string };

export type AuthenticateDeviceResult =
  | { kind: 'authenticated'; deviceId: string }
  | { kind: 'refused' };

export type AuthenticateDeviceOptions = { unusedLifetimeMs: number };
