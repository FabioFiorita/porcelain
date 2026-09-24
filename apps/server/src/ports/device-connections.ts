export type HeldConnection = { close(): void };

export interface DeviceConnections {
  hold(input: { deviceId: string; connection: HeldConnection }): () => void;
  close(input: { deviceId: string }): void;
}
