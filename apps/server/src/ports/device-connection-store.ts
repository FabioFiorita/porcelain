export type HeldConnection = { close(): void };

export type DeviceConnection = {
  deviceId: string;
  connection: HeldConnection;
};

export type DeviceConnections = { deviceId: string };

export type ReleaseConnection = () => void;

export interface DeviceConnectionStore {
  insert(input: DeviceConnection): ReleaseConnection;
  remove(input: DeviceConnections): void;
}
