export type AuthenticateDeviceInput = {
  credential: string;
  address?: string | undefined;
};

export type AuthenticatedDevice = { deviceId: string; idleMs: number };

export type AuthenticateDeviceResult = AuthenticatedDevice | undefined;
